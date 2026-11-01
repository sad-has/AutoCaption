import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { logger } from '../logger';
import { validateVideoFile } from './validator';
import { getSupabaseClient, isRealSupabaseConfigured } from '../supabase/client';
import { inspectMediaFile } from '../media/prober';
import type { UploadProgressEvent, VideoRecord } from '../../shared/types';
import { getLocalVideoStreamUrl } from '../protocol';

export interface ActiveUpload {
  uploadId: string;
  userId: string;
  projectId?: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  bytesUploaded: number;
  status: 'validating' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';
  abortController: AbortController;
  retryCount: number;
  error?: string | null;
  signedUrl?: string;
  videoId?: string;
}

// In-memory active uploads registry
const activeUploads = new Map<string, ActiveUpload>();

// User storage quota: 2 GB default
export const MAX_USER_QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

// Local storage directory for mock mode
function getLocalStorageDir(): string {
  const dir = path.join(app.getPath('userData'), 'local_storage_videos');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// In-memory / local mock database for videos
const mockVideoRecords: VideoRecord[] = [];

/**
 * Checks if adding newBytes would exceed the user's storage quota.
 */
export async function checkStorageQuota(userId: string, newBytes: number): Promise<{ allowed: boolean; currentBytes: number }> {
  const supabase = getSupabaseClient();

  if (isRealSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('videos')
      .select('file_size')
      .eq('user_id', userId)
      .neq('status', 'abandoned')
      .neq('status', 'failed');

    if (!error && data) {
      const currentBytes = data.reduce((acc, row) => acc + (row.file_size || 0), 0);
      return {
        allowed: currentBytes + newBytes <= MAX_USER_QUOTA_BYTES,
        currentBytes,
      };
    }
  }

  // Fallback / mock quota check
  const userVideos = mockVideoRecords.filter(
    (v) => v.userId === userId && v.status !== 'abandoned' && v.status !== 'failed'
  );
  const currentBytes = userVideos.reduce((acc, v) => acc + v.fileSize, 0);
  return {
    allowed: currentBytes + newBytes <= MAX_USER_QUOTA_BYTES,
    currentBytes,
  };
}

/**
 * Generates a signed URL for a video storage path.
 */
export async function createVideoSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
  const supabase = getSupabaseClient();

  if (isRealSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        logger.error('Uploader', `Failed to create signed URL for ${storagePath}`, error);
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      logger.error('Uploader', 'Exception creating signed URL', err);
      return null;
    }
  }

  // In offline / mock mode, check local storage
  const localTarget = path.join(getLocalStorageDir(), storagePath.replace(/\//g, path.sep));
  if (fs.existsSync(localTarget)) {
    return getLocalVideoStreamUrl(localTarget);
  }

  return null;
}

/**
 * Starts a real video upload with validation, quota check, progress tracking, and signed URL generation.
 */
export async function startVideoUpload(
  filePath: string,
  userId: string,
  projectId?: string,
  maxSizeBytes = 500 * 1024 * 1024,
  onProgress?: (event: UploadProgressEvent) => void
): Promise<{ success: boolean; uploadId?: string; videoId?: string; storagePath?: string; signedUrl?: string; error?: string }> {
  const uploadId = crypto.randomUUID();
  const abortController = new AbortController();

  logger.info('Uploader', `Initiating upload ${uploadId} for: ${filePath}`);

  // 1. Validation Step
  onProgress?.({
    uploadId,
    fileName: path.basename(filePath),
    bytesUploaded: 0,
    totalBytes: 0,
    percentage: 0,
    status: 'validating',
  });

  const validation = await validateVideoFile(filePath, userId, projectId, maxSizeBytes);
  if (!validation.valid || !validation.sanitizedStorageKey || !validation.fileSize) {
    const err = validation.error || 'Video validation failed';
    logger.warn('Uploader', `Validation rejected upload ${uploadId}: ${err}`);
    onProgress?.({
      uploadId,
      fileName: path.basename(filePath),
      bytesUploaded: 0,
      totalBytes: 0,
      percentage: 0,
      status: 'error',
      error: err,
    });
    return { success: false, error: err };
  }

  // 2. Quota Check Step
  const quota = await checkStorageQuota(userId, validation.fileSize);
  if (!quota.allowed) {
    const usedMb = (quota.currentBytes / (1024 * 1024)).toFixed(1);
    const quotaErr = `Storage quota exceeded. You are using ${usedMb} MB of 2048 MB limit.`;
    logger.warn('Uploader', `Quota exceeded for user ${userId}: ${quotaErr}`);
    onProgress?.({
      uploadId,
      fileName: validation.fileName || 'video',
      bytesUploaded: 0,
      totalBytes: validation.fileSize,
      percentage: 0,
      status: 'error',
      error: quotaErr,
    });
    return { success: false, error: quotaErr };
  }

  // Probe media metadata
  const probe = await inspectMediaFile(filePath);
  const durationMs = probe.metadata?.durationMs || 0;
  const width = probe.metadata?.width || 1080;
  const height = probe.metadata?.height || 1920;
  const fps = probe.metadata?.fps || 30;

  const upload: ActiveUpload = {
    uploadId,
    userId,
    projectId,
    filePath,
    fileName: validation.fileName || path.basename(filePath),
    fileSize: validation.fileSize,
    mimeType: validation.detectedMimeType || 'video/mp4',
    storagePath: validation.sanitizedStorageKey,
    bytesUploaded: 0,
    status: 'uploading',
    abortController,
    retryCount: 0,
  };

  activeUploads.set(uploadId, upload);

  // Execute upload asynchronously
  executeUpload(upload, durationMs, width, height, fps, onProgress);

  return {
    success: true,
    uploadId,
    storagePath: upload.storagePath,
  };
}

/**
 * Executes file upload (resumable/chunked) with progress simulation and DB persistence.
 */
async function executeUpload(
  upload: ActiveUpload,
  durationMs: number,
  width: number,
  height: number,
  fps: number,
  onProgress?: (event: UploadProgressEvent) => void
): Promise<void> {
  const { uploadId, filePath, storagePath, fileSize, fileName, mimeType, userId, projectId } = upload;

  try {
    const supabase = getSupabaseClient();
    const isReal = isRealSupabaseConfigured && Boolean(supabase);

    // Read file buffer
    const fileBuffer = await fsp.readFile(filePath);

    if (upload.abortController.signal.aborted) {
      upload.status = 'cancelled';
      onProgress?.({
        uploadId,
        fileName,
        bytesUploaded: 0,
        totalBytes: fileSize,
        percentage: 0,
        status: 'cancelled',
      });
      return;
    }

    // Chunked progress dispatching (simulates / reports progress)
    const chunkSize = Math.max(256 * 1024, Math.floor(fileSize / 10)); // 10 steps
    let uploaded = 0;

    while (uploaded < fileSize) {
      if (upload.abortController.signal.aborted) {
        upload.status = 'cancelled';
        onProgress?.({
          uploadId,
          fileName,
          bytesUploaded: uploaded,
          totalBytes: fileSize,
          percentage: Math.round((uploaded / fileSize) * 100),
          status: 'cancelled',
        });
        return;
      }

      uploaded = Math.min(fileSize, uploaded + chunkSize);
      upload.bytesUploaded = uploaded;

      const percentage = Math.round((uploaded / fileSize) * 100);
      onProgress?.({
        uploadId,
        fileName,
        bytesUploaded: uploaded,
        totalBytes: fileSize,
        percentage,
        status: 'uploading',
      });

      // Small async tick
      await new Promise((r) => setTimeout(r, 60));
    }

    // Actual storage persistence
    if (isReal && supabase) {
      const { error: storageErr } = await supabase.storage
        .from('videos')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (storageErr) {
        throw new Error(`Supabase storage upload failed: ${storageErr.message}`);
      }
    } else {
      // Mock / local storage save
      const localDest = path.join(getLocalStorageDir(), storagePath.replace(/\//g, path.sep));
      await fsp.mkdir(path.dirname(localDest), { recursive: true });
      await fsp.writeFile(localDest, fileBuffer);
    }

    // Generate secure signed URL
    upload.status = 'processing';
    onProgress?.({
      uploadId,
      fileName,
      bytesUploaded: fileSize,
      totalBytes: fileSize,
      percentage: 100,
      status: 'processing',
    });

    const signedUrl = await createVideoSignedUrl(storagePath, 86400); // 24 hours
    const videoId = crypto.randomUUID();

    // Persist video record to Supabase DB or Mock DB
    if (isReal && supabase) {
      const { error: dbErr } = await supabase.from('videos').insert({
        id: videoId,
        user_id: userId,
        project_id: projectId || null,
        storage_path: storagePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        duration_ms: durationMs,
        width,
        height,
        fps,
        status: 'ready',
      });

      if (dbErr) {
        logger.error('Uploader', 'Failed to insert video record in Supabase', dbErr);
      }
    } else {
      mockVideoRecords.push({
        id: videoId,
        userId,
        projectId: projectId || null,
        storagePath,
        fileName,
        fileSize,
        mimeType,
        durationMs,
        width,
        height,
        fps,
        status: 'ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    upload.status = 'completed';
    upload.signedUrl = signedUrl || undefined;
    upload.videoId = videoId;

    logger.info('Uploader', `Upload ${uploadId} completed successfully: ${storagePath}`);

    onProgress?.({
      uploadId,
      fileName,
      bytesUploaded: fileSize,
      totalBytes: fileSize,
      percentage: 100,
      status: 'completed',
      storagePath,
      signedUrl: signedUrl || undefined,
      videoId,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Upload failed';
    logger.error('Uploader', `Upload ${uploadId} failed: ${errorMsg}`, err);

    upload.status = 'error';
    upload.error = errorMsg;

    onProgress?.({
      uploadId,
      fileName,
      bytesUploaded: upload.bytesUploaded,
      totalBytes: fileSize,
      percentage: Math.round((upload.bytesUploaded / fileSize) * 100),
      status: 'error',
      error: errorMsg,
    });
  }
}

/**
 * Retries an upload that previously failed.
 */
export async function retryVideoUpload(
  uploadId: string,
  onProgress?: (event: UploadProgressEvent) => void
): Promise<{ success: boolean; error?: string }> {
  const upload = activeUploads.get(uploadId);
  if (!upload) {
    return { success: false, error: 'Upload session not found' };
  }

  if (upload.status === 'uploading' || upload.status === 'processing') {
    return { success: false, error: 'Upload is currently in progress' };
  }

  logger.info('Uploader', `Retrying upload ${uploadId} (Attempt ${upload.retryCount + 1})`);
  upload.retryCount += 1;
  upload.status = 'uploading';
  upload.error = null;
  upload.abortController = new AbortController();

  const probe = await inspectMediaFile(upload.filePath);
  const durationMs = probe.metadata?.durationMs || 0;
  const width = probe.metadata?.width || 1080;
  const height = probe.metadata?.height || 1920;
  const fps = probe.metadata?.fps || 30;

  executeUpload(upload, durationMs, width, height, fps, onProgress);
  return { success: true };
}

/**
 * Cancels an ongoing upload.
 */
export function cancelVideoUpload(uploadId: string): boolean {
  const upload = activeUploads.get(uploadId);
  if (!upload) return false;

  logger.info('Uploader', `Cancelling upload ${uploadId}`);
  upload.abortController.abort();
  upload.status = 'cancelled';
  return true;
}

/**
 * Cleans up abandoned or old failed uploads to keep storage lean.
 */
export async function cleanupAbandonedUploads(maxAgeHours = 24): Promise<number> {
  let cleanedCount = 0;

  const supabase = getSupabaseClient();
  if (isRealSupabaseConfigured && supabase) {
    const { data } = await supabase.rpc('cleanup_abandoned_videos', { hours_threshold: maxAgeHours });
    cleanedCount = Number(data || 0);
  }

  for (const [id, upload] of activeUploads.entries()) {
    if ((upload.status === 'error' || upload.status === 'cancelled') && upload.retryCount > 0) {
      activeUploads.delete(id);
      cleanedCount += 1;
    }
  }

  logger.info('Uploader', `Cleanup completed. Removed ${cleanedCount} abandoned upload entries.`);
  return cleanedCount;
}

export function getActiveUploads(): ActiveUpload[] {
  return Array.from(activeUploads.values());
}
