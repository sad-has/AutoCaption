import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { app } from 'electron';
import { getFFmpegBinaryPath } from '../../media/prober';
import { logger } from '../../logger';

export interface AudioChunk {
  index: number;
  filePath: string;
  startTimeSec: number;
  durationSec: number;
  isOriginal: boolean;
}

export interface ChunkerOptions {
  maxChunkSizeBytes?: number; // Default: 24MB (Groq direct upload limit is 25MB)
  overlapSec?: number;        // Default: 2.0s
  targetChunkDurationSec?: number; // Optional override; otherwise computed from bitrate
}

// 24 MB safe threshold for Groq's 25 MB direct file upload limit
export const DEFAULT_MAX_CHUNK_BYTES = 24 * 1024 * 1024;
export const DEFAULT_OVERLAP_SEC = 2.0;

function getTempChunkDir(): string {
  let baseDir: string;
  try {
    baseDir = app ? app.getPath('temp') : process.env.TEMP || process.env.TMPDIR || '/tmp';
  } catch {
    baseDir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  }
  const dir = path.join(baseDir, 'autocaption_audio_chunks');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

interface SilenceInterval {
  start: number;
  end: number;
}

/**
 * Uses FFmpeg silencedetect to find natural pause points in speech audio.
 */
export async function detectSilenceIntervals(
  audioPath: string,
  signal?: AbortSignal
): Promise<SilenceInterval[]> {
  const ffmpegBinary = getFFmpegBinaryPath();
  if (!ffmpegBinary) {
    return [];
  }

  // Detect silence with noise threshold -30dB and minimum duration 0.3s
  const args = [
    '-i',
    audioPath,
    '-af',
    'silencedetect=noise=-30dB:d=0.3',
    '-f',
    'null',
    '-',
  ];

  try {
    const stderr = await new Promise<string>((resolve, reject) => {
      const proc = execFile(ffmpegBinary, args, { maxBuffer: 10 * 1024 * 1024 }, (_err, _out, errOut) => {
        resolve(errOut || '');
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // Ignore kill error
          }
          reject(new Error('Silence detection cancelled.'));
        });
      }
    });

    const intervals: SilenceInterval[] = [];
    const lines = stderr.split('\n');
    let currentStart: number | null = null;

    for (const line of lines) {
      const startMatch = line.match(/silence_start:\s*([\d.]+)/);
      if (startMatch && startMatch[1]) {
        currentStart = parseFloat(startMatch[1]);
      }
      const endMatch = line.match(/silence_end:\s*([\d.]+)/);
      if (endMatch && endMatch[1] && currentStart !== null) {
        const end = parseFloat(endMatch[1]);
        intervals.push({ start: currentStart, end });
        currentStart = null;
      }
    }

    return intervals;
  } catch (error) {
    logger.warn('AudioChunker', 'silencedetect failed, falling back to fixed intervals', error);
    return [];
  }
}

/**
 * Finds the best boundary cut point near a target timestamp by consulting silence intervals.
 */
function findBestCutPoint(
  targetSec: number,
  searchWindowSec: number,
  silenceIntervals: SilenceInterval[]
): number {
  const minSec = targetSec - searchWindowSec;
  const maxSec = targetSec + searchWindowSec;

  // Find silence intervals that fall within the search window
  const candidates = silenceIntervals.filter(
    (si) => si.start >= minSec && si.end <= maxSec
  );

  if (candidates.length === 0) {
    // If no complete interval is inside, check any interval overlapping the window
    const overlapping = silenceIntervals.filter(
      (si) => si.end >= minSec && si.start <= maxSec
    );
    if (overlapping.length > 0) {
      // Pick the midpoint of the closest silence interval to targetSec
      overlapping.sort((a, b) => {
        const midA = (a.start + a.end) / 2;
        const midB = (b.start + b.end) / 2;
        return Math.abs(midA - targetSec) - Math.abs(midB - targetSec);
      });
      const best = overlapping[0];
      if (!best) return targetSec;
      return Math.max(0, (best.start + best.end) / 2);
    }
    // Fall back to targetSec
    return targetSec;
  }

  // Pick candidate with midpoint closest to targetSec
  candidates.sort((a, b) => {
    const midA = (a.start + a.end) / 2;
    const midB = (b.start + b.end) / 2;
    return Math.abs(midA - targetSec) - Math.abs(midB - targetSec);
  });

  const best = candidates[0];
  if (!best) return targetSec;
  return (best.start + best.end) / 2;
}

/**
 * Slices an audio segment from startSec to endSec.
 */
async function sliceAudioSegment(
  sourcePath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
  signal?: AbortSignal
): Promise<void> {
  const ffmpegBinary = getFFmpegBinaryPath();
  if (!ffmpegBinary) {
    throw new Error('FFmpeg is required to slice audio chunks.');
  }

  const args = [
    '-y',
    '-ss',
    startSec.toFixed(3),
    '-t',
    durationSec.toFixed(3),
    '-i',
    sourcePath,
    '-acodec',
    'libmp3lame',
    '-b:a',
    '64k',
    '-ar',
    '16000',
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = execFile(ffmpegBinary, args, (err) => {
      if (err) {
        reject(new Error(`Failed to slice audio chunk: ${err.message}`));
      } else {
        resolve();
      }
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Ignore
        }
        reject(new Error('Audio chunk slicing cancelled.'));
      });
    }
  });
}

