import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn, type ChildProcess } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { logger } from '../logger';
import { getFFmpegBinaryPath, inspectMediaFile } from '../media/prober';
import { getProject } from '../projects/service';
import { exportToAss, exportToSrt, exportToWebVtt } from '../../shared/export/subtitles';
import {
  ExportVideoOptionsSchema,
  ExportSubtitlesSchema,
  type ExportVideoOptionsInput,
  type ExportSubtitlesInput,
} from '../../shared/schemas';
import type {
  ExportJobProgress,
  ExportJobStatus,
  CaptionSegment,
  CaptionStyle,
  CaptionAnimationConfig,
  AspectRatio,
  ExportResolution,
} from '../../shared/types';
import { IPC_CHANNELS, type ExportSubtitlesResult } from '../../shared/ipc';
import { getSupabaseClient } from '../supabase/client';

export interface ActiveExportJob {
  jobId: string;
  projectId: string;
  userId: string;
  status: ExportJobStatus;
  progress: number;
  stage: string;
  outputPath?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  durationMs?: number;
  error?: string | null;
  warnings?: string[];
  tempAssPath?: string;
  childProcess?: ChildProcess;
  abortController: AbortController;
  createdAt: string;
  updatedAt: string;
}

/**
 * Escapes Windows/POSIX file paths for use in FFmpeg's -vf ass=... filter.
 * Handles backslashes, colons, single quotes, spaces and Unicode.
 */
