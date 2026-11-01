import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { app } from 'electron';
import { getFFmpegBinaryPath } from '../../media/prober';
import { logger } from '../../logger';

export interface ExtractedAudioInfo {
  audioPath: string;
  fileSizeBytes: number;
  durationMs: number;
}

function getTempAudioDir(): string {
  let baseDir: string;
  try {
    baseDir = app ? app.getPath('temp') : process.env.TEMP || process.env.TMPDIR || '/tmp';
  } catch {
    baseDir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  }
  const dir = path.join(baseDir, 'autocaption_audio_cache');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Extracts 16kHz mono audio from video file using FFmpeg.
 * Produces optimized 64kbps MP3 speech audio suitable for Whisper speech models.
 */
export async function extractAudioFromVideo(
  videoPath: string,
  signal?: AbortSignal
): Promise<ExtractedAudioInfo> {
  const ffmpegBinary = getFFmpegBinaryPath();
  if (!ffmpegBinary) {
    throw new Error('FFmpeg decoder engine is not available on this system.');
  }

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const audioDir = getTempAudioDir();
  const audioId = crypto.randomUUID();
  const outputPath = path.join(audioDir, `audio_${audioId}.mp3`);

  logger.info('AudioExtractor', `Extracting audio from ${path.basename(videoPath)} -> ${outputPath}`);

  if (signal?.aborted) {
    throw new Error('Audio extraction cancelled.');
  }

  // FFmpeg command to extract 16kHz mono audio optimized for Whisper
  const args = [
    '-y',
    '-i',
    videoPath,
    '-vn',                 // Disable video recording
    '-ar',                 // Audio sample rate: 16000Hz (Whisper native sample rate)
    '16000',
    '-ac',                 // Audio channels: 1 (mono)
    '1',
    '-b:a',                // Bitrate: 64kbps (compact speech audio)
    '64k',
    '-f',
    'mp3',
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const process = execFile(ffmpegBinary, args, { maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) {
        logger.error('AudioExtractor', `FFmpeg audio extraction error: ${err.message}`, stderr);
        reject(new Error(`Failed to extract audio from video: ${err.message}`));
      } else {
        resolve();
      }
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        try {
          process.kill('SIGKILL');
        } catch {
          // Ignore kill error
        }
        reject(new Error('Audio extraction cancelled.'));
      });
    }
  });

  const stat = await fsp.stat(outputPath);

  // Measure audio duration using FFmpeg probe
  let durationMs = 0;
  try {
    const stderr = await new Promise<string>((resolve) => {
      execFile(ffmpegBinary, ['-i', outputPath], (_e, _out, err) => {
        resolve(err || '');
      });
    });

    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    if (match && match[1] && match[2] && match[3]) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = parseFloat(match[3]);
      durationMs = Math.round((h * 3600 + m * 60 + s) * 1000);
    }
  } catch (durErr) {
    logger.warn('AudioExtractor', 'Could not parse exact audio duration', durErr);
  }

  logger.info(
    'AudioExtractor',
    `Audio extracted successfully: ${(stat.size / 1024).toFixed(1)} KB, duration: ${durationMs}ms`
  );

  return {
    audioPath: outputPath,
    fileSizeBytes: stat.size,
    durationMs,
  };
}