/**
 * Divides audio into speech-aware overlapping chunks if it exceeds the maximum direct upload limit.
 */
export async function chunkAudioIfNeeded(
  audioPath: string,
  totalDurationMs: number,
  options?: ChunkerOptions,
  signal?: AbortSignal
): Promise<AudioChunk[]> {
  const maxBytes = options?.maxChunkSizeBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  const overlapSec = options?.overlapSec ?? DEFAULT_OVERLAP_SEC;

  const stat = await fsp.stat(audioPath);
  const totalDurationSec = totalDurationMs > 0 ? totalDurationMs / 1000 : 0;

  // If the audio file fits within direct upload limit, return single chunk immediately
  if (stat.size <= maxBytes) {
    logger.info(
      'AudioChunker',
      `Audio (${(stat.size / (1024 * 1024)).toFixed(2)} MB) fits within provider limit (${(maxBytes / (1024 * 1024)).toFixed(2)} MB). No chunking required.`
    );
    return [
      {
        index: 0,
        filePath: audioPath,
        startTimeSec: 0,
        durationSec: totalDurationSec,
        isOriginal: true,
      },
    ];
  }

  logger.info(
    'AudioChunker',
    `Audio file size ${(stat.size / (1024 * 1024)).toFixed(2)} MB exceeds max chunk limit ${(maxBytes / (1024 * 1024)).toFixed(2)} MB. Initiating speech-aware chunking.`
  );

  // Compute target chunk duration based on bytes/sec
  const bytesPerSec = totalDurationSec > 0 ? stat.size / totalDurationSec : 8000; // ~8KB/s for 64k mp3
  // Target around 80% of maxBytes to leave safe headroom
  const targetBytes = Math.floor(maxBytes * 0.8);
  const targetChunkDurationSec = options?.targetChunkDurationSec ?? Math.max(60, targetBytes / bytesPerSec);

  // Detect silence points across the audio
  const silenceIntervals = await detectSilenceIntervals(audioPath, signal);
  logger.info(
    'AudioChunker',
    `Detected ${silenceIntervals.length} silence intervals for speech-aware splitting.`
  );

  const chunkDir = getTempChunkDir();
  const chunks: AudioChunk[] = [];
  let currentStartSec = 0;
  let chunkIndex = 0;

  while (currentStartSec < totalDurationSec) {
    if (signal?.aborted) {
      await cleanupAudioChunks(chunks);
      throw new Error('Audio chunking cancelled.');
    }

    const nominalEndSec = Math.min(totalDurationSec, currentStartSec + targetChunkDurationSec);

    let cutPointSec = nominalEndSec;
    // If we're not at the end of the file, find the natural silence cut point
    if (nominalEndSec < totalDurationSec) {
      // Search window: +/- 30 seconds around nominal end
      cutPointSec = findBestCutPoint(nominalEndSec, 30, silenceIntervals);
      // Ensure we make reasonable forward progress
      if (cutPointSec <= currentStartSec + 10) {
        cutPointSec = nominalEndSec;
      }
    }

    const chunkDuration = cutPointSec - currentStartSec;
    const chunkFileName = `chunk_${Date.now()}_${chunkIndex}.mp3`;
    const chunkPath = path.join(chunkDir, chunkFileName);

    logger.info(
      'AudioChunker',
      `Slicing chunk ${chunkIndex}: ${currentStartSec.toFixed(2)}s to ${cutPointSec.toFixed(2)}s (duration: ${chunkDuration.toFixed(2)}s)`
    );

    await sliceAudioSegment(audioPath, chunkPath, currentStartSec, chunkDuration, signal);

    chunks.push({
      index: chunkIndex,
      filePath: chunkPath,
      startTimeSec: currentStartSec,
      durationSec: chunkDuration,
      isOriginal: false,
    });

    if (cutPointSec >= totalDurationSec) {
      break;
    }

    // Step forward, applying overlap
    currentStartSec = Math.max(0, cutPointSec - overlapSec);
    chunkIndex++;
  }

  logger.info('AudioChunker', `Created ${chunks.length} speech-aware audio chunks.`);
  return chunks;
}

/**
 * Cleans up temporary audio chunk files created on disk.
 */
export async function cleanupAudioChunks(chunks: AudioChunk[]): Promise<void> {
  for (const chunk of chunks) {
    if (!chunk.isOriginal && fs.existsSync(chunk.filePath)) {
      try {
        await fsp.unlink(chunk.filePath);
      } catch (err) {
        logger.warn('AudioChunker', `Failed to delete temp chunk file ${chunk.filePath}`, err);
      }
    }
  }
}
