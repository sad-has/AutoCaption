import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { logger } from '../logger';
import { getSupabaseClient, isRealSupabaseConfigured } from '../supabase/client';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  DuplicateProjectSchema,
  DeleteProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '../../shared/schemas';
import type { ProjectRecord } from '../../shared/types';
import type { ProjectOperationResult, ProjectsListResult } from '../../shared/ipc';

// Local disk persistence for offline mode and project recovery
function getProjectsStorePath(): string {
  const dir = path.join(app.getPath('userData'), 'local_db');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'projects.json');
}

function getRecoveryDir(): string {
  const dir = path.join(app.getPath('userData'), 'recovery_snapshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// In-memory cache synced with disk for mock/offline resilience
let localProjectsCache: ProjectRecord[] = [];

function loadLocalProjects(): ProjectRecord[] {
  try {
    const storePath = getProjectsStorePath();
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      localProjectsCache = JSON.parse(raw);
    } else {
      localProjectsCache = [];
    }
  } catch (err) {
    logger.warn('Projects', 'Failed to load local projects cache, starting fresh', err);
    localProjectsCache = [];
  }
  return localProjectsCache;
}

function saveLocalProjects(): void {
  try {
    const storePath = getProjectsStorePath();
    fs.writeFileSync(storePath, JSON.stringify(localProjectsCache, null, 2), 'utf8');
  } catch (err) {
    logger.error('Projects', 'Failed to save local projects to disk', err);
  }
}

// Initial load
loadLocalProjects();

// Save recovery snapshot to disk
function saveRecoverySnapshot(project: ProjectRecord): void {
  try {
    const recoveryPath = path.join(getRecoveryDir(), `${project.id}.json`);
    fs.writeFileSync(recoveryPath, JSON.stringify(project, null, 2), 'utf8');
  } catch (err) {
    logger.warn('Projects', `Failed to write recovery snapshot for ${project.id}`, err);
  }
}

/**
 * Directly upserts a project in local cache and disk snapshot.
 */
export function upsertLocalProject(project: ProjectRecord): ProjectRecord {
  const existingIdx = localProjectsCache.findIndex((p) => p.id === project.id);
  if (existingIdx >= 0) {
    localProjectsCache[existingIdx] = project;
  } else {
    localProjectsCache.unshift(project);
  }
  saveLocalProjects();
  saveRecoverySnapshot(project);
  return project;
}

/**
 * List all projects owned by the authenticated user.
 * RLS rule: auth.uid() = user_id
 */
export async function listProjects(userId: string): Promise<ProjectsListResult> {
  if (!userId) {
    return { success: false, projects: [], error: 'User must be authenticated.' };
  }

  const supabase = getSupabaseClient();
  if (isRealSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Projects', 'Supabase list projects error', error);
        return { success: false, projects: [], error: error.message };
      }

      const projects: ProjectRecord[] = (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        aspectRatio: row.aspect_ratio,
        captionStyle: row.caption_style,
        captionSegments: row.caption_segments,
        videoId: row.video_id,
        videoStoragePath: row.video_storage_path,
        videoName: row.video_name,
        videoDurationMs: row.video_duration_ms,
        videoWidth: row.video_width,
        videoHeight: row.video_height,
        videoFps: row.video_fps,
        version: row.version || 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return { success: true, projects };
    } catch (err) {
      logger.error('Projects', 'Exception querying Supabase projects', err);
      return { success: false, projects: [], error: 'Failed to fetch projects' };
    }
  }

  // Offline / Mock mode (strictly filtered by userId for ownership verification)
  const userProjects = localProjectsCache.filter((p) => p.userId === userId);
  userProjects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return { success: true, projects: userProjects };
}

/**
 * Get single project with strict user ownership verification.
 */
export async function getProject(userId: string, projectId: string): Promise<ProjectOperationResult> {
  if (!userId || !projectId) {
    return { success: false, error: 'Invalid user or project identifier.' };
  }

  const supabase = getSupabaseClient();
  if (isRealSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { success: false, error: 'Project not found or access denied.' };
      }

      const project: ProjectRecord = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        aspectRatio: data.aspect_ratio,
        captionStyle: data.caption_style,
        captionSegments: data.caption_segments,
        videoId: data.video_id,
        videoStoragePath: data.video_storage_path,
        videoName: data.video_name,
        videoDurationMs: data.video_duration_ms,
        videoWidth: data.video_width,
        videoHeight: data.video_height,
        videoFps: data.video_fps,
        version: data.version || 1,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return { success: true, project };
    } catch (_err) {
      return { success: false, error: 'Project not found or access denied.' };
    }
  }

  const found = localProjectsCache.find((p) => p.id === projectId);
  if (!found || found.userId !== userId) {
    return { success: false, error: 'Project not found or access denied.' };
  }

  return { success: true, project: found };
}

/**
 * Creates a new project in Supabase with RLS ownership.
 */
