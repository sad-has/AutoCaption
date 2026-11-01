import { z } from 'zod';

export const AspectRatioSchema = z.enum(['9:16', '16:9', '1:1', '4:5']);

export const CaptionWordSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  highlighted: z.boolean().optional(),
  confidence: z.number().optional(),
});

export const CaptionAnimationPresetSchema = z.enum([
  'none',
  'fade',
  'fade-in',
  'fade-out',
  'pop',
  'scale',
  'slide-up',
  'slide-down',
  'typewriter',
  'word-reveal',
  'karaoke-highlight',
  'highlight-sweep',
  'emphasis-scale',
  'cinematic-letter-reveal',
  'bounce',
]);

export const CaptionAnimationConfigSchema = z.object({
  preset: CaptionAnimationPresetSchema.default('pop'),
  entranceDurationMs: z.number().nonnegative().default(250),
  exitDurationMs: z.number().nonnegative().default(200),
  intensity: z.number().min(0.1).max(2.0).default(1.0),
  wordEmphasis: z.boolean().default(true),
  highlightColor: z.string().optional(),
  delayMs: z.number().nonnegative().default(0).optional(),
  staggerMs: z.number().nonnegative().default(0).optional(),
});

export const CaptionAnimationSchema = z.object({
  type: CaptionAnimationPresetSchema.default('none'),
  preset: CaptionAnimationPresetSchema.optional(),
  entranceDurationMs: z.number().nonnegative().optional(),
  exitDurationMs: z.number().nonnegative().optional(),
  intensity: z.number().optional(),
  wordEmphasis: z.boolean().optional(),
  highlightColor: z.string().optional(),
  delayMs: z.number().optional(),
  staggerMs: z.number().optional(),
  durationMs: z.number().positive().optional(),
  highlightActiveWord: z.boolean().optional(),
});

export const CaptionSegmentSchema = z.object({
  id: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  text: z.string(),
  words: z.array(CaptionWordSchema).default([]),
  trackId: z.string().default('C1').optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
  animation: CaptionAnimationSchema.optional(),
  originalText: z.string().optional(),
  originalWords: z.array(CaptionWordSchema).optional(),
  isDemo: z.boolean().optional(),
});

export const TextAlignmentSchema = z.enum(['left', 'center', 'right']);
export const TextTransformationSchema = z.enum(['none', 'uppercase', 'lowercase', 'capitalize']);

export const CaptionStyleSchema = z.object({
  presetId: z.string().default('custom'),
  templateName: z.string().optional(),
  fontFamily: z.string().default('Montserrat, sans-serif'),
  fontSize: z.number().positive().default(44),
  fontWeight: z.number().min(100).max(1000).default(700),
  textColor: z.string().default('#FFFFFF'),
  textTransform: TextTransformationSchema.default('none'),
  allCaps: z.boolean().optional(),
  letterSpacing: z.number().default(0),
  lineHeight: z.number().positive().default(1.2),
  textAlign: TextAlignmentSchema.default('center'),
  maxWidthPercent: z.number().min(20).max(100).default(90),

  strokeColor: z.string().default('#000000'),
  strokeWidth: z.number().nonnegative().default(0),

  hasShadow: z.boolean().default(false),
  shadowColor: z.string().default('rgba(0,0,0,0.8)'),
  shadowBlur: z.number().nonnegative().default(4),
  shadowOffsetX: z.number().default(0),
  shadowOffsetY: z.number().default(2),

  hasBox: z.boolean().default(false),
  boxColor: z.string().default('#000000'),
  boxOpacity: z.number().min(0).max(1).default(0.8),
  boxPaddingX: z.number().nonnegative().default(12),
  boxPaddingY: z.number().nonnegative().default(6),
  boxCornerRadius: z.number().nonnegative().default(6),

  positionYPercent: z.number().min(0).max(100).default(20),
  positionXPercent: z.number().min(0).max(100).default(50),

  hasWordEmphasis: z.boolean().default(true),
  activeWordColor: z.string().default('#F59E0B'),
  activeWordScale: z.number().min(1.0).max(2.0).default(1.08),
  activeWordBgColor: z.string().optional(),
  highlightStyle: z.enum(['word', 'sweep', 'pill', 'box']).optional(),
  secondaryFontFamily: z.string().optional(),
  decorativeElement: z.enum(['none', 'underline', 'dot', 'badge', 'line']).optional(),

  animationType: CaptionAnimationPresetSchema.optional(),
  animation: CaptionAnimationConfigSchema.optional(),
});

export const CaptionTemplateCategorySchema = z.enum([
  'cinematic',
  'luxury',
  'bold',
  'minimal',
  'editorial',
  'documentary',
  'creator',
  'multilingual',
  'custom',
]);

