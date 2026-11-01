import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { logger } from '../logger';
import { extractAudioFromVideo } from './audio/extractor';
import { chunkAudioIfNeeded, cleanupAudioChunks, type AudioChunk } from './audio/chunker';
import { stitchChunkResponses, type ChunkWithResponse } from './stitching';
import { normalizeTranscriptionResponse } from './normalizer';
import { GroqTranscriptionProvider } from './providers/groqProvider';
import { MockTranscriptionProvider } from './providers/mockProvider';
import type { TranscriptionProvider, TranscriptionResponse } from './types';
import { getProject, updateProject, upsertLocalProject } from '../projects/service';
import { StartTranscriptionSchema, type StartTranscriptionInput } from '../../shared/schemas';
import type { CaptionSegment, TranscriptionJobProgress, TranscriptionJobStatus, ProjectRecord } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/ipc';

export interface ActiveJob {
  jobId: string;
  projectId: string;
  userId: string;
  status: TranscriptionJobStatus;
  progress: number;
  stage: string;
  error?: string;
  result?: CaptionSegment[];
  abortController: AbortController;
  createdAt: number;
}

export class TranscriptionJobManager {
  private activeJobs = new Map<string, ActiveJob>();
  private defaultProvider: TranscriptionProvider | null = null;

  constructor() {
    this.initDefaultProvider();
  }

  private initDefaultProvider(): void {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (apiKey && apiKey !== 'your-groq-api-key') {
      this.defaultProvider = new GroqTranscriptionProvider({ apiKey });
      logger.info('TranscriptionJobManager', 'Initialized GroqTranscriptionProvider with configured API key.');
    } else if (process.env.USE_MOCK_TRANSCRIPTION === 'true' || process.env.NODE_ENV === 'test') {
      this.defaultProvider = new MockTranscriptionProvider();
      logger.info('TranscriptionJobManager', 'Initialized MockTranscriptionProvider for test/mock environment.');
    } else {
      this.defaultProvider = null;
    }
  }

  public getProvider(): TranscriptionProvider {
    // Re-check env in case API key was loaded or updated
    if (!this.defaultProvider) {
      this.initDefaultProvider();
    }
    if (!this.defaultProvider) {
      throw new Error(
        'Groq API key is not configured. Please set GROQ_API_KEY in your .env.local file or application settings.'
      );
    }
    return this.defaultProvider;
  }

  public setProvider(provider: TranscriptionProvider): void {
    this.defaultProvider = provider;
  }

  public getSupportedModels() {
    try {
      return this.getProvider().getSupportedModels();
    } catch {
      // Fallback model list if key is not yet set
      return [
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
      ];
    }
  }

