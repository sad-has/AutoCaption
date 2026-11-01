import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import type { MediaInspectResult, MediaMetadata } from '../../shared/ipc';
import type { AspectRatio } from '../../shared/types';
import { getLocalVideoStreamUrl } from '../protocol';
import { logger } from '../logger';

// Codecs Chromium decodes natively with hardware acceleration
const BROWSER_SUPPORTED_VIDEO_CODECS = new Set(['h264', 'avc1', 'vp8', 'vp9', 'av1', 'theora']);

export function getFFmpegBinaryPath(): string | null {
  const mod = ffmpegStatic as unknown;
  if (typeof mod === 'string' && mod.length > 0) return mod;
  if (
    mod &&
    typeof mod === 'object' &&
    'default' in mod &&
    typeof (mod as { default: unknown }).default === 'string'
  ) {
    return (mod as { default: string }).default;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('ffmpeg-static') as unknown;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && 'default' in raw) {
      return (raw as { default: string }).default;
    }
  } catch {
    // Ignore fallback failure
  }

  return null;
}

function determineAspectRatio(width: number, height: number): AspectRatio {
  if (width <= 0 || height <= 0) return '9:16';
  const ratio = width / height;

  const diff9x16 = Math.abs(ratio - 9 / 16);
  const diff16x9 = Math.abs(ratio - 16 / 9);
  const diff1x1 = Math.abs(ratio - 1);
  const diff4x5 = Math.abs(ratio - 4 / 5);

  const minDiff = Math.min(diff9x16, diff16x9, diff1x1, diff4x5);
  if (minDiff === diff9x16) return '9:16';
  if (minDiff === diff16x9) return '16:9';
  if (minDiff === diff4x5) return '4:5';
  return '1:1';
}

