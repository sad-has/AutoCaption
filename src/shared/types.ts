/**
 * Core domain types for AutoCaption Studio.
 */

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export type CaptionAnimationPreset =
  | 'none'
  | 'fade'
  | 'fade-in'
  | 'fade-out'
  | 'pop'
  | 'scale'
  | 'slide-up'
  | 'slide-down'
  | 'typewriter'
  | 'word-reveal'
  | 'karaoke-highlight'
  | 'highlight-sweep'
  | 'emphasis-scale'
  | 'cinematic-letter-reveal'
  | 'bounce';

export type CaptionAnimationType = CaptionAnimationPreset;

export interface CaptionAnimationConfig {
  preset: CaptionAnimationPreset;
  entranceDurationMs: number; // default: 250
  exitDurationMs: number; // default: 200
  intensity: number; // 0.1 - 2.0, default: 1.0
  wordEmphasis: boolean; // whether active words scale or pop, default: true
  highlightColor?: string; // optional highlight color override
  delayMs?: number; // entrance delay in ms (0 - 500)
  staggerMs?: number; // per-word stagger delay in ms (0 - 100)
}

export interface CaptionAnimation extends Partial<CaptionAnimationConfig> {
  type: CaptionAnimationPreset;
  durationMs?: number;
  highlightActiveWord?: boolean;
}

export interface CaptionWord {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  highlighted?: boolean;
  confidence?: number;
}

export interface CaptionSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: CaptionWord[];
  trackId?: string; // Default: 'C1'
  styleOverrides?: Partial<CaptionStyle>;
  animation?: CaptionAnimation;
  originalText?: string; // Transcript source data kept separate from user edits
  originalWords?: CaptionWord[];
  isDemo?: boolean;
}

export type TextAlignment = 'left' | 'center' | 'right';
export type TextTransformation = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface CaptionStyle {
  presetId: string;
  templateName?: string;
  fontFamily: string;
  fontSize: number; // in pixels at preview base
  fontWeight: number; // 300 - 900
  textColor: string;
  textTransform?: TextTransformation;
  allCaps?: boolean; // backwards compatibility
  letterSpacing: number; // in px
  lineHeight: number; // multiplier
  textAlign?: TextAlignment;
  maxWidthPercent?: number; // 40 - 100%

  // Outline / Stroke
  strokeColor: string;
  strokeWidth: number;

  // Drop Shadow
  hasShadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX?: number;
  shadowOffsetY: number;

  // Background Box / Pill
  hasBox: boolean;
  boxColor: string;
  boxOpacity?: number; // 0.0 - 1.0
  boxPaddingX: number;
  boxPaddingY: number;
  boxCornerRadius: number;

  // Coordinates
  positionYPercent: number; // 0 - 100 from bottom
  positionXPercent: number; // 0 - 100 from left

  // Word Emphasis & Active Karaoke Word
  hasWordEmphasis?: boolean;
  activeWordColor: string;
  activeWordScale?: number; // 1.0 - 1.3
  activeWordBgColor?: string;
  highlightStyle?: 'word' | 'sweep' | 'pill' | 'box';
  secondaryFontFamily?: string;
  decorativeElement?: 'none' | 'underline' | 'dot' | 'badge' | 'line';

  // Animation
  animationType?: CaptionAnimationType;
  animation?: CaptionAnimationConfig;
}

export type CaptionTemplateCategory =
  | 'cinematic'
  | 'luxury'
  | 'bold'
  | 'minimal'
  | 'editorial'
  | 'documentary'
  | 'creator'
  | 'multilingual'
  | 'custom';

export interface CaptionTemplate {
  schemaVersion: '1.0.0';
  id: string;
  name: string;
  category: CaptionTemplateCategory;
  description?: string;
  author?: string;
  style: CaptionStyle;
  isBuiltIn?: boolean;
  isFavorite?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  filePath: string;
  streamUrl: string;
  durationMs: number;
  width: number;
  height: number;
  sizeBytes: number;
  fps: number;
  aspectRatio: AspectRatio;
  videoCodec?: string;
  audioCodec?: string | null;
  hasAudio?: boolean;
  isSupportedByBrowser?: boolean;
  browserFile?: File;
  isDemo?: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  mediaAsset: MediaAsset | null;
  captionSegments: CaptionSegment[];
  captionStyle: CaptionStyle;
  aspectRatio: AspectRatio;
  version?: number;
  userId?: string;
  isDemo?: boolean;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  aspectRatio: AspectRatio;
  captionStyle: CaptionStyle;
  captionSegments: CaptionSegment[];
  videoId: string | null;
  videoStoragePath: string | null;
  videoName: string | null;
  videoDurationMs: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoFps: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoRecord {
  id: string;
  userId: string;
  projectId: string | null;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  status: 'uploading' | 'ready' | 'failed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

export interface UploadProgressEvent {
  uploadId: string;
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: 'validating' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';
  error?: string | null;
  storagePath?: string;
  signedUrl?: string;
  videoId?: string;
}

export interface UserSession {
  userId: string;
  email?: string;
  isAuthenticated: boolean;
  isOfflineMock?: boolean;
}

export type TranscriptionJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TranscriptionJobProgress {
  jobId: string;
  projectId: string;
  status: TranscriptionJobStatus;
  stage: string;
  percentage: number;
  progress?: number;
  model?: string;
  language?: string;
  chunksTotal?: number;
  chunkCurrent?: number;
  error?: string | null;
  segmentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TranscriptionModelOption {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

export interface SystemFont {
  family: string;
  category: 'sans-serif' | 'display' | 'serif' | 'monospace';
  recommended: boolean;
}

export type ExportResolution = 'original' | '1080p' | '720p' | '4k';
export type ExportQuality = 'draft' | 'standard' | 'high';

export interface ExportVideoOptions {
  projectId: string;
  videoPath?: string;
  aspectRatio?: AspectRatio;
  resolution?: ExportResolution;
  quality?: ExportQuality;
  fps?: number;
  burnInCaptions?: boolean;
  styleOverride?: Partial<CaptionStyle>;
}

export type ExportJobStatus =
  | 'queued'
  | 'preparing'
  | 'rendering'
  | 'verifying'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExportJobProgress {
  jobId: string;
  projectId: string;
  status: ExportJobStatus;
  progress: number; // 0 - 100
  percentage?: number; // alias for progress
  stage: string;
  currentFrame?: number;
  totalFrames?: number;
  outputPath?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  durationMs?: number;
  error?: string | null;
  warnings?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ExportSubtitlesInput {
  projectId: string;
  format: 'srt' | 'vtt';
}
