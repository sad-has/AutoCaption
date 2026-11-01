/**
 * Typed IPC Channel constants and contracts for AutoCaption Studio.
 */
import type {
  ProjectRecord,
  TranscriptionJobProgress,
  TranscriptionModelOption,
  ExportJobProgress,
} from './types';

export const IPC_CHANNELS = {
  // Dialogs
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',

  // Media Inspection & Streaming
  MEDIA_INSPECT_FILE: 'media:inspect-file',

  // System & Diagnostics
  SYSTEM_GET_INFO: 'system:get-info',
  SYSTEM_GET_LOGS: 'system:get-logs',

  // Local Storage & Preferences
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  STORAGE_GET_CACHE_INFO: 'storage:get-cache-info',
  STORAGE_CLEAR_CACHE: 'storage:clear-cache',

  // Whisper Models (Local Offline Inference)
  MODELS_LIST: 'models:list',
  MODELS_CHECK_STATUS: 'models:check-status',

  // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  // External Links
  SHELL_OPEN_EXTERNAL: 'shell:open-external',
  SHELL_SHOW_IN_FOLDER: 'shell:show-in-folder',

  // Project Management (Supabase PostgreSQL with RLS)
  PROJECTS_LIST: 'projects:list',
  PROJECTS_GET: 'projects:get',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DUPLICATE: 'projects:duplicate',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_RECOVER: 'projects:recover',

  // Video Uploads (Supabase Storage)
  UPLOAD_START: 'upload:start',
  UPLOAD_RETRY: 'upload:retry',
  UPLOAD_CANCEL: 'upload:cancel',
  UPLOAD_PROGRESS: 'upload:progress',

  // Storage & Signed URLs
  STORAGE_GET_SIGNED_URL: 'storage:get-signed-url',

  // Authentication & Session
  AUTH_GET_SESSION: 'auth:get-session',

  // Speech-to-Text Transcription (Groq Whisper)
  TRANSCRIPTION_START: 'transcription:start',
  TRANSCRIPTION_CANCEL: 'transcription:cancel',
  TRANSCRIPTION_GET_STATUS: 'transcription:get-status',
  TRANSCRIPTION_GET_MODELS: 'transcription:get-models',
  TRANSCRIPTION_PROGRESS: 'transcription:progress',

  // Subtitle & Video Export
  EXPORT_SUBTITLES: 'export:subtitles',
  EXPORT_START: 'export:start',
  EXPORT_CANCEL: 'export:cancel',
  EXPORT_GET_STATUS: 'export:get-status',
  EXPORT_PROGRESS: 'export:progress',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

export interface OpenFileDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  allowDirectories?: boolean;
}

export interface FileDialogResult {
  canceled: boolean;
  filePath: string | null;
  fileName: string | null;
  fileSize?: number;
  mimeType?: string;
}

export interface SaveFileResult {
  success: boolean;
  canceled: boolean;
  savedPath?: string;
  error?: string;
}

export interface MediaMetadata {
  filePath: string;
  fileName: string;
  fileSize: number;
  durationMs: number;
  width: number;
  height: number;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  fps: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAudio: boolean;
  mimeType: string;
  streamUrl: string;
  isSupportedByBrowser: boolean;
  warning?: string;
}

export interface MediaInspectResult {
  success: boolean;
  metadata?: MediaMetadata;
  error?: string;
  errorType?: 'not_found' | 'unsupported_format' | 'unsupported_codec' | 'probe_failed' | 'invalid_path';
}

export interface SystemDiagnostics {
  platform: string;
  arch: string;
  osRelease: string;
  osVersion: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  v8Version: string;
  hardwareAccelerationActive: boolean;
  userDataPath: string;
  cachePath: string;
}

export interface WhisperModelInfo {
  id: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  name: string;
  parameters: string;
  requiredVram: string;
  diskSize: string;
  downloaded: boolean;
  downloadProgress?: number;
  localPath?: string;
}

export interface AppSettings {
  general: {
    autoSaveIntervalMs: number;
    theme: 'charcoal-dark';
    compactMode: boolean;
  };
  storage: {
    projectDirectory: string;
    cacheDirectory: string;
    maxCacheSizeBytes: number;
  };
  models: {
    activeModelId: string;
    modelsDirectory: string;
  };
  exportDefaults: {
    format: 'mp4' | 'mov' | 'webm';
    codec: 'h264' | 'hevc' | 'prores';
    resolution: '1080x1920' | '1920x1080' | '1080x1080' | '1080x1350';
    bitrateMbps: number;
    burnedInSubtitles: boolean;
    generateSrt: boolean;
    generateVtt: boolean;
  };
}

export interface ProjectOperationResult {
  success: boolean;
  project?: ProjectRecord;
  error?: string;
  conflict?: boolean;
  serverVersion?: number;
}

export interface ProjectsListResult {
  success: boolean;
  projects: ProjectRecord[];
  error?: string;
}

export interface UploadStartResult {
  success: boolean;
  uploadId?: string;
  videoId?: string;
  storagePath?: string;
  signedUrl?: string;
  error?: string;
}

export interface SignedUrlResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

export interface StartTranscriptionResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface GetModelsResult {
  success: boolean;
  models: TranscriptionModelOption[];
  defaultModel: string;
  hasApiKey: boolean;
  error?: string;
}

export interface TranscriptionJobResult {
  success: boolean;
  job?: TranscriptionJobProgress;
  error?: string;
}

export interface ExportSubtitlesResult {
  success: boolean;
  content?: string;
  format?: 'srt' | 'vtt';
  fileName?: string;
  error?: string;
}

export interface ExportStartResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface ExportJobResult {
  success: boolean;
  job?: ExportJobProgress;
  error?: string;
}