function parseFFmpegStderr(stderr: string): {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAudio: boolean;
} {
  // 1. Duration: 00:00:15.50
  let durationMs = 0;
  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
  if (durationMatch && durationMatch[1] && durationMatch[2] && durationMatch[3]) {
    const hours = parseInt(durationMatch[1], 10);
    const minutes = parseInt(durationMatch[2], 10);
    const seconds = parseFloat(durationMatch[3]);
    durationMs = Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  // 2. Video stream: Stream #0:0: Video: h264 ..., 1080x1920
  let videoCodec = 'unknown';
  let width = 0;
  let height = 0;
  const videoMatch = stderr.match(/Stream #\d+:\d+.*?: Video: ([^,\s]+).*?,\s*(\d{2,5})x(\d{2,5})/);
  if (videoMatch && videoMatch[1] && videoMatch[2] && videoMatch[3]) {
    videoCodec = videoMatch[1].toLowerCase();
    width = parseInt(videoMatch[2], 10);
    height = parseInt(videoMatch[3], 10);
  }

  // 3. FPS
  let fps = 30;
  const fpsMatch = stderr.match(/(\d+\.?\d*)\s*fps/);
  if (fpsMatch && fpsMatch[1]) {
    fps = Math.round(parseFloat(fpsMatch[1]));
  }

  // 4. Audio stream
  const audioMatch = stderr.match(/Stream #\d+:\d+.*?: Audio: ([^,\s]+)/);
  const audioCodec = audioMatch && audioMatch[1] ? audioMatch[1].toLowerCase() : null;

  return {
    durationMs,
    width,
    height,
    fps,
    videoCodec,
    audioCodec,
    hasAudio: !!audioMatch,
  };
}

/**
 * Inspects a video or audio file on disk, returning validated media metadata.
 * Uses FFmpeg when available, but gracefully falls back to browser detection if FFmpeg cannot probe.
 */
export async function inspectMediaFile(filePath: string): Promise<MediaInspectResult> {
  try {
    const normalized = path.normalize(filePath);

    // 1. Check if path exists
    let stat;
    try {
      stat = await fs.stat(normalized);
    } catch {
      logger.warn('Prober', `File not found: ${normalized}`);
      return {
        success: false,
        errorType: 'not_found',
        error: `File could not be found at path: ${path.basename(normalized)}`,
      };
    }

    if (!stat.isFile()) {
      return {
        success: false,
        errorType: 'invalid_path',
        error: 'Specified path is a directory, not a video file.',
      };
    }

    if (stat.size === 0) {
      return {
        success: false,
        errorType: 'probe_failed',
        error: 'The selected file is empty (0 bytes).',
      };
    }

    const streamUrl = getLocalVideoStreamUrl(normalized);
    const fileName = path.basename(normalized);
    const ext = path.extname(normalized).toLowerCase();

    // 2. Try FFmpeg metadata probe
    const ffmpegBinary = getFFmpegBinaryPath();
    if (ffmpegBinary) {
      try {
        const stderrOutput = await new Promise<string>((resolve, reject) => {
          execFile(
            ffmpegBinary,
            ['-i', normalized],
            { maxBuffer: 10 * 1024 * 1024 },
            (error, _stdout, stderr) => {
              if (stderr) {
                resolve(stderr);
              } else if (error) {
                reject(error);
              } else {
                resolve('');
              }
            }
          );
        });

        if (
          stderrOutput.includes('Invalid data found when processing input') ||
          stderrOutput.includes('does not contain any stream') ||
          stderrOutput.includes('Unknown format')
        ) {
          logger.warn('Prober', `Invalid media data in: ${normalized}`);
          return {
            success: false,
            errorType: 'unsupported_format',
            error: 'The selected file does not contain a recognized video or audio stream.',
          };
        }

        const parsed = parseFFmpegStderr(stderrOutput);

        if (parsed.width > 0 && parsed.height > 0) {
          const aspectRatio = determineAspectRatio(parsed.width, parsed.height);
          const isSupportedByBrowser = BROWSER_SUPPORTED_VIDEO_CODECS.has(parsed.videoCodec);

          let warning: string | undefined;
          if (!isSupportedByBrowser) {
            warning = `Video uses '${parsed.videoCodec}' codec. Standard browser playback may require transcoding.`;
          }

          const metadata: MediaMetadata = {
            filePath: normalized,
            fileName,
            fileSize: stat.size,
            durationMs: parsed.durationMs,
            width: parsed.width,
            height: parsed.height,
            aspectRatio,
            fps: parsed.fps,
            videoCodec: parsed.videoCodec,
            audioCodec: parsed.audioCodec,
            hasAudio: parsed.hasAudio,
            mimeType: ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : 'video/mp4',
            streamUrl,
            isSupportedByBrowser,
            warning,
          };

          logger.info(
            'Prober',
            `Media probed via FFmpeg: ${fileName} (${parsed.width}x${parsed.height}, ${parsed.durationMs}ms, codec: ${parsed.videoCodec})`
          );

          return { success: true, metadata };
        }
      } catch (probeErr) {
        logger.warn('Prober', 'FFmpeg probe threw error, falling back to browser detection', probeErr);
      }
    } else {
      logger.warn('Prober', 'FFmpeg binary not detected on system, delegating metadata to browser player');
    }

    // 3. Fallback: Allow browser <video> element to load and detect metadata directly
    const isSupportedByBrowser = ['.mp4', '.m4v', '.webm', '.mov'].includes(ext);
    const metadata: MediaMetadata = {
      filePath: normalized,
      fileName,
      fileSize: stat.size,
      durationMs: 0, // Populated by <video> onLoadedMetadata
      width: 1920,
      height: 1080,
      aspectRatio: '9:16',
      fps: 30,
      videoCodec: 'unknown',
      audioCodec: null,
      hasAudio: true,
      mimeType: ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : 'video/mp4',
      streamUrl,
      isSupportedByBrowser,
    };

    logger.info('Prober', `Media metadata initialized (browser fallback): ${fileName}`);
    return { success: true, metadata };
  } catch (err) {
    logger.error('Prober', 'Error inspecting media file', err);
    return {
      success: false,
      errorType: 'probe_failed',
      error: err instanceof Error ? err.message : 'Unknown media inspection failure.',
    };
  }
}
