import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Mock electron app.getPath
vi.mock('electron', () => {
  const tmpDir = path.join(__dirname, 'tmp_projects_test_data');
  return {
    app: {
      getPath: () => tmpDir,
    },
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

import {
  createProject,
  getProject,
  updateProject,
  duplicateProject,
  deleteProject,
  listProjects,
  recoverProject,
} from '../src/main/projects/service';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
} from '../src/shared/schemas';

describe('Project Management & Security (RLS & Ownership)', () => {
  const userA = '00000000-0000-4000-a000-00000000000a';
  const userB = '00000000-0000-4000-a000-00000000000b';

  beforeAll(() => {
    const tmpDir = path.join(__dirname, 'tmp_projects_test_data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    const tmpDir = path.join(__dirname, 'tmp_projects_test_data');
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Zod Input Validation', () => {
    it('validates valid create project input', () => {
      const valid = CreateProjectSchema.safeParse({
        name: 'My New Short',
        aspectRatio: '9:16',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects empty or whitespace-only project names', () => {
      const empty = CreateProjectSchema.safeParse({ name: '   ' });
      expect(empty.success).toBe(false);
    });

    it('rejects invalid aspect ratio values', () => {
      const invalidRatio = CreateProjectSchema.safeParse({
        name: 'Invalid Ratio Project',
        aspectRatio: '21:9', // not supported
      });
      expect(invalidRatio.success).toBe(false);
    });

    it('enforces positive integer version on update', () => {
      const invalidVersion = UpdateProjectSchema.safeParse({
        id: 'proj-1',
        version: -1,
      });
      expect(invalidVersion.success).toBe(false);
    });
  });

  describe('Project CRUD & Persistence', () => {
    let createdProjectId: string;

    it('creates a project with initial version 1 for User A', async () => {
      const res = await createProject(userA, {
        name: 'Viral TikTok #1',
        aspectRatio: '9:16',
      });

      expect(res.success).toBe(true);
      expect(res.project).toBeDefined();
      expect(res.project?.name).toBe('Viral TikTok #1');
      expect(res.project?.version).toBe(1);
      expect(res.project?.userId).toBe(userA);

      createdProjectId = res.project!.id;
    });

    it('retrieves the created project by ID', async () => {
      const res = await getProject(userA, createdProjectId);
      expect(res.success).toBe(true);
      expect(res.project?.id).toBe(createdProjectId);
    });

    it('lists all projects for User A', async () => {
      const res = await listProjects(userA);
      expect(res.success).toBe(true);
      expect(res.projects.length).toBeGreaterThan(0);
      expect(res.projects.some((p) => p.id === createdProjectId)).toBe(true);
    });

    it('updates project content and increments version to 2', async () => {
      const updateRes = await updateProject(userA, {
        id: createdProjectId,
        name: 'Viral TikTok #1 (Updated)',
        version: 1,
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.project?.name).toBe('Viral TikTok #1 (Updated)');
      expect(updateRes.project?.version).toBe(2);
    });

    it('detects concurrent edits and reports version conflict', async () => {
      // Trying to update with stale version 1 when server is at version 2
      const conflictRes = await updateProject(userA, {
        id: createdProjectId,
        name: 'Conflicting Edit',
        version: 1, // Stale!
      });

      expect(conflictRes.success).toBe(false);
      expect(conflictRes.conflict).toBe(true);
      expect(conflictRes.serverVersion).toBe(2);
      expect(conflictRes.error).toContain('Conflict');
    });

    it('duplicates a project cleanly with deep copy and reset version', async () => {
      const dupRes = await duplicateProject(userA, { projectId: createdProjectId });

      expect(dupRes.success).toBe(true);
      expect(dupRes.project?.name).toContain('(Copy)');
      expect(dupRes.project?.id).not.toBe(createdProjectId);
      expect(dupRes.project?.version).toBe(1);
    });

    it('recovers project from local recovery snapshot', async () => {
      const recRes = await recoverProject(userA, createdProjectId);
      expect(recRes.success).toBe(true);
      expect(recRes.project?.id).toBe(createdProjectId);
    });

    it('deletes a project safely', async () => {
      const delRes = await deleteProject(userA, { projectId: createdProjectId });
      expect(delRes.success).toBe(true);

      const checkRes = await getProject(userA, createdProjectId);
      expect(checkRes.success).toBe(false);
    });
  });

  describe('User Ownership & Security Boundaries (RLS Enforcement)', () => {
    let userAProjectId: string;

    beforeAll(async () => {
      const p = await createProject(userA, { name: 'Private User A Project' });
      userAProjectId = p.project!.id;
    });

    it('prevents User B from accessing User A project', async () => {
      const res = await getProject(userB, userAProjectId);
      expect(res.success).toBe(false);
      expect(res.error).toContain('access denied');
    });

    it('prevents User B from updating User A project', async () => {
      const res = await updateProject(userB, {
        id: userAProjectId,
        name: 'Hacked by User B',
        version: 1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('access denied');
    });

    it('prevents User B from deleting User A project', async () => {
      const res = await deleteProject(userB, { projectId: userAProjectId });
      expect(res.success).toBe(false);
      expect(res.error).toContain('access denied');
    });

    it('does not leak User A projects in User B project list', async () => {
      const resB = await listProjects(userB);
      expect(resB.success).toBe(true);
      expect(resB.projects.some((p) => p.id === userAProjectId)).toBe(false);
    });

    it('prevents User B from recovering User A snapshot', async () => {
      const res = await recoverProject(userB, userAProjectId);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Unauthorized');
    });
  });
});