export async function createProject(userId: string, rawInput: CreateProjectInput): Promise<ProjectOperationResult> {
  const parseResult = CreateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid project input.' };
  }

  const input = parseResult.data;
  const projectId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newRecord: ProjectRecord = {
    id: projectId,
    userId,
    name: input.name,
    aspectRatio: input.aspectRatio,
    captionStyle: input.captionStyle || {
      presetId: 'hormozi',
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 48,
      fontWeight: 900,
      allCaps: true,
      letterSpacing: 1.5,
      lineHeight: 1.15,
      textColor: '#FFFFFF',
      activeWordColor: '#10B981',
      strokeColor: '#000000',
      strokeWidth: 6,
      hasShadow: true,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 14,
      shadowOffsetY: 4,
      hasBox: false,
      boxColor: 'rgba(0,0,0,0.6)',
      boxPaddingX: 16,
      boxPaddingY: 8,
      boxCornerRadius: 12,
      positionYPercent: 22,
      positionXPercent: 50,
    },
    captionSegments: input.captionSegments || [],
    videoId: null,
    videoStoragePath: null,
    videoName: null,
    videoDurationMs: null,
    videoWidth: null,
    videoHeight: null,
    videoFps: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabaseClient();
  if (isRealSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('projects').insert({
        id: newRecord.id,
        user_id: userId,
        name: newRecord.name,
        aspect_ratio: newRecord.aspectRatio,
        caption_style: newRecord.captionStyle,
        caption_segments: newRecord.captionSegments,
        version: 1,
        created_at: now,
        updated_at: now,
      });

      if (error) {
        logger.error('Projects', 'Failed to create project in Supabase', error);
        return { success: false, error: error.message };
      }
    } catch (err) {
      logger.error('Projects', 'Exception creating project in Supabase', err);
      return { success: false, error: 'Database insertion failed.' };
    }
  }

  // Save to local cache & snapshot
  localProjectsCache.unshift(newRecord);
  saveLocalProjects();
  saveRecoverySnapshot(newRecord);

  logger.info('Projects', `Project created: ${newRecord.name} (${newRecord.id}) for user ${userId}`);
  return { success: true, project: newRecord };
}

/**
 * Updates an existing project with optimistic concurrency conflict detection.
 */
export async function updateProject(userId: string, rawInput: UpdateProjectInput): Promise<ProjectOperationResult> {
  const parseResult = UpdateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid update input.' };
  }

  const input = parseResult.data;
  const currentResult = await getProject(userId, input.id);

  if (!currentResult.success || !currentResult.project) {
    const isTransient = input.id.startsWith('proj-') || input.id.startsWith('demo-') || input.id.startsWith('temp-');
    if (isTransient) {
      const now = new Date().toISOString();
      const newRecord: ProjectRecord = {
        id: input.id,
        userId,
        name: input.name || 'Viral Short Project #1',
        aspectRatio: input.aspectRatio || '9:16',
        captionStyle: input.captionStyle || {
          presetId: 'hormozi',
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 48,
          fontWeight: 900,
          allCaps: true,
          letterSpacing: 1.5,
          lineHeight: 1.15,
          textColor: '#FFFFFF',
          activeWordColor: '#10B981',
          strokeColor: '#000000',
          strokeWidth: 6,
          hasShadow: true,
          shadowColor: 'rgba(0,0,0,0.8)',
          shadowBlur: 14,
          shadowOffsetY: 4,
          hasBox: false,
          boxColor: 'rgba(0,0,0,0.6)',
          boxPaddingX: 16,
          boxPaddingY: 8,
          boxCornerRadius: 12,
          positionYPercent: 22,
          positionXPercent: 50,
        },
        captionSegments: input.captionSegments || [],
        videoId: input.videoId || null,
        videoStoragePath: input.videoStoragePath || null,
        videoName: input.videoName || null,
        videoDurationMs: input.videoDurationMs || null,
        videoWidth: input.videoWidth || null,
        videoHeight: input.videoHeight || null,
        videoFps: input.videoFps || null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      return { success: true, project: upsertLocalProject(newRecord) };
    }
    return { success: false, error: currentResult.error || 'Project not found.' };
  }

  const currentProject = currentResult.project;

  // Optimistic concurrency control: check client version against server version
  if (currentProject.version !== input.version) {
    logger.warn(
      'Projects',
      `Conflict detected for project ${input.id}: client v${input.version} vs server v${currentProject.version}`
    );
    return {
      success: false,
      conflict: true,
      serverVersion: currentProject.version,
      project: currentProject,
      error: 'Conflict: This project was modified elsewhere. Review changes before saving.',
    };
  }

  const nextVersion = currentProject.version + 1;
  const now = new Date().toISOString();

  const updatedRecord: ProjectRecord = {
    ...currentProject,
    name: input.name ?? currentProject.name,
    aspectRatio: input.aspectRatio ?? currentProject.aspectRatio,
    captionStyle: input.captionStyle ?? currentProject.captionStyle,
    captionSegments: input.captionSegments ?? currentProject.captionSegments,
    videoId: input.videoId !== undefined ? input.videoId : currentProject.videoId,
    videoStoragePath: input.videoStoragePath !== undefined ? input.videoStoragePath : currentProject.videoStoragePath,
    videoName: input.videoName !== undefined ? input.videoName : currentProject.videoName,
    videoDurationMs: input.videoDurationMs !== undefined ? input.videoDurationMs : currentProject.videoDurationMs,
    videoWidth: input.videoWidth !== undefined ? input.videoWidth : currentProject.videoWidth,
    videoHeight: input.videoHeight !== undefined ? input.videoHeight : currentProject.videoHeight,
    videoFps: input.videoFps !== undefined ? input.videoFps : currentProject.videoFps,
    version: nextVersion,
    updatedAt: now,
  };

  const supabase = getSupabaseClient();
  if (isRealSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: updatedRecord.name,
          aspect_ratio: updatedRecord.aspectRatio,
          caption_style: updatedRecord.captionStyle,
          caption_segments: updatedRecord.captionSegments,
          video_id: updatedRecord.videoId,
          video_storage_path: updatedRecord.videoStoragePath,
          video_name: updatedRecord.videoName,
          video_duration_ms: updatedRecord.videoDurationMs,
          video_width: updatedRecord.videoWidth,
          video_height: updatedRecord.videoHeight,
          video_fps: updatedRecord.videoFps,
          version: nextVersion,
          updated_at: now,
        })
        .eq('id', input.id)
        .eq('user_id', userId)
        .eq('version', input.version); // Concurrency guard at SQL level

      if (error) {
        logger.error('Projects', 'Supabase update project error', error);
        return { success: false, error: error.message };
      }
    } catch (err) {
      logger.error('Projects', 'Exception updating project in Supabase', err);
      return { success: false, error: 'Database update failed.' };
    }
  }

  // Update local cache & snapshot
  const idx = localProjectsCache.findIndex((p) => p.id === input.id);
  if (idx !== -1) {
    localProjectsCache[idx] = updatedRecord;
  } else {
    localProjectsCache.push(updatedRecord);
  }
  saveLocalProjects();
  saveRecoverySnapshot(updatedRecord);

  logger.info('Projects', `Project updated: ${updatedRecord.name} (v${nextVersion})`);
  return { success: true, project: updatedRecord };
}

