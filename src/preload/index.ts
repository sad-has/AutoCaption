import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  IPC_CHANNELS,
  type OpenFileDialogOptions,
  type FileDialogResult,
  type SystemDiagnostics,
  type AppSettings,
  type WhisperModelInfo,
  type MediaInspectResult,
  type ProjectOperationResult,
  type ProjectsListResult,
  type UploadStartResult,
  type SignedUrlResult,
  type StartTranscriptionResult,
  type GetModelsResult,
  type TranscriptionJobResult,
  type ExportStartResult,
  type ExportSubtitlesResult,
  type ExportJobResult,
  type SaveFileResult,
} from '../shared/ipc';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  UploadVideoInput,
  StartTranscriptionInput,
  ExportVideoOptionsInput,
  ExportSubtitlesInput,
} from '../shared/schemas';
import type {
  UploadProgressEvent,
  UserSession,
  TranscriptionJobProgress,
  ExportJobProgress,
} from '../shared/types';

/**
 * Restricted, strictly-typed Electron IPC bridge.
 * Node APIs are never exposed directly to the renderer.
 */
const electronAPI = {
  // Dialogs & Filesystem Utilities
  openFileDialog: (options?: OpenFileDialogOptions): Promise<FileDialogResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options);
  },

  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file);
  },

  // Media Inspection & Streaming
  inspectMediaFile: (filePath: string): Promise<MediaInspectResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDIA_INSPECT_FILE, filePath);
  },

  getStreamUrl: (filePath: string): string => {
    return `local-video://stream/?path=${encodeURIComponent(filePath)}`;
  },

  // System Diagnostics
  getSystemInfo: (): Promise<SystemDiagnostics> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO);
  },

  getRecentLogs: (): Promise<Array<{ timestamp: string; level: string; scope: string; message: string }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_LOGS);
  },

  // Settings & Preferences
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET);
  },

  saveSettings: (settings: AppSettings): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings);
  },

  getCacheInfo: (): Promise<{ sizeBytes: number; fileCount: number }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_CACHE_INFO);
  },

  clearCache: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STORAGE_CLEAR_CACHE);
  },

  // Whisper Models Management
  listModels: (): Promise<WhisperModelInfo[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MODELS_LIST);
  },

  // Window Controls
  minimizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE);
  },

  maximizeWindow: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE);
  },

  closeWindow: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE);
  },

  isWindowMaximized: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED);
  },

  // External Shell Actions
  openExternal: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url);
  },

  showItemInFolder: (itemPath: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, itemPath);
  },

  // Project Management (Supabase PostgreSQL + RLS)
  listProjects: (): Promise<ProjectsListResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST);
  },

  getProject: (projectId: string): Promise<ProjectOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_GET, projectId);
  },

  createProject: (input: CreateProjectInput): Promise<ProjectOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CREATE, input);
  },

  updateProject: (input: UpdateProjectInput): Promise<ProjectOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_UPDATE, input);
  },

  duplicateProject: (projectId: string): Promise<ProjectOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_DUPLICATE, { projectId });
  },

  deleteProject: (projectId: string): Promise<ProjectOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_DELETE, { projectId });
  },

  recoverProject: (projectId: string): Promise<ProjectOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_RECOVER, projectId);
  },

  // Video Uploads (Supabase Storage)
  startUpload: (input: UploadVideoInput): Promise<UploadStartResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_START, input);
  },

  retryUpload: (uploadId: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_RETRY, { uploadId });
  },

  cancelUpload: (uploadId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_CANCEL, { uploadId });
  },

  onUploadProgress: (callback: (event: UploadProgressEvent) => void): (() => void) => {
    const handler = (_event: unknown, data: UploadProgressEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.UPLOAD_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.UPLOAD_PROGRESS, handler);
    };
  },

  // Storage & Signed URLs
  getSignedUrl: (storagePath: string, expiresInSeconds = 3600): Promise<SignedUrlResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_SIGNED_URL, { storagePath, expiresInSeconds });
  },

  // Auth & Session
  getUserSession: (): Promise<UserSession> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_SESSION);
  },

  // Speech-to-Text Transcription (Groq Whisper)
  startTranscription: (input: StartTranscriptionInput): Promise<StartTranscriptionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPTION_START, input);
  },

  cancelTranscription: (jobId: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPTION_CANCEL, { jobId });
  },

  getTranscriptionStatus: (jobId: string): Promise<TranscriptionJobResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPTION_GET_STATUS, jobId);
  },

  getTranscriptionModels: (): Promise<GetModelsResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPTION_GET_MODELS);
  },

  onTranscriptionProgress: (callback: (event: TranscriptionJobProgress) => void): (() => void) => {
    const handler = (_event: unknown, data: TranscriptionJobProgress) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPTION_PROGRESS, handler);
    };
  },

  // Subtitle & Video Export
  startExport: (input: ExportVideoOptionsInput): Promise<ExportStartResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.EXPORT_START, input);
  },

  saveExportedVideo: (sourcePath: string, suggestedName?: string): Promise<SaveFileResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, { sourcePath, suggestedName });
  },

  cancelExport: (jobId: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CANCEL, { jobId });
  },

  getExportStatus: (jobId: string): Promise<ExportJobResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.EXPORT_GET_STATUS, jobId);
  },

  exportSubtitles: (input: ExportSubtitlesInput): Promise<ExportSubtitlesResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.EXPORT_SUBTITLES, input);
  },

  onExportProgress: (callback: (event: ExportJobProgress) => void): (() => void) => {
    const handler = (_event: unknown, data: ExportJobProgress) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXPORT_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EXPORT_PROGRESS, handler);
    };
  },
};

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