export function escapeFFmpegFilterPath(filePath: string): string {
  // Convert backslashes to forward slashes
  let escaped = filePath.replace(/\\/g, '/');
  // Escape colons (e.g., C: -> C\:)
  escaped = escaped.replace(/:/g, '\\:');
  // Escape single quotes
  escaped = escaped.replace(/'/g, "\\'");
  return escaped;
}

export function getTempExportDir(): string {
  let baseDir: string;
  try {
    baseDir = app ? app.getPath('temp') : process.env.TEMP || process.env.TMPDIR || '/tmp';
  } catch {
    baseDir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  }
  const dir = path.join(baseDir, 'autocaption_exports');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getExportTargetCanvas(
  aspectRatio: AspectRatio,
  resolution: ExportResolution,
  sourceWidth: number,
  sourceHeight: number
): { targetWidth: number; targetHeight: number } {
  const srcW = sourceWidth > 0 ? sourceWidth : 1080;
  const srcH = sourceHeight > 0 ? sourceHeight : 1920;
  const srcRatio = srcW / srcH;

  const targetRatioMap: Record<AspectRatio, number> = {
    '9:16': 9 / 16,
    '16:9': 16 / 9,
    '1:1': 1,
    '4:5': 4 / 5,
  };
  const targetRatio = targetRatioMap[aspectRatio] || 9 / 16;
  const isMatchingRatio = Math.abs(srcRatio - targetRatio) < 0.02;

  // 1. Fixed Resolution Presets
  if (resolution === '1080p') {
    switch (aspectRatio) {
      case '9:16': return { targetWidth: 1080, targetHeight: 1920 };
      case '16:9': return { targetWidth: 1920, targetHeight: 1080 };
      case '1:1': return { targetWidth: 1080, targetHeight: 1080 };
      case '4:5': return { targetWidth: 1080, targetHeight: 1350 };
    }
  }

  if (resolution === '720p') {
    switch (aspectRatio) {
      case '9:16': return { targetWidth: 720, targetHeight: 1280 };
      case '16:9': return { targetWidth: 1280, targetHeight: 720 };
      case '1:1': return { targetWidth: 720, targetHeight: 720 };
      case '4:5': return { targetWidth: 720, targetHeight: 900 };
    }
  }

  if (resolution === '4k') {
    switch (aspectRatio) {
      case '9:16': return { targetWidth: 2160, targetHeight: 3840 };
      case '16:9': return { targetWidth: 3840, targetHeight: 2160 };
      case '1:1': return { targetWidth: 2160, targetHeight: 2160 };
      case '4:5': return { targetWidth: 2160, targetHeight: 2700 };
    }
  }

  // 2. 'original' (Match Source)
  if (isMatchingRatio) {
    return { targetWidth: srcW, targetHeight: srcH };
  }

  // If aspect ratios differ, conform canvas to target aspect ratio using 1080p reference
  switch (aspectRatio) {
    case '9:16': return { targetWidth: 1080, targetHeight: 1920 };
    case '16:9': return { targetWidth: 1920, targetHeight: 1080 };
    case '1:1': return { targetWidth: 1080, targetHeight: 1080 };
    case '4:5': return { targetWidth: 1080, targetHeight: 1350 };
  }
}

export class VideoExportManager {
  private activeJobs = new Map<string, ActiveExportJob>();

  public getJob(jobId: string, userId: string): ExportJobProgress | null {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;
    // Strict ownership verification
    if (job.userId !== userId) {
      throw new Error('Access denied: You do not own this export job.');
    }
    return this.toProgress(job);
  }

  /**
   * Generates production-ready SRT or WebVTT content for a project.
   * Reflects current user-edited caption data, never unedited transcripts.
   */
  public async exportSubtitles(
    input: ExportSubtitlesInput,
    userId: string
  ): Promise<ExportSubtitlesResult> {
    const parseResult = ExportSubtitlesSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid export input' };
    }

    const { projectId, format, captionSegments, projectName } = parseResult.data;

    let projectTitle = projectName || 'AutoCaption';
    let segments: CaptionSegment[] = captionSegments || [];
    const isTransientProjectId = projectId.startsWith('proj-') || projectId.startsWith('demo-') || projectId.startsWith('temp-');

    // Security check: verify project ownership for persisted projects
    if (!isTransientProjectId) {
      const projectResult = await getProject(userId, projectId);
      if (!projectResult.success || !projectResult.project) {
        return { success: false, error: projectResult.error || 'Project not found or access denied.' };
      }
      if (!captionSegments || captionSegments.length === 0) {
        segments = projectResult.project.captionSegments || [];
        projectTitle = projectName || projectResult.project.name;
      }
    } else if (!captionSegments || captionSegments.length === 0) {
      return { success: false, error: 'No caption segments provided for transient project.' };
    }

    let content: string;
    let extension: string;

    if (format === 'srt') {
      content = exportToSrt(segments);
      extension = 'srt';
    } else {
      content = exportToWebVtt(segments, projectTitle);
      extension = 'vtt';
    }

    const safeMoniker = projectTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fileName = `${safeMoniker}_subtitles.${extension}`;

    logger.info('VideoExportManager', `Exported ${format.toUpperCase()} subtitles for project ${projectId} (${segments.length} segments)`);

    return {
      success: true,
      content,
      format,
      fileName,
    };
  }

  /**
   * Initiates an asynchronous background video rendering job with burned-in subtitles.
   */
  public async startExport(
    input: ExportVideoOptionsInput,
    userId: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const parseResult = ExportVideoOptionsSchema.safeParse(input);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0]?.message || 'Invalid export options' };
    }

    const options = parseResult.data;
    const isTransientProjectId = options.projectId.startsWith('proj-') || options.projectId.startsWith('demo-') || options.projectId.startsWith('temp-');

    // 1. Resolve Project Record (from DB with strict ownership, or current transient editor session)
    let project: { id: string; name: string; videoStoragePath: string; captionSegments: CaptionSegment[]; captionStyle: CaptionStyle };

    const projectResult = await getProject(userId, options.projectId);
    if (projectResult.success && projectResult.project) {
      project = {
        id: projectResult.project.id,
        name: options.projectName || projectResult.project.name,
        videoStoragePath: options.videoPath || projectResult.project.videoStoragePath || '',
        // Live editor segments take precedence over persisted segments
        captionSegments: options.captionSegments || projectResult.project.captionSegments || [],
        captionStyle: options.captionStyle || projectResult.project.captionStyle,
      };
    } else if (isTransientProjectId && (options.videoPath || options.captionSegments)) {
      // Allow transient / in-memory / demo projects (e.g., initial proj-1 or local file imports)
      project = {
        id: options.projectId,
        name: options.projectName || 'Exported Video',
        videoStoragePath: options.videoPath || '',
        captionSegments: options.captionSegments || [],
        captionStyle: options.captionStyle || {
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
        },
      };
    } else {
      return { success: false, error: projectResult.error || 'Project not found or access denied.' };
    }

    // 2. Resolve source video file on disk
    let videoFilePath = options.videoPath || project.videoStoragePath;

    // Check if source video is missing locally
    if (!videoFilePath || !fs.existsSync(videoFilePath)) {
      const devMediaDir = path.join(os.tmpdir(), 'autocaption_dev_media');
      if (videoFilePath && fs.existsSync(path.join(devMediaDir, path.basename(videoFilePath)))) {
        videoFilePath = path.join(devMediaDir, path.basename(videoFilePath));
      } else {
        // Fallback: check project videoStoragePath in temp cache
        const tempPath = path.join(getTempExportDir(), `src_${project.id}.mp4`);
        if (fs.existsSync(tempPath)) {
          videoFilePath = tempPath;
        } else {
          // If Supabase Storage is configured and project has a storage path, download original video
          const supabase = getSupabaseClient();
          let downloaded = false;
          if (supabase && (project.videoStoragePath || options.videoPath)) {
            const cloudPath = project.videoStoragePath || options.videoPath!;
            try {
              logger.info('VideoExportManager', `Downloading source video from storage: ${cloudPath}`);
              const { data, error } = await supabase.storage.from('videos').download(cloudPath);
              if (!error && data) {
                const buffer = Buffer.from(await data.arrayBuffer());
                await fsp.writeFile(tempPath, buffer);
                videoFilePath = tempPath;
                downloaded = true;
              }
            } catch (dlErr) {
              logger.warn('VideoExportManager', 'Failed to download from Supabase storage', dlErr);
            }
          }

          if (!downloaded && (!videoFilePath || !fs.existsSync(videoFilePath))) {
            return {
              success: false,
              error: `Source video file "${videoFilePath || 'none'}" is not available on disk or in storage. Real user exports must never use fallback test patterns.`,
            };
          }
        }
      }
    }

    // Inspect input video to ensure valid duration and dimensions
    const probe = await inspectMediaFile(videoFilePath);
    if (!probe.success || !probe.metadata || probe.metadata.durationMs <= 0) {
      return {
        success: false,
        error: probe.error || 'Failed to inspect source video file metadata. Video file may be corrupt or empty.',
      };
    }

    const meta = probe.metadata;
    const durationMs = meta.durationMs;

    // 3. Create job record
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const abortController = new AbortController();

    const activeJob: ActiveExportJob = {
      jobId,
      projectId: project.id,
      userId,
      status: 'queued',
      progress: 0,
      stage: 'Queued for rendering',
      durationMs,
      warnings: [],
      abortController,
      createdAt: now,
      updatedAt: now,
    };

    this.activeJobs.set(jobId, activeJob);
    this.broadcastProgress(activeJob);

    // 4. Run background media worker processing
    this.processExportJob(activeJob, project, videoFilePath, meta, options)
      .catch((err) => {
        logger.error('VideoExportManager', `Export job ${jobId} unhandled failure:`, err);
        activeJob.status = 'failed';
        activeJob.error = err instanceof Error ? err.message : 'Unknown rendering failure';
        this.broadcastProgress(activeJob);
        this.cleanupJobFiles(activeJob);
      });

    return { success: true, jobId };
  }

  /**
   * Main background processing worker using FFmpeg.
   */
  private async processExportJob(
    job: ActiveExportJob,
    project: { name: string; captionSegments: CaptionSegment[]; captionStyle: CaptionStyle; aspectRatio?: AspectRatio },
    videoPath: string,
    meta: { width: number; height: number; durationMs: number; hasAudio?: boolean },
    options: ExportVideoOptionsInput
  ): Promise<void> {
    const ffmpegBinary = getFFmpegBinaryPath();
    if (!ffmpegBinary) {
      throw new Error('FFmpeg processing binary is not available on this system.');
    }

    job.status = 'preparing';
    job.progress = 5;
    job.stage = 'Generating subtitle tracks';
    this.broadcastProgress(job);

    const exportDir = getTempExportDir();
    const tempAssPath = path.join(exportDir, `sub_${job.jobId}.ass`);
    const outputPath = path.join(exportDir, `export_${job.jobId}.mp4`);

    job.tempAssPath = tempAssPath;
    job.outputPath = outputPath;

    // Resolve caption style (applying any override)
    const effectiveAnimation: CaptionAnimationConfig | undefined = (project.captionStyle.animation || options.styleOverride?.animation)
      ? {
          preset: options.styleOverride?.animation?.preset || project.captionStyle.animation?.preset || 'none',
          entranceDurationMs: options.styleOverride?.animation?.entranceDurationMs ?? project.captionStyle.animation?.entranceDurationMs ?? 250,
          exitDurationMs: options.styleOverride?.animation?.exitDurationMs ?? project.captionStyle.animation?.exitDurationMs ?? 200,
          intensity: options.styleOverride?.animation?.intensity ?? project.captionStyle.animation?.intensity ?? 1.0,
          wordEmphasis: options.styleOverride?.animation?.wordEmphasis ?? project.captionStyle.animation?.wordEmphasis ?? false,
          highlightColor: options.styleOverride?.animation?.highlightColor ?? project.captionStyle.animation?.highlightColor,
          delayMs: options.styleOverride?.animation?.delayMs ?? project.captionStyle.animation?.delayMs ?? 0,
          staggerMs: options.styleOverride?.animation?.staggerMs ?? project.captionStyle.animation?.staggerMs ?? 0,
        }
      : undefined;

    const effectiveStyle: CaptionStyle = {
      ...project.captionStyle,
      ...(options.styleOverride || {}),
      animation: effectiveAnimation,
    };

    // Determine target canvas dimensions based on project/options aspect ratio and resolution
    const targetAspectRatio: AspectRatio = options.aspectRatio || project.aspectRatio || (meta.width > meta.height ? '16:9' : '9:16');
    const { targetWidth, targetHeight } = getExportTargetCanvas(
      targetAspectRatio,
      options.resolution || 'original',
      meta.width,
      meta.height
    );

    // Generate ASS Subtitles file matching target video canvas
    const assContent = exportToAss({
      segments: project.captionSegments,
      style: effectiveStyle,
      videoWidth: targetWidth,
      videoHeight: targetHeight,
      title: project.name,
      enableWordEmphasis: effectiveAnimation?.wordEmphasis !== false && effectiveStyle.hasWordEmphasis !== false,
    });

    await fsp.writeFile(tempAssPath, assContent, 'utf-8');

    // Build FFmpeg Arguments
    const escapedAss = escapeFFmpegFilterPath(tempAssPath);

    // Build video filter chain
    const vfParts: string[] = [];

    const sourceRatio = meta.width / meta.height;
    const targetRatio = targetWidth / targetHeight;
    const ratioDiff = Math.abs(sourceRatio - targetRatio);

    if (meta.width === targetWidth && meta.height === targetHeight) {
      // Exact dimension match, no scaling needed
    } else if (ratioDiff < 0.015) {
      // Proportions match: clean scale without padding or black bars!
      vfParts.push(`scale=${targetWidth}:${targetHeight}`);
    } else {
      // Proportions differ: fit within canvas with letterboxing/pillarboxing matching editor preview
      vfParts.push(
        `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`
      );
    }

    // Add burned-in subtitle filter with font directory registration
    if (options.burnInCaptions !== false) {
      const fontsDir = path.join(os.tmpdir(), 'autocaption_fonts');
      if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
      }
      const escapedFontsDir = escapeFFmpegFilterPath(fontsDir);
      vfParts.push(`ass='${escapedAss}':fontsdir='${escapedFontsDir}'`);
    }

    const vfArg = vfParts.join(',');

    // Video encoding quality flags
    let crf = '22';
    let preset = 'fast';
    let audioBitrate = '192k';

    if (options.quality === 'high') {
      crf = '18';
      preset = 'medium';
      audioBitrate = '256k';
    } else if (options.quality === 'draft') {
      crf = '28';
      preset = 'ultrafast';
      audioBitrate = '128k';
    }

    const ffmpegArgs = [
      '-y',
      '-i', videoPath,
      ...(vfArg ? ['-vf', vfArg] : []),
      ...(options.fps ? ['-r', String(options.fps)] : []),
      '-c:v', 'libx264',
      '-crf', crf,
      '-preset', preset,
      '-c:a', 'aac',
      '-ar', '48000',
      '-b:a', audioBitrate,
      '-movflags', '+faststart',
      outputPath,
    ];

    logger.info('VideoExportManager', `Starting FFmpeg render for job ${job.jobId} -> ${outputPath}`);

    job.status = 'rendering';
    job.progress = 10;
    job.stage = 'Rendering video with burned-in captions';
    this.broadcastProgress(job);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegBinary, ffmpegArgs);
      job.childProcess = child;

      let stderrLog = '';

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrLog += text;

        // Parse timecode from FFmpeg progress output: time=00:01:23.45
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch && meta.durationMs > 0) {
          const hours = parseInt(timeMatch[1] || '0', 10);
          const mins = parseInt(timeMatch[2] || '0', 10);
          const secs = parseFloat(timeMatch[3] || '0');
          const currentMs = (hours * 3600 + mins * 60 + secs) * 1000;

          const renderFraction = Math.min(1, currentMs / meta.durationMs);
          const totalProgress = Math.round(10 + renderFraction * 80); // 10% to 90%

          job.progress = totalProgress;
          job.stage = `Rendering video (${Math.round(renderFraction * 100)}%)`;
          this.broadcastProgress(job);
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
      });

      child.on('close', (code) => {
        job.childProcess = undefined;
        if (job.abortController.signal.aborted) {
          reject(new Error('Export rendering cancelled by user.'));
          return;
        }

        if (code === 0) {
          resolve();
        } else {
          logger.error('VideoExportManager', `FFmpeg render failed with exit code ${code}. Log:\n${stderrLog}`);
          reject(new Error(`FFmpeg video rendering failed with code ${code}. Check logs for details.`));
        }
      });
    });

    // 5. Verification Phase: Confirm output exists, is non-empty, and has valid media streams
    job.status = 'verifying';
    job.progress = 92;
    job.stage = 'Verifying exported media integrity and duration';
    this.broadcastProgress(job);

    if (!fs.existsSync(outputPath)) {
      throw new Error('Export verification failed: Output video file was not generated.');
    }

    const stat = await fsp.stat(outputPath);
    if (stat.size < 10000) {
      throw new Error(`Export verification failed: Output video file is incomplete (${stat.size} bytes).`);
    }

    const verified = await inspectMediaFile(outputPath);
    if (!verified.success || !verified.metadata) {
      throw new Error(`Export verification failed: Output video file is corrupted (${verified.error || 'Unreadable container'}).`);
    }

    // Verify duration consistency: Output duration must correspond to the original source duration (within 2500ms)
    const durationDiff = Math.abs(verified.metadata.durationMs - meta.durationMs);
    if (durationDiff > 2500) {
      throw new Error(
        `Export verification failed: Output video duration (${verified.metadata.durationMs}ms) does not correspond to source video (${meta.durationMs}ms).`
      );
    }

    // Verify audio stream preservation if source video had audio
    if (meta.hasAudio && !verified.metadata.hasAudio) {
      throw new Error('Export verification failed: Original audio stream was lost during rendering.');
    }

    // Frame-level decode check to confirm valid decodable streams without corruption
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
          reject(new Error(`Corrupted output video stream: ${decodeErr || `Exit code ${code}`}`));
        }
      });
    });

    job.fileSizeBytes = stat.size;
    job.durationMs = verified.metadata.durationMs;

    // 6. Storage & Signed URL Delivery
    job.status = 'uploading';
    job.progress = 96;
    job.stage = 'Preparing secure download URL';
    this.broadcastProgress(job);

    let downloadUrl: string | undefined;

    // Check if Supabase storage bucket 'exported-videos' is available
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const storagePath = `exports/${job.userId}/${job.projectId}/${job.jobId}.mp4`;
        const fileBuffer = await fsp.readFile(outputPath);

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('exported-videos')
          .upload(storagePath, fileBuffer, {
            contentType: 'video/mp4',
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          const { data: signedData } = await supabase.storage
            .from('exported-videos')
            .createSignedUrl(storagePath, 3600 * 24); // 24 hour download link

          if (signedData?.signedUrl) {
            downloadUrl = signedData.signedUrl;
          }
        }
      } catch (storageErr) {
        logger.warn('VideoExportManager', 'Cloud storage upload skipped, using local download URL:', storageErr);
      }
    }

    // If cloud signed URL wasn't generated, generate local stream URL
    if (!downloadUrl) {
      downloadUrl = `local-video://stream/?path=${encodeURIComponent(outputPath)}`;
    }

    job.downloadUrl = downloadUrl;
    job.status = 'completed';
    job.progress = 100;
    job.stage = 'Export completed successfully';
    job.updatedAt = new Date().toISOString();

    logger.info('VideoExportManager', `Export job ${job.jobId} successfully completed! File size: ${job.fileSizeBytes} bytes`);
    this.broadcastProgress(job);

    // Clean up temporary ASS subtitle file (keep the mp4)
    if (tempAssPath && fs.existsSync(tempAssPath)) {
      fsp.unlink(tempAssPath).catch(() => {});
    }
  }

  /**
   * Cancels an active export job and kills running processes.
   */
  public async cancelExport(jobId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.userId !== userId) {
      return { success: false, error: 'Access denied: You do not own this job' };
    }

    logger.info('VideoExportManager', `Cancelling export job ${jobId}`);
    job.abortController.abort();

    if (job.childProcess) {
      try {
        job.childProcess.kill('SIGKILL');
      } catch {
        // Process might already be stopped
      }
    }

    job.status = 'cancelled';
    job.stage = 'Export cancelled by user';
    this.broadcastProgress(job);
    this.cleanupJobFiles(job);

    return { success: true };
  }

  private cleanupJobFiles(job: ActiveExportJob): void {
    if (job.tempAssPath && fs.existsSync(job.tempAssPath)) {
      fsp.unlink(job.tempAssPath).catch(() => {});
    }
    // If job failed or was cancelled, remove partial output file
    if ((job.status === 'failed' || job.status === 'cancelled') && job.outputPath && fs.existsSync(job.outputPath)) {
      fsp.unlink(job.outputPath).catch(() => {});
    }
  }

  private toProgress(job: ActiveExportJob): ExportJobProgress {
    return {
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
      warnings: job.warnings,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private broadcastProgress(job: ActiveExportJob): void {
    const progress = this.toProgress(job);
    try {
      if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.EXPORT_PROGRESS, progress);
          }
        }
      }
    } catch {
      // BrowserWindow not available in headless or unit test environment
    }
  }
}

export const videoExportManager = new VideoExportManager();