/**
 * Duplicates a project, making a deep copy with a new UUID and version 1.
 */
export async function duplicateProject(userId: string, rawInput: { projectId: string }): Promise<ProjectOperationResult> {
  const parseResult = DuplicateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid project ID.' };
  }

  const { projectId } = parseResult.data;
  const currentResult = await getProject(userId, projectId);

  if (!currentResult.success || !currentResult.project) {
    return { success: false, error: 'Source project not found or access denied.' };
  }

  const src = currentResult.project;
  const newName = `${src.name} (Copy)`;

  return createProject(userId, {
    name: newName,
    aspectRatio: src.aspectRatio,
    captionStyle: JSON.parse(JSON.stringify(src.captionStyle)),
    captionSegments: JSON.parse(JSON.stringify(src.captionSegments)),
  });
}

/**
 * Deletes a project, verifying ownership.
 */
export async function deleteProject(userId: string, rawInput: { projectId: string }): Promise<ProjectOperationResult> {
  const parseResult = DeleteProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid project ID.' };
  }

  const { projectId } = parseResult.data;
  const currentResult = await getProject(userId, projectId);

  if (!currentResult.success || !currentResult.project) {
    return { success: false, error: 'Project not found or access denied.' };
  }

  const supabase = getSupabaseClient();
  if (isRealSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Projects', 'Supabase delete error', error);
        return { success: false, error: error.message };
      }
    } catch (err) {
      logger.error('Projects', 'Exception deleting project from Supabase', err);
      return { success: false, error: 'Failed to delete project.' };
    }
  }

  // Remove from local cache
  localProjectsCache = localProjectsCache.filter((p) => p.id !== projectId);
  saveLocalProjects();

  logger.info('Projects', `Project deleted: ${projectId} by user ${userId}`);
  return { success: true };
}

/**
 * Restores project from local crash recovery snapshot.
 */
export async function recoverProject(userId: string, projectId: string): Promise<ProjectOperationResult> {
  try {
    const recoveryPath = path.join(getRecoveryDir(), `${projectId}.json`);
    if (!fs.existsSync(recoveryPath)) {
      return { success: false, error: 'No recovery snapshot available for this project.' };
    }

    const raw = fs.readFileSync(recoveryPath, 'utf8');
    const recovered: ProjectRecord = JSON.parse(raw);

    if (recovered.userId !== userId) {
      return { success: false, error: 'Unauthorized: Snapshot belongs to another user.' };
    }

    logger.info('Projects', `Recovered project snapshot for ${projectId}`);
    return { success: true, project: recovered };
  } catch (err) {
    logger.error('Projects', 'Failed to recover snapshot', err);
    return { success: false, error: 'Recovery snapshot could not be parsed.' };
  }
}
