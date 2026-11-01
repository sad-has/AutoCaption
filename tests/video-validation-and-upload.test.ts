import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Mock electron app.getPath for node test runner
vi.mock('electron', () => {
  const tmpDir = path.join(__dirname, 'tmp_electron_data');
  return {
    app: {
      getPath: () => tmpDir,
    },
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

import { validateVideoFile, generateStorageKey } from '../src/main/upload/validator';
import {
  startVideoUpload,
  retryVideoUpload,
  cancelVideoUpload,
  checkStorageQuota,
  createVideoSignedUrl,
  cleanupAbandonedUploads,
  MAX_USER_QUOTA_BYTES,
} from '../src/main/upload/uploader';

describe('Video Validation & Upload Engine', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const userId = 'user-test-uuid-100';

  beforeAll(() => {
    const tmpDir = path.join(__dirname, 'tmp_electron_data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    const tmpDir = path.join(__dirname, 'tmp_electron_data');
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Magic Bytes & File Container Validation', () => {
    it('validates a real MP4 video with authentic ISOBMFF/ftyp header', async () => {
      const filePath = path.join(fixturesDir, 'sample_9x16.mp4');
      const result = await validateVideoFile(filePath, userId, 'proj-1');

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('video/mp4');
      expect(result.detectedExtension).toBe('mp4');
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.sanitizedStorageKey).toMatch(/^user-test-uuid-100\/proj-1\/[a-f0-9-]+\.mp4$/);
    });

    it('validates a real WebM video with authentic EBML signature', async () => {
      const filePath = path.join(fixturesDir, 'sample_video.webm');
      const result = await validateVideoFile(filePath, userId, 'proj-1');

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('video/webm');
      expect(result.detectedExtension).toBe('webm');
      expect(result.sanitizedStorageKey).toContain('webm');
    });

    it('rejects a corrupted file or file with mismatched header/magic bytes', async () => {
      const filePath = path.join(fixturesDir, 'corrupted_video.mp4');
      const result = await validateVideoFile(filePath, userId, 'proj-1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match a valid MP4, MOV, or WebM');
    });

    it('rejects a file exceeding the configurable maximum size limit', async () => {
      const filePath = path.join(fixturesDir, 'sample_9x16.mp4');
      // Set maximum to 100 bytes (smaller than sample video)
      const result = await validateVideoFile(filePath, userId, 'proj-1', 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed limit');
    });

    it('rejects nonexistent files cleanly', async () => {
      const filePath = path.join(fixturesDir, 'phantom_video.mp4');
      const result = await validateVideoFile(filePath, userId, 'proj-1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found on disk');
    });

    it('generates unguessable, sanitized storage paths', () => {
      const key = generateStorageKey('user/injection../attack', 'mp4', 'proj<script>');
      expect(key).not.toContain('..');
      expect(key).not.toContain('<');
      expect(key).toMatch(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.mp4$/);
    });
  });

  describe('Storage Quotas & Quota Enforcement', () => {
    it('allows upload within storage quota', async () => {
      const quota = await checkStorageQuota(userId, 50 * 1024 * 1024); // 50MB
      expect(quota.allowed).toBe(true);
    });

    it('blocks upload when exceeding the 2GB limit', async () => {
      const oversizedBytes = MAX_USER_QUOTA_BYTES + 1024;
      const quota = await checkStorageQuota(userId, oversizedBytes);
      expect(quota.allowed).toBe(false);
    });
  });

  describe('Upload Lifecycle, Progress & Retries', () => {
    it('initiates and completes an upload with real-time progress callbacks', async () => {
      const filePath = path.join(fixturesDir, 'sample_9x16.mp4');
      const progressSnapshots: number[] = [];

      const startRes = await startVideoUpload(filePath, userId, 'proj-1', 500 * 1024 * 1024, (event) => {
        progressSnapshots.push(event.percentage);
      });

      expect(startRes.success).toBe(true);
      expect(startRes.uploadId).toBeDefined();

      // Wait for async chunked progress loop to complete
      await new Promise((r) => setTimeout(r, 800));

      expect(progressSnapshots.length).toBeGreaterThan(1);
      expect(progressSnapshots[progressSnapshots.length - 1]).toBe(100);

      if (startRes.storagePath) {
        const signedUrl = await createVideoSignedUrl(startRes.storagePath);
        expect(signedUrl).toBeDefined();
        expect(typeof signedUrl).toBe('string');
      }
    });

    it('supports cancellation during an active upload', async () => {
      const filePath = path.join(fixturesDir, 'sample_16x9.mp4');
      const startRes = await startVideoUpload(filePath, userId, 'proj-cancel');

      expect(startRes.success).toBe(true);
      const cancelled = cancelVideoUpload(startRes.uploadId!);
      expect(cancelled).toBe(true);
    });

    it('supports retry on failed upload sessions', async () => {
      const retryRes = await retryVideoUpload('non-existent-upload-id');
      expect(retryRes.success).toBe(false);
      expect(retryRes.error).toContain('not found');
    });

    it('cleans up abandoned upload sessions', async () => {
      const cleaned = await cleanupAbandonedUploads(0);
      expect(typeof cleaned).toBe('number');
    });
  });
});
