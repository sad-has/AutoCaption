import { protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { logger } from './logger';

export const MEDIA_SCHEME = 'local-video';

const ALLOWED_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.m4v',
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.flac',
]);

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
};

/**
 * Must be registered before Electron app 'ready' event.
 */
export function registerMediaPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
  logger.info('Protocol', `Privileges registered for scheme: ${MEDIA_SCHEME}`);
}

/**
 * Sets up custom protocol handler for streaming local video files with Range support.
 */
export function registerLocalVideoProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      const encodedPath = parsedUrl.searchParams.get('path');

      if (!encodedPath) {
        logger.warn('Protocol', 'Rejecting media request: Missing path parameter');
        return new Response('Missing file path', { status: 400 });
      }

      // parsedUrl.searchParams.get already decodes URL query percent-encoding.
      // Do not double-decode to avoid URIError on paths containing literal '%' or special chars.
      const filePath = path.normalize(encodedPath);

      // Security check 1: Must be absolute path
      if (!path.isAbsolute(filePath)) {
        logger.warn('Protocol', `Rejecting media request: Non-absolute path ${filePath}`);
        return new Response('Invalid path: Must be absolute', { status: 403 });
      }

      // Security check 2: Whitelisted media extension
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        logger.warn('Protocol', `Rejecting media request: Disallowed extension ${ext}`);
        return new Response('Disallowed file extension', { status: 403 });
      }

      // Check if file exists and get stats
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(filePath);
      } catch (_statErr) {
        logger.warn('Protocol', `File not found on disk: ${filePath}`);
        return new Response('File not found', { status: 404 });
      }

      if (!stat.isFile()) {
        logger.warn('Protocol', `Target is not a regular file: ${filePath}`);
        return new Response('Target is not a file', { status: 403 });
      }

      const fileSize = stat.size;
      const mimeType = MIME_MAP[ext] || 'application/octet-stream';
      const rangeHeader = request.headers.get('range');

      // Range request handling for video scrubbing/seeking (HTTP 206)
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0] || '0', 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
          return new Response('Requested range not satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          });
        }

        const clampedEnd = Math.min(end, fileSize - 1);
        const chunkSize = clampedEnd - start + 1;

        const nodeStream = fs.createReadStream(filePath, { start, end: clampedEnd });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${clampedEnd}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Full file stream response (HTTP 200)
      const nodeStream = fs.createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(fileSize),
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      logger.error('Protocol', 'Unhandled error streaming video', error);
      return new Response('Internal media stream error', { status: 500 });
    }
  });

  logger.info('Protocol', `Handler registered for ${MEDIA_SCHEME}://`);
}

/**
 * Generates the local stream URL for a file path.
 */
export function getLocalVideoStreamUrl(filePath: string): string {
  const normalized = path.normalize(filePath);
  return `${MEDIA_SCHEME}://stream/?path=${encodeURIComponent(normalized)}`;
}
