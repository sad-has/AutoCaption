import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../logger';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
  detectedExtension?: 'mp4' | 'mov' | 'webm';
  fileSize?: number;
  fileName?: string;
  sanitizedStorageKey?: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v']);

/**
 * Validates actual file content by inspecting file header / magic bytes.
 * Never trusts filename or browser-supplied MIME type.
 */
export async function validateVideoFile(
  filePath: string,
  userId: string,
  projectId?: string,
  maxSizeBytes = 500 * 1024 * 1024 // 500 MB default
): Promise<FileValidationResult> {
  try {
    const normalized = path.normalize(filePath);
    const fileName = path.basename(normalized);

    // 1. Filesystem existence & stat check
    let stat;
    try {
      stat = await fs.stat(normalized);
    } catch {
      return { valid: false, error: `File not found on disk: ${fileName}` };
    }

    if (!stat.isFile()) {
      return { valid: false, error: 'Target path is not a file.' };
    }

    if (stat.size === 0) {
      return { valid: false, error: 'The selected file is empty (0 bytes).' };
    }

    // 2. Configurable maximum file size check
    if (stat.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      const actualMb = (stat.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${actualMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
      };
    }

    // 3. Extension check
    const ext = path.extname(normalized).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Unsupported file extension '${ext}'. Supported formats: .mp4, .mov, .webm.`,
      };
    }

    // 4. Magic bytes content inspection (read first 512 bytes)
    const fileHandle = await fs.open(normalized, 'r');
    const headerBuffer = Buffer.alloc(512);
    try {
      await fileHandle.read(headerBuffer, 0, 512, 0);
    } finally {
      await fileHandle.close();
    }

    // Verify EBML / WebM: starts with 0x1A 0x45 0xDF 0xA3
    const isEbml =
      headerBuffer[0] === 0x1a &&
      headerBuffer[1] === 0x45 &&
      headerBuffer[2] === 0xdf &&
      headerBuffer[3] === 0xa3;

    if (isEbml) {
      const headerStr = headerBuffer.toString('latin1');
      if (headerStr.includes('webm')) {
        const sanitizedKey = generateStorageKey(userId, 'webm', projectId);
        return {
          valid: true,
          detectedMimeType: 'video/webm',
          detectedExtension: 'webm',
          fileSize: stat.size,
          fileName,
          sanitizedStorageKey: sanitizedKey,
        };
      }
    }

    // Verify MP4 / MOV (ISOBMFF): bytes 4-8 contain 'ftyp' or 'moov'
    const atomType = headerBuffer.subarray(4, 8).toString('ascii');
    if (atomType === 'ftyp' || atomType === 'moov') {
      const majorBrand = headerBuffer.subarray(8, 12).toString('ascii').trim();
      const isQuickTime = majorBrand === 'qt' || ext === '.mov';
      const detectedExt: 'mp4' | 'mov' = isQuickTime ? 'mov' : 'mp4';
      const detectedMimeType = isQuickTime ? 'video/quicktime' : 'video/mp4';
      const sanitizedKey = generateStorageKey(userId, detectedExt, projectId);

      return {
        valid: true,
        detectedMimeType,
        detectedExtension: detectedExt,
        fileSize: stat.size,
        fileName,
        sanitizedStorageKey: sanitizedKey,
      };
    }

    // If extension claimed to be mp4/mov/webm but headers do not match
    logger.warn('Validator', `File content mismatch for ${fileName}. Atom/Signature not recognized.`);
    return {
      valid: false,
      error: 'File content does not match a valid MP4, MOV, or WebM video container.',
    };
  } catch (err) {
    logger.error('Validator', 'Error validating file', err);
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown validation error',
    };
  }
}

/**
 * Generates an unguessable, secure storage key enforcing tenant isolation.
 * Pattern: {userId}/{projectId}/{randomUUID}.{ext}
 */
export function generateStorageKey(
  userId: string,
  ext: 'mp4' | 'mov' | 'webm',
  projectId = 'unassigned'
): string {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sanitizedProjId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const randomId = crypto.randomUUID();
  return `${sanitizedUserId}/${sanitizedProjId}/${randomId}.${ext}`;
}
