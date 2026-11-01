import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, type ChildProcess } from 'child_process';
import * as dotenv from 'dotenv';
import type { IncomingMessage, ServerResponse } from 'http';
import { GroqTranscriptionProvider } from '../src/main/transcription/providers/groqProvider';
import { extractAudioFromVideo } from '../src/main/transcription/audio/extractor';
import { normalizeTranscriptionResponse } from '../src/main/transcription/normalizer';
import { logger } from '../src/main/logger';
import { getFFmpegBinaryPath, inspectMediaFile } from '../src/main/media/prober';
import { escapeFFmpegFilterPath, getExportTargetCanvas } from '../src/main/export/videoExporter';
import { exportToAss } from '../src/shared/export/subtitles';
import type { CaptionSegment, CaptionStyle, ExportResolution, ExportQuality, AspectRatio } from '../src/shared/types';

interface DevExportJob {
  jobId: string;
  projectId: string;
  status: 'queued' | 'preparing' | 'rendering' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  outputPath?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  durationMs?: number;
  error?: string;
  tempAssPath?: string;
  childProcess?: ChildProcess;
  abortController: AbortController;
  createdAt: string;
  updatedAt: string;
}

const devExportJobs = new Map<string, DevExportJob>();

export function getDevMediaDir(): string {
  const dir = path.join(os.tmpdir(), 'autocaption_dev_media');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Ensure .env.local is loaded
const envPath = path.resolve(process.cwd(), '.env.local');
export function getGroqApiKey(): string | undefined {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  } else {
    dotenv.config({ override: true });
  }
  return process.env.GROQ_API_KEY?.trim();
}

