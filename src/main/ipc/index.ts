import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, type OpenFileDialogOptions, type AppSettings } from '../../shared/ipc';
import { logger } from '../logger';
import { handleOpenFileDialog, handleSaveFileDialog } from './dialogs';
import { handleGetSystemInfo, handleGetRecentLogs } from './system';
import {
  handleGetSettings,
  handleSaveSettings,
  handleGetCacheInfo,
  handleClearCache,
  handleListModels,
} from './settings';
import {
  handleWindowMinimize,
  handleWindowMaximize,
  handleWindowClose,
  handleWindowIsMaximized,
  handleShellOpenExternal,
  handleShellShowInFolder,
} from './window';
import { inspectMediaFile } from '../media/prober';
import { getCurrentUserSession } from '../supabase/client';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  duplicateProject,
  deleteProject,
  recoverProject,
} from '../projects/service';
import {
  startVideoUpload,
  retryVideoUpload,
  cancelVideoUpload,
  createVideoSignedUrl,
} from '../upload/uploader';
import { transcriptionJobManager } from '../transcription/jobManager';
import { videoExportManager } from '../export/videoExporter';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  DuplicateProjectInput,
  DeleteProjectInput,
  UploadVideoInput,
  RetryUploadInput,
  CancelUploadInput,
  SignedUrlInput,
  StartTranscriptionInput,
  CancelTranscriptionInput,
  ExportVideoOptionsInput,
  ExportSubtitlesInput,
  CancelExportInput,
} from '../../shared/schemas';
import type {
  StartTranscriptionResult,
  GetModelsResult,
  TranscriptionJobResult,
  ExportStartResult,
  ExportSubtitlesResult,
  ExportJobResult,
} from '../../shared/ipc';

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  logger.info('IPC', 'Registering typed IPC handlers');

  // File Dialogs
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async (event, options?: OpenFileDialogOptions) => {
    const targetWin = BrowserWindow.fromWebContents(event.sender) || getWindow();
    return handleOpenFileDialog(targetWin, options);
  });

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (
      event,
      options: {
        sourcePath: string;
        suggestedName?: string;
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }
    ) => {
      const targetWin = BrowserWindow.fromWebContents(event.sender) || getWindow();
      return handleSaveFileDialog(targetWin, options);
    }
  );

  // Media Inspection & Probing
  ipcMain.handle(IPC_CHANNELS.MEDIA_INSPECT_FILE, async (_event, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return {
        success: false,
        errorType: 'invalid_path',
        error: 'A valid file path must be provided.',
      };
    }
    return inspectMediaFile(filePath);
  });

  // System & Diagnostics
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, async () => {
    return handleGetSystemInfo();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_LOGS, async () => {
    return handleGetRecentLogs();
  });

  // Settings & Storage
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return handleGetSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, settings: AppSettings) => {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings object provided');
    }
    return handleSaveSettings(settings);
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_CACHE_INFO, async () => {
    return handleGetCacheInfo();
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_CLEAR_CACHE, async () => {
    return handleClearCache();
  });

  // Models Management
  ipcMain.handle(IPC_CHANNELS.MODELS_LIST, async () => {
    return handleListModels();
  });

  // Window Controls
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async () => {
    handleWindowMinimize(getWindow());
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async () => {
    return handleWindowMaximize(getWindow());
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async () => {
    handleWindowClose(getWindow());
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, async () => {
    return handleWindowIsMaximized(getWindow());
  });

  // Safe External Shell
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_event, url: string) => {
    if (typeof url !== 'string') return false;
    return handleShellOpenExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, async (_event, itemPath: string) => {
    if (typeof itemPath !== 'string') return false;
    return handleShellShowInFolder(itemPath);
  });

  // Project Management (Supabase PostgreSQL with RLS)
  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, async () => {
    const session = getCurrentUserSession();
    return listProjects(session.userId);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_GET, async (_event, projectId: string) => {
    const session = getCurrentUserSession();
    return getProject(session.userId, projectId);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_CREATE, async (_event, input: CreateProjectInput) => {
    const session = getCurrentUserSession();
    return createProject(session.userId, input);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_UPDATE, async (_event, input: UpdateProjectInput) => {
    const session = getCurrentUserSession();
    return updateProject(session.userId, input);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_DUPLICATE, async (_event, input: DuplicateProjectInput) => {
    const session = getCurrentUserSession();
    return duplicateProject(session.userId, input);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_DELETE, async (_event, input: DeleteProjectInput) => {
    const session = getCurrentUserSession();
    return deleteProject(session.userId, input);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_RECOVER, async (_event, projectId: string) => {
    const session = getCurrentUserSession();
    return recoverProject(session.userId, projectId);
  });

  // Video Uploads (Supabase Storage with Progress)
  ipcMain.handle(IPC_CHANNELS.UPLOAD_START, async (event, input: UploadVideoInput) => {
    const session = getCurrentUserSession();
    return startVideoUpload(
      input.filePath,
      session.userId,
      input.projectId,
      input.maxSizeBytes,
      (progress) => {
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.UPLOAD_PROGRESS, progress);
          }
        } catch (err) {
          logger.warn('IPC', 'Failed to dispatch upload progress event', err);
        }
      }
    );
  });

  ipcMain.handle(IPC_CHANNELS.UPLOAD_RETRY, async (event, input: RetryUploadInput) => {
    return retryVideoUpload(input.uploadId, (progress) => {
      try {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.UPLOAD_PROGRESS, progress);
        }
      } catch (err) {
        logger.warn('IPC', 'Failed to dispatch retry upload progress event', err);
      }
    });
  });

  ipcMain.handle(IPC_CHANNELS.UPLOAD_CANCEL, async (_event, input: CancelUploadInput) => {
    return cancelVideoUpload(input.uploadId);
  });

  // Storage & Signed URLs
  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_SIGNED_URL, async (_event, input: SignedUrlInput) => {
    const signedUrl = await createVideoSignedUrl(input.storagePath, input.expiresInSeconds);
    return { success: Boolean(signedUrl), signedUrl: signedUrl || undefined };
  });

  // Auth & Session
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    return getCurrentUserSession();
  });

  // Speech-to-Text Transcription (Groq Whisper)
  ipcMain.handle(
    IPC_CHANNELS.TRANSCRIPTION_START,
    async (_event, input: StartTranscriptionInput): Promise<StartTranscriptionResult> => {
      try {
        const session = getCurrentUserSession();
        const result = await transcriptionJobManager.startTranscription(session.userId, input);
        return { success: true, jobId: result.jobId };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('IPC', `Transcription start failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TRANSCRIPTION_CANCEL,
    async (_event, input: CancelTranscriptionInput): Promise<{ success: boolean; error?: string }> => {
      const ok = transcriptionJobManager.cancelJob(input.jobId);
      return { success: ok, error: ok ? undefined : 'Failed to cancel job or job already finished.' };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TRANSCRIPTION_GET_STATUS,
    async (_event, jobId: string): Promise<TranscriptionJobResult> => {
      const job = transcriptionJobManager.getJob(jobId);
      return { success: Boolean(job), job: job || undefined };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TRANSCRIPTION_GET_MODELS,
    async (): Promise<GetModelsResult> => {
      const models = transcriptionJobManager.getSupportedModels();
      const hasApiKey = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your-groq-api-key');
      return {
        success: true,
        models,
        defaultModel: 'whisper-large-v3-turbo',
        hasApiKey,
      };
    }
  );

  // Subtitle & Video Export Handlers
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_START,
    async (_event, input: ExportVideoOptionsInput): Promise<ExportStartResult> => {
      try {
        const session = await getCurrentUserSession();
        return await videoExportManager.startExport(input, session.userId);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('IPC', `Export start failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_CANCEL,
    async (_event, input: CancelExportInput): Promise<{ success: boolean; error?: string }> => {
      const session = await getCurrentUserSession();
      return await videoExportManager.cancelExport(input.jobId, session.userId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_GET_STATUS,
    async (_event, jobId: string): Promise<ExportJobResult> => {
      try {
        const session = await getCurrentUserSession();
        const job = videoExportManager.getJob(jobId, session.userId);
        return { success: Boolean(job), job: job || undefined };
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SUBTITLES,
    async (_event, input: ExportSubtitlesInput): Promise<ExportSubtitlesResult> => {
      try {
        const session = await getCurrentUserSession();
        return await videoExportManager.exportSubtitles(input, session.userId);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMsg };
      }
    }
  );

  logger.info('IPC', 'All IPC handlers registered successfully');
}