export const CaptionTemplateSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  id: z.string().min(1, 'Template ID is required'),
  name: z.string().trim().min(1, 'Template name is required').max(80, 'Name too long'),
  category: CaptionTemplateCategorySchema.default('custom'),
  description: z.string().max(250).optional(),
  author: z.string().max(60).optional(),
  style: CaptionStyleSchema,
  isBuiltIn: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CaptionTemplateInput = z.infer<typeof CaptionTemplateSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(120, 'Name too long'),
  aspectRatio: AspectRatioSchema.optional().default('9:16'),
  captionStyle: CaptionStyleSchema.optional(),
  captionSegments: z.array(CaptionSegmentSchema).optional(),
});

export const UpdateProjectSchema = z.object({
  id: z.string().min(1, 'Project ID required'),
  name: z.string().trim().min(1, 'Project name is required').max(120, 'Name too long').optional(),
  aspectRatio: AspectRatioSchema.optional(),
  captionStyle: CaptionStyleSchema.optional(),
  captionSegments: z.array(CaptionSegmentSchema).optional(),
  videoId: z.string().nullable().optional(),
  videoStoragePath: z.string().nullable().optional(),
  videoName: z.string().nullable().optional(),
  videoDurationMs: z.number().nonnegative().nullable().optional(),
  videoWidth: z.number().nonnegative().nullable().optional(),
  videoHeight: z.number().nonnegative().nullable().optional(),
  videoFps: z.number().nonnegative().nullable().optional(),
  version: z.number().int().positive('Version must be a positive integer'),
});

export const DuplicateProjectSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
});

export const DeleteProjectSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
});

export const UploadVideoSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  projectId: z.string().optional(),
  maxSizeBytes: z.number().positive().default(500 * 1024 * 1024), // 500MB default
});

export const RetryUploadSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
});

export const CancelUploadSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
});

export const SignedUrlSchema = z.object({
  storagePath: z.string().min(1, 'Storage path is required'),
  expiresInSeconds: z.number().int().min(60).max(604800).default(3600), // Default 1 hour
});

export const StartTranscriptionSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  videoFilePath: z.string().optional(),
  model: z.string().default('whisper-large-v3-turbo'),
  language: z.string().optional(),
  temperature: z.number().min(0).max(1).default(0),
  maxChunkBytes: z.number().positive().default(24 * 1024 * 1024), // 24MB safe chunk size
  wordsPerSegment: z.number().int().min(0).max(30).default(0).optional(), // 0 = natural sentence/auto, 1-30 words per segment
});

export const CancelTranscriptionSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
});

export const ExportResolutionSchema = z.enum(['original', '1080p', '720p', '4k']);
export const ExportQualitySchema = z.enum(['draft', 'standard', 'high']);

export const ExportVideoOptionsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  projectName: z.string().optional(),
  videoPath: z.string().optional(),
  aspectRatio: AspectRatioSchema.optional(),
  resolution: ExportResolutionSchema.default('original'),
  quality: ExportQualitySchema.default('standard'),
  fps: z.number().positive().optional(),
  burnInCaptions: z.boolean().default(true),
  styleOverride: CaptionStyleSchema.partial().optional(),
  captionSegments: z.array(CaptionSegmentSchema).optional(),
  captionStyle: CaptionStyleSchema.optional(),
});

export const ExportSubtitlesSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  format: z.enum(['srt', 'vtt']),
  projectName: z.string().optional(),
  captionSegments: z.array(CaptionSegmentSchema).optional(),
});

export const SaveFileOptionsSchema = z.object({
  sourcePath: z.string().min(1, 'Source file path is required'),
  suggestedName: z.string().optional(),
  title: z.string().optional(),
});

export const CancelExportSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
});

export type CreateProjectInput = z.input<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.input<typeof UpdateProjectSchema>;
export type DuplicateProjectInput = z.input<typeof DuplicateProjectSchema>;
export type DeleteProjectInput = z.input<typeof DeleteProjectSchema>;
export type UploadVideoInput = z.input<typeof UploadVideoSchema>;
export type RetryUploadInput = z.input<typeof RetryUploadSchema>;
export type CancelUploadInput = z.input<typeof CancelUploadSchema>;
export type SignedUrlInput = z.input<typeof SignedUrlSchema>;
export type StartTranscriptionInput = z.input<typeof StartTranscriptionSchema>;
export type CancelTranscriptionInput = z.input<typeof CancelTranscriptionSchema>;
export type ExportVideoOptionsInput = z.input<typeof ExportVideoOptionsSchema>;
export type ExportSubtitlesInput = z.input<typeof ExportSubtitlesSchema>;
export type CancelExportInput = z.input<typeof CancelExportSchema>;
export type SaveFileOptionsInput = z.input<typeof SaveFileOptionsSchema>;