export function devTranscriptionMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const url = req.url || '';

  if (url === '/api/dev/transcription/models' && req.method === 'GET') {
    const apiKey = getGroqApiKey();
    const hasApiKey = Boolean(apiKey && apiKey.trim() !== '' && apiKey !== 'your-groq-api-key');

    const data = {
      success: true,
      hasApiKey,
      defaultModel: 'whisper-large-v3-turbo',
      models: [
        {
          id: 'whisper-large-v3-turbo',
          name: 'Whisper Large v3 Turbo (Recommended)',
          description: 'Fastest transcription with high accuracy and low latency.',
          isDefault: true,
        },
        {
          id: 'whisper-large-v3',
          name: 'Whisper Large v3',
          description: 'Maximum multilingual quality and robust accents recognition.',
          isDefault: false,
        },
      ],
    };

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return;
  }

  // Dedicated media upload endpoint for web dev mode
  if (url.startsWith('/api/dev/media/upload') && req.method === 'POST') {
    const queryParams = new URL(url, 'http://localhost:5173').searchParams;
    const rawFileName = queryParams.get('fileName') || 'uploaded_video.mp4';
    const safeFileName = path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Empty video payload received.' }));
          return;
        }

        const mediaDir = getDevMediaDir();
        const targetPath = path.join(mediaDir, safeFileName);
        fs.writeFileSync(targetPath, buffer);

        const probe = await inspectMediaFile(targetPath);
        if (!probe.success || !probe.metadata) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: probe.error || 'Failed to inspect uploaded video.' }));
          return;
        }

        logger.info('DevMedia', `Source video stored on server: ${targetPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB, ${probe.metadata.durationMs}ms)`);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          filePath: targetPath,
          fileName: safeFileName,
          metadata: probe.metadata,
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('DevMedia', `Failed to upload media: ${msg}`);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: msg }));
      }
    });
    return;
  }

  if (url.startsWith('/api/dev/transcription/start') && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      let tempVideoPath: string | null = null;
      let tempAudioPath: string | null = null;

      try {
        const apiKey = getGroqApiKey();
        if (!apiKey || apiKey === 'your-groq-api-key') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'GROQ_API_KEY is not configured in .env.local.' }));
          return;
        }

        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Empty file body received.' }));
          return;
        }

        // Save incoming binary buffer to dev media directory
        const queryParams = new URL(url, 'http://localhost:5173').searchParams;
        const model = queryParams.get('model') || 'whisper-large-v3-turbo';
        const rawFileName = queryParams.get('fileName') || 'upload.mp4';
        const safeName = path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const langParam = queryParams.get('language') || undefined;
        const language = langParam === 'auto' ? undefined : langParam;
        const prompt = langParam === 'hinglish' ? 'Transcribe in Hinglish (Hindi mixed with English words in Roman script).' : undefined;
        const wordsPerSegmentParam = queryParams.get('wordsPerSegment');
        const wordsPerSegment = wordsPerSegmentParam ? parseInt(wordsPerSegmentParam, 10) : undefined;

        const mediaDir = getDevMediaDir();
        tempVideoPath = path.join(mediaDir, safeName);
        fs.writeFileSync(tempVideoPath, buffer);

        logger.info('DevSTT', `Extracting audio from uploaded video (${(buffer.length / 1024 / 1024).toFixed(1)} MB)...`);
        const audioInfo = await extractAudioFromVideo(tempVideoPath);
        tempAudioPath = audioInfo.audioPath;

        logger.info('DevSTT', `Submitting to Groq Whisper (${model})...`);
        const provider = new GroqTranscriptionProvider({ apiKey });
        const response = await provider.transcribe(tempAudioPath, {
          model,
          language: language === 'hinglish' ? undefined : language,
          prompt,
          timestampGranularities: ['segment', 'word'],
        });

        const captionSegments = normalizeTranscriptionResponse(response, { wordsPerSegment });
        logger.info('DevSTT', `Transcription completed: ${captionSegments.length} segments.`);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          segments: captionSegments,
          language: response.language,
          serverVideoPath: tempVideoPath,
        }));
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('DevSTT', `Dev transcription error: ${errorMsg}`);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: errorMsg }));
      } finally {
        // Keep tempVideoPath intact for subsequent video export! Only remove extracted audio
        if (tempAudioPath && fs.existsSync(tempAudioPath)) {
          try { fs.unlinkSync(tempAudioPath); } catch {}
        }
      }
    });
    return;
  }

  if (url === '/api/dev/export/video' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf-8');
        const input = JSON.parse(bodyStr || '{}') as {
          projectId: string;
          projectName?: string;
          videoPath?: string;
          aspectRatio?: AspectRatio;
          resolution?: ExportResolution;
          quality?: ExportQuality;
          fps?: number;
          burnInCaptions?: boolean;
          captionSegments?: CaptionSegment[];
          captionStyle?: CaptionStyle;
        };

        const ffmpegBinary = getFFmpegBinaryPath();
        if (!ffmpegBinary) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'FFmpeg binary not found on host system.' }));
          return;
        }

        let videoPath = input.videoPath;
        const mediaDir = getDevMediaDir();

        // 1. Resolve source video file - STRICTLY verify it exists
        if (videoPath && fs.existsSync(videoPath)) {
          // Direct valid file path on server
        } else if (videoPath && fs.existsSync(path.join(mediaDir, path.basename(videoPath)))) {
          // Found in persistent server dev media directory
          videoPath = path.join(mediaDir, path.basename(videoPath));
        } else {
          // Check if any matching media file exists in media directory
          const files = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
          const candidate = files.find((f) => f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm'));
          if (candidate) {
            videoPath = path.join(mediaDir, candidate);
          } else {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: `Original video file not found on server (${input.videoPath || 'none'}). Real exports never use test patterns; please upload the video first.`,
              })
            );
            return;
          }
        }

        // 2. Pre-render Source Video Validation
        const probe = await inspectMediaFile(videoPath);
        if (!probe.success || !probe.metadata || probe.metadata.durationMs <= 0) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: false,
              error: probe.error || 'Failed to inspect source video file metadata. Video may be corrupt.',
            })
          );
          return;
        }

        const sourceMeta = probe.metadata;
        const meta = sourceMeta;
        const sourceDurationMs = sourceMeta.durationMs;
        const sourceHasAudio = sourceMeta.hasAudio;
        const jobId = `dev-export-${Date.now()}`;
        const now = new Date().toISOString();
        const tmpDir = path.join(os.tmpdir(), 'autocaption_dev_exports');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }

        const tempAssPath = path.join(tmpDir, `sub_${jobId}.ass`);
        const outputPath = path.join(tmpDir, `export_${jobId}.mp4`);
        const abortController = new AbortController();

        const job: DevExportJob = {
          jobId,
          projectId: input.projectId,
          status: 'queued',
          progress: 5,
          stage: 'Preparing export',
          tempAssPath,
          outputPath,
          durationMs: meta.durationMs,
          downloadUrl: `/api/dev/export/download?jobId=${jobId}`,
          abortController,
          createdAt: now,
          updatedAt: now,
        };

        devExportJobs.set(jobId, job);

        // Immediate HTTP response with jobId
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, jobId }));

        // Asynchronous FFmpeg Rendering
        (async () => {
          try {
            job.status = 'preparing';
            job.stage = 'Generating subtitle tracks';

            const defaultStyle: CaptionStyle = {
              presetId: 'cinematic-trailer',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 44,
              fontWeight: 700,
              textColor: '#FFFFFF',
              textTransform: 'none',
              letterSpacing: 0,
              lineHeight: 1.2,
              textAlign: 'center',
              maxWidthPercent: 90,
              strokeColor: '#000000',
              strokeWidth: 2,
              hasShadow: true,
              shadowColor: 'rgba(0,0,0,0.8)',
              shadowBlur: 4,
              shadowOffsetY: 2,
              hasBox: false,
              boxColor: '#000000',
              boxOpacity: 0.8,
              boxPaddingX: 12,
              boxPaddingY: 8,
              boxCornerRadius: 4,
              positionYPercent: 15,
              positionXPercent: 50,
              activeWordColor: '#F59E0B',
            };

            const targetAspectRatio = input.aspectRatio || (meta.width > meta.height ? '16:9' : '9:16');
            const { targetWidth, targetHeight } = getExportTargetCanvas(
              targetAspectRatio,
              input.resolution || 'original',
              meta.width,
              meta.height
            );

            const assContent = exportToAss({
              segments: input.captionSegments || [],
              style: input.captionStyle || defaultStyle,
              videoWidth: targetWidth,
              videoHeight: targetHeight,
              title: input.projectName || 'Dev Video',
              enableWordEmphasis: true,
            });

            fs.writeFileSync(tempAssPath, assContent, 'utf-8');

            const vfParts: string[] = [];
            const sourceRatio = meta.width / meta.height;
            const targetRatio = targetWidth / targetHeight;
            const ratioDiff = Math.abs(sourceRatio - targetRatio);

            if (meta.width === targetWidth && meta.height === targetHeight) {
              // Exact match, no scaling required
            } else if (ratioDiff < 0.015) {
              // Proportions match: clean scale without padding or black bars!
              vfParts.push(`scale=${targetWidth}:${targetHeight}`);
            } else {
              // Proportions differ: fit within canvas with letterboxing/pillarboxing matching editor preview
              vfParts.push(
                `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`
              );
            }

            if (input.burnInCaptions !== false) {
              const escapedAss = escapeFFmpegFilterPath(tempAssPath);
              const fontsDir = path.join(os.tmpdir(), 'autocaption_fonts');
              if (!fs.existsSync(fontsDir)) {
                fs.mkdirSync(fontsDir, { recursive: true });
              }
              const escapedFontsDir = escapeFFmpegFilterPath(fontsDir);
              vfParts.push(`ass='${escapedAss}':fontsdir='${escapedFontsDir}'`);
            }

            const vfArg = vfParts.join(',');

            let crf = '22';
            let preset = 'fast';
            let audioBitrate = '192k';
            if (input.quality === 'high') {
              crf = '18';
              preset = 'medium';
              audioBitrate = '256k';
            } else if (input.quality === 'draft') {
              crf = '28';
              preset = 'ultrafast';
              audioBitrate = '128k';
            }

            const ffmpegArgs = [
              '-y',
              '-i', videoPath,
              ...(vfArg ? ['-vf', vfArg] : []),
              ...(input.fps ? ['-r', String(input.fps)] : []),
              '-c:v', 'libx264',
              '-crf', crf,
              '-preset', preset,
              '-c:a', 'aac',
              '-ar', '48000',
              '-b:a', audioBitrate,
              '-movflags', '+faststart',
              outputPath,
            ];

            job.status = 'rendering';
            job.progress = 15;
            job.stage = 'Rendering video with burned-in captions';

            await new Promise<void>((resolve, reject) => {
              const child = spawn(ffmpegBinary, ffmpegArgs);
              job.childProcess = child;

              child.stderr.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                if (timeMatch && meta.durationMs > 0) {
                  const hours = parseInt(timeMatch[1] || '0', 10);
                  const mins = parseInt(timeMatch[2] || '0', 10);
                  const secs = parseFloat(timeMatch[3] || '0');
                  const currentMs = (hours * 3600 + mins * 60 + secs) * 1000;
                  const renderFraction = Math.min(1, currentMs / meta.durationMs);
                  job.progress = Math.round(15 + renderFraction * 75);
                  job.stage = `Rendering video (${Math.round(renderFraction * 100)}%)`;
                }
              });

              child.on('error', (err) => reject(err));
              child.on('close', (code) => {
                job.childProcess = undefined;
                if (job.abortController.signal.aborted) {
                  reject(new Error('Export rendering cancelled by user.'));
                } else if (code === 0) {
                  resolve();
                } else {
                  reject(new Error(`FFmpeg exited with code ${code}`));
                }
              });
            });

            // Post-render Export Validation
            job.status = 'verifying';
            job.progress = 92;
            job.stage = 'Verifying exported video integrity and duration';

            if (!fs.existsSync(outputPath)) {
              throw new Error('Export verification failed: Output video file was not generated.');
            }

            const stat = fs.statSync(outputPath);
            if (stat.size < 10000) {
              throw new Error(`Export verification failed: Output video file is incomplete (${stat.size} bytes).`);
            }

            const verifiedProbe = await inspectMediaFile(outputPath);
            if (!verifiedProbe.success || !verifiedProbe.metadata) {
              throw new Error(`Export verification failed: Output video file is corrupted (${verifiedProbe.error || 'Unreadable container'}).`);
            }

            const outputMeta = verifiedProbe.metadata;

            // Strict duration check against original source video
            const durationDiffMs = Math.abs(outputMeta.durationMs - sourceDurationMs);
            if (durationDiffMs > 2500) {
              throw new Error(
                `Export duration validation failed: Output video duration (${outputMeta.durationMs}ms) does not correspond to source video (${sourceDurationMs}ms).`
              );
            }

            // Verify audio stream preserved if original had audio
            if (sourceHasAudio && !outputMeta.hasAudio) {
              throw new Error('Export audio validation failed: Original audio stream was lost during rendering.');
            }

            // Verify decodability via FFmpeg null sink
            await new Promise<void>((resolve, reject) => {
              const decodeCheck = spawn(ffmpegBinary, [
                '-v', 'error',
                '-i', outputPath,
                '-f', 'null',
                '-',
              ]);
              let decodeErr = '';
              decodeCheck.stderr.on('data', (d: Buffer) => { decodeErr += d.toString(); });
              decodeCheck.on('close', (code) => {
                if (code === 0 && !decodeErr.toLowerCase().includes('error')) {
                  resolve();
                } else {
                  reject(new Error(`Decoded output verification failed: ${decodeErr || `Exit code ${code}`}`));
                }
              });
            });

            job.fileSizeBytes = stat.size;
            job.durationMs = outputMeta.durationMs;
            job.status = 'completed';
            job.progress = 100;
            job.stage = 'Export completed successfully';
            job.updatedAt = new Date().toISOString();
          } catch (err: unknown) {
            job.status = 'failed';
            job.error = err instanceof Error ? err.message : String(err);
            job.stage = 'Rendering failed';
          } finally {
            if (fs.existsSync(tempAssPath)) {
              try { fs.unlinkSync(tempAssPath); } catch {}
            }
          }
        })();
      } catch (err: unknown) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  if (url.startsWith('/api/dev/export/status') && req.method === 'GET') {
    const queryParams = new URL(url, 'http://localhost:5173').searchParams;
    const jobId = queryParams.get('jobId') || '';
    const job = devExportJobs.get(jobId);

    if (!job) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Job not found' }));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      job: {
        jobId: job.jobId,
        projectId: job.projectId,
        status: job.status,
        progress: job.progress,
        percentage: job.progress,
        stage: job.stage,
        outputPath: job.outputPath,
        downloadUrl: job.downloadUrl,
        fileSizeBytes: job.fileSizeBytes,
        durationMs: job.durationMs,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    }));
    return;
  }

  if (url.startsWith('/api/dev/export/download') && req.method === 'GET') {
    const queryParams = new URL(url, 'http://localhost:5173').searchParams;
    const jobId = queryParams.get('jobId') || '';
    const job = devExportJobs.get(jobId);

    if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
      res.statusCode = 404;
      res.end('Exported file not found.');
      return;
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="export_${jobId}.mp4"`);
    const stream = fs.createReadStream(job.outputPath);
    stream.pipe(res);
    return;
  }

  if (url.startsWith('/api/dev/export/cancel') && req.method === 'POST') {
    const queryParams = new URL(url, 'http://localhost:5173').searchParams;
    const jobId = queryParams.get('jobId') || '';
    const job = devExportJobs.get(jobId);

    if (job) {
      job.abortController.abort();
      if (job.childProcess) {
        try { job.childProcess.kill('SIGKILL'); } catch {}
      }
      job.status = 'cancelled';
      job.stage = 'Cancelled by user';
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  next();
}