  public getJob(jobId: string): TranscriptionJobProgress | null {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;
    return {
      jobId: job.jobId,
      projectId: job.projectId,
      status: job.status,
      percentage: job.progress,
      progress: job.progress,
      stage: job.stage,
      error: job.error,
    };
  }

  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      logger.warn('TranscriptionJobManager', `Attempted to cancel nonexistent job: ${jobId}`);
      return false;
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false;
    }

    logger.info('TranscriptionJobManager', `Cancelling transcription job ${jobId}`);
    job.abortController.abort();
    job.status = 'cancelled';
    job.stage = 'Transcription cancelled by user.';
    this.broadcastProgress(job);
    return true;
  }

  private broadcastProgress(job: ActiveJob): void {
    const payload: TranscriptionJobProgress = {
      jobId: job.jobId,
      projectId: job.projectId,
      status: job.status,
      percentage: job.progress,
      progress: job.progress,
      stage: job.stage,
      error: job.error,
      captionSegments: job.result,
    };

    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.TRANSCRIPTION_PROGRESS, payload);
        }
      }
    } catch (err) {
      logger.warn('TranscriptionJobManager', 'Failed to broadcast progress via IPC', err);
    }
  }

  /**
   * Starts an asynchronous transcription job.
   */
  public async startTranscription(
    userId: string,
    rawInput: StartTranscriptionInput,
    providerOverride?: TranscriptionProvider
  ): Promise<{ jobId: string; status: TranscriptionJobStatus }> {
    const parseResult = StartTranscriptionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new Error(parseResult.error.issues[0]?.message || 'Invalid transcription options.');
    }

    const input = parseResult.data;
    const provider = providerOverride || this.getProvider();

    const isTransientProjectId =
      input.projectId.startsWith('proj-') ||
      input.projectId.startsWith('demo-') ||
      input.projectId.startsWith('temp-');

    // 1. Ownership and Project Verification
    let project: ProjectRecord;
    const projectResult = await getProject(userId, input.projectId);
    if (projectResult.success && projectResult.project) {
      project = projectResult.project;
    } else if (isTransientProjectId) {
      // Allow transient / in-memory active project session (e.g. initial proj-1)
      const now = new Date().toISOString();
      const transientProject: ProjectRecord = {
        id: input.projectId,
        userId,
        name: 'Viral Short Project #1',
        aspectRatio: '9:16',
        captionStyle: {
          presetId: 'hormozi',
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 48,
          fontWeight: 900,
          allCaps: true,
          letterSpacing: 1.5,
          lineHeight: 1.15,
          textColor: '#FFFFFF',
          activeWordColor: '#10B981',
          strokeColor: '#000000',
          strokeWidth: 6,
          hasShadow: true,
          shadowColor: 'rgba(0,0,0,0.8)',
          shadowBlur: 14,
          shadowOffsetY: 4,
          hasBox: false,
          boxColor: 'rgba(0,0,0,0.6)',
          boxPaddingX: 16,
          boxPaddingY: 8,
          boxCornerRadius: 12,
          positionYPercent: 22,
          positionXPercent: 50,
        },
        captionSegments: [],
        videoId: null,
        videoStoragePath: input.videoFilePath || null,
        videoName: input.videoFilePath ? path.basename(input.videoFilePath) : null,
        videoDurationMs: null,
        videoWidth: null,
        videoHeight: null,
        videoFps: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      project = upsertLocalProject(transientProject);
    } else {
      throw new Error(projectResult.error || 'Project not found or access denied.');
    }

    // 2. Identify Video File Path
    let videoFilePath = input.videoFilePath;
    if (!videoFilePath) {
      if (project.videoStoragePath && fs.existsSync(project.videoStoragePath)) {
        videoFilePath = project.videoStoragePath;
      }
    }

    if (!videoFilePath || !fs.existsSync(videoFilePath)) {
      throw new Error(
        'Video file path not found or inaccessible on disk. Please ensure the video is loaded.'
      );
    }

    const jobId = crypto.randomUUID();
    const abortController = new AbortController();

    const job: ActiveJob = {
      jobId,
      projectId: input.projectId,
      userId,
      status: 'queued',
      progress: 0,
      stage: 'Job queued for transcription.',
      abortController,
      createdAt: Date.now(),
    };

    this.activeJobs.set(jobId, job);
    this.broadcastProgress(job);

    // Run processing asynchronously in background
    this.runJobPipeline(job, videoFilePath, input, provider).catch((err) => {
      logger.error('TranscriptionJobManager', `Pipeline failure for job ${jobId}: ${err.message}`, err);
    });

    return { jobId, status: 'queued' };
  }

  private async runJobPipeline(
    job: ActiveJob,
    videoPath: string,
    input: StartTranscriptionInput,
    provider: TranscriptionProvider
  ): Promise<void> {
    let extractedAudioPath: string | null = null;
    let chunks: AudioChunk[] = [];

    try {
      job.status = 'processing';
      job.progress = 5;
      job.stage = 'Extracting audio from video...';
      this.broadcastProgress(job);

      if (job.abortController.signal.aborted) {
        throw new Error('Transcription cancelled.');
      }

      // Step 1: FFmpeg audio extraction (16kHz mono MP3)
      const audioInfo = await extractAudioFromVideo(videoPath, job.abortController.signal);
      extractedAudioPath = audioInfo.audioPath;

      job.progress = 20;
      job.stage = 'Analyzing audio chunks and speech boundaries...';
      this.broadcastProgress(job);

      if (job.abortController.signal.aborted) {
        throw new Error('Transcription cancelled.');
      }

      // Step 2: Speech-aware chunking if file size exceeds provider limit
      const maxBytes = input.maxChunkBytes || 24 * 1024 * 1024;
      chunks = await chunkAudioIfNeeded(
        extractedAudioPath,
        audioInfo.durationMs,
        { maxChunkSizeBytes: maxBytes },
        job.abortController.signal
      );

      // Step 3: Transcription of chunks
      const chunkResults: ChunkWithResponse[] = [];
      const totalChunks = chunks.length;

      // Handle Hinglish prompt conditioning if requested
      let prompt = undefined;
      let language = input.language;

      if (language === 'hinglish') {
        prompt = 'Transcribe in Hinglish (Hindi mixed with English words in Roman script). Keep common Hindi words and English technical terms accurate.';
        // Whisper handles Hinglish well with prompt conditioning when language is left unset or set to auto
        language = undefined;
      } else if (language === 'auto' || !language) {
        language = undefined;
      }

      for (let i = 0; i < totalChunks; i++) {
        if (job.abortController.signal.aborted) {
          throw new Error('Transcription cancelled.');
        }

        const chunk = chunks[i];
        if (!chunk) continue;
        const chunkProgressBase = 20 + Math.round((i / totalChunks) * 65);
        job.progress = chunkProgressBase;
        job.stage = totalChunks > 1
          ? `Transcribing chunk ${i + 1} of ${totalChunks} with ${input.model}...`
          : `Transcribing audio with ${input.model}...`;
        this.broadcastProgress(job);

        // Retry chunk up to 2 times on transient failures
        let response: TranscriptionResponse | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            response = await provider.transcribe(chunk.filePath, {
              model: input.model,
              language,
              prompt,
              temperature: input.temperature ?? 0,
              timestampGranularities: ['segment', 'word'],
              signal: job.abortController.signal,
            });
            break;
          } catch (chunkErr: unknown) {
            lastError = chunkErr instanceof Error ? chunkErr : new Error(String(chunkErr));
            logger.warn(
              'TranscriptionJobManager',
              `Chunk ${i} attempt ${attempt} failed: ${lastError.message}`
            );
            if (job.abortController.signal.aborted) {
              throw lastError;
            }
            if (attempt < 3) {
              await new Promise((res) => setTimeout(res, 1000 * attempt));
            }
          }
        }

        if (!response) {
          throw lastError || new Error(`Failed to transcribe audio chunk ${i + 1}`);
        }

        chunkResults.push({ chunk, response });
      }

      if (job.abortController.signal.aborted) {
        throw new Error('Transcription cancelled.');
      }

      // Step 4: Stitch chunk responses & correct boundary seam timestamps
      job.progress = 88;
      job.stage = 'Stitching segments and normalizing timestamps...';
      this.broadcastProgress(job);

      const stitched = stitchChunkResponses(chunkResults);

      // Step 5: Normalize into CaptionSegment[]
      const captionSegments = normalizeTranscriptionResponse(stitched, {
        wordsPerSegment: input.wordsPerSegment,
      });

      // Step 6: Save captions into the user's project
      job.progress = 95;
      job.stage = 'Saving captions to project...';
      this.broadcastProgress(job);

      const latestProjectResult = await getProject(job.userId, job.projectId);
      if (latestProjectResult.success && latestProjectResult.project) {
        const current = latestProjectResult.project;
        await updateProject(job.userId, {
          id: current.id,
          version: current.version,
          captionSegments,
        });
      }

      job.result = captionSegments;
      job.status = 'completed';
      job.progress = 100;
      job.stage = `Transcription completed! ${captionSegments.length} segments generated.`;
      this.broadcastProgress(job);

      logger.info(
        'TranscriptionJobManager',
        `Job ${job.jobId} completed successfully: ${captionSegments.length} segments created.`
      );
    } catch (err: unknown) {
      const isAbort = job.abortController.signal.aborted;
      job.status = isAbort ? 'cancelled' : 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      job.stage = isAbort ? 'Transcription cancelled.' : `Transcription failed: ${job.error}`;
      this.broadcastProgress(job);
      logger.error('TranscriptionJobManager', `Job ${job.jobId} error: ${job.error}`);
    } finally {
      // Safe cleanup of temporary files
      if (chunks.length > 0) {
        await cleanupAudioChunks(chunks);
      }
      if (extractedAudioPath && fs.existsSync(extractedAudioPath)) {
        try {
          await fsp.unlink(extractedAudioPath);
        } catch (cleanupErr) {
          logger.warn('TranscriptionJobManager', `Failed to delete temp extracted audio`, cleanupErr);
        }
      }
    }
  }
}

// Global singleton instance
export const transcriptionJobManager = new TranscriptionJobManager();
