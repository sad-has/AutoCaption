import type { CaptionAnimationPreset } from '../types';

export type ExportPipelineFormat = 'ffmpeg-ass' | 'canvas-raster' | 'webvtt-srt';

export type ExportSupportLevel = 'full' | 'partial' | 'preview-only';

export interface AnimationExportCapability {
  preset: CaptionAnimationPreset;
  displayName: string;
  supportLevelASS: ExportSupportLevel;
  supportLevelCanvas: ExportSupportLevel;
  supportLevelSRT: ExportSupportLevel;
  description: string;
  notes: string;
  exportWarning?: string;
  recommendedAlternative?: CaptionAnimationPreset;
}

/**
 * Export compatibility matrix documenting support across video rendering pipelines:
 * 1. ASS Subtitle burn-in via FFmpeg (standard, ultra-fast vector subtitle filter)
 * 2. Canvas / WebGL frame-by-frame rasterizer (pixel-perfect GPU rendering)
 * 3. WebVTT / SRT standard text export
 */
export const ANIMATION_EXPORT_CAPABILITIES: Record<CaptionAnimationPreset, AnimationExportCapability> = {
  none: {
    preset: 'none',
    displayName: 'Static (No Animation)',
    supportLevelASS: 'full',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'full',
    description: 'Instant display with zero motion or transitions.',
    notes: 'Supported natively across all export formats.',
  },
  fade: {
    preset: 'fade',
    displayName: 'Smooth Fade In / Out',
    supportLevelASS: 'full',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Graceful alpha opacity dissolve on entrance and exit.',
    notes: 'Fully supported natively in ASS via \\fad(in,out) and in Canvas rasterizer.',
  },
  'fade-in': {
    preset: 'fade-in',
    displayName: 'Cinematic Fade In',
    supportLevelASS: 'full',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Smooth alpha entrance dissolve with stable hold.',
    notes: 'Fully supported natively in ASS via \\fad(in,0) and in Canvas rasterizer.',
  },
  'fade-out': {
    preset: 'fade-out',
    displayName: 'Graceful Fade Out',
    supportLevelASS: 'full',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Immediate entrance with smooth alpha exit dissolve.',
    notes: 'Fully supported natively in ASS via \\fad(0,out) and in Canvas rasterizer.',
  },
  scale: {
    preset: 'scale',
    displayName: 'Punchy Scale Entrance',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'High-impact scale entrance growing into frame.',
    notes: 'Rendered in Canvas rasterizer; ASS approximates with scale and entrance fade.',
  },
  'highlight-sweep': {
    preset: 'highlight-sweep',
    displayName: 'Highlight Sweep Reveal',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Continuous horizontal luminance sweep tracking active speech cadence.',
    notes: 'Canvas rasterizer renders full chromatic sweep; ASS uses karaoke tags and alpha transitions.',
  },
  pop: {
    preset: 'pop',
    displayName: 'Dynamic Pop & Scale',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Energetic scale-up entrance with elastic spring easing.',
    notes: 'Canvas rasterizer renders full spring curves. ASS approximates using \\t(\\fscx\\fscy).',
    exportWarning: 'ASS export uses discrete scale approximation; Canvas rasterizer is recommended for exact spring bounce.',
  },
  'slide-up': {
    preset: 'slide-up',
    displayName: 'Slide Up',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Smooth vertical translation rising from bottom into resting position.',
    notes: 'Canvas rasterizer renders full cubic movement. ASS uses \\move coordinate interpolation.',
  },
  'slide-down': {
    preset: 'slide-down',
    displayName: 'Slide Down',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Vertical drop downward into resting position.',
    notes: 'Canvas rasterizer renders full cubic movement. ASS uses \\move coordinate interpolation.',
  },
  typewriter: {
    preset: 'typewriter',
    displayName: 'Typewriter Reveal',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Sequential character-by-character reveal matching speech cadence.',
    notes: 'Requires frame rasterization or dense sub-cues in ASS.',
    exportWarning: 'Standard SRT does not support in-line character typing. Rendered as sub-cue steps in ASS/Canvas.',
  },
  'word-reveal': {
    preset: 'word-reveal',
    displayName: 'Word-by-Word Reveal',
    supportLevelASS: 'full',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Words appear progressively in sync with speech timestamps.',
    notes: 'Uses word-level timestamp cues. Falls back to static segment if word timings are unavailable.',
  },
  'karaoke-highlight': {
    preset: 'karaoke-highlight',
    displayName: 'Karaoke Highlight',
    supportLevelASS: 'full',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Active word fills with vibrant highlight color tracking spoken words.',
    notes: 'Natively supported in ASS via \\k and \\K karaoke timing tags.',
  },
  'emphasis-scale': {
    preset: 'emphasis-scale',
    displayName: 'Emphasis Scale Pop',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Active spoken word scales up in place without shifting adjacent text.',
    notes: 'Fully rendered in Canvas rasterizer; ASS approximates with word bounding boxes.',
    exportWarning: 'In standard ASS burn-in, adjacent word layout may remain static.',
  },
  'cinematic-letter-reveal': {
    preset: 'cinematic-letter-reveal',
    displayName: 'Cinematic Letter Reveal',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'preview-only',
    description: 'Slow expanding letter-spacing tracking with soft gaussian depth blur.',
    notes: 'Gaussian blur and continuous letter spacing require WebGL/Canvas frame rasterizer.',
    exportWarning: 'Letter-spacing blur is preview & Canvas-only; ASS subtitle fallback omits blur filter.',
    recommendedAlternative: 'fade',
  },
  bounce: {
    preset: 'bounce',
    displayName: 'Playful Bounce',
    supportLevelASS: 'partial',
    supportLevelCanvas: 'full',
    supportLevelSRT: 'partial',
    description: 'Energetic vertical bounce oscillation on entrance.',
    notes: 'Fully supported in Canvas rasterizer.',
  },
};

/**
 * Returns export capability details for a given animation preset.
 */
export function getAnimationExportSupport(preset: CaptionAnimationPreset): AnimationExportCapability {
  return (
    ANIMATION_EXPORT_CAPABILITIES[preset] || {
      preset,
      displayName: preset,
      supportLevelASS: 'partial',
      supportLevelCanvas: 'full',
      supportLevelSRT: 'partial',
      description: 'Custom animation preset',
      notes: 'Supported in Canvas rasterizer.',
    }
  );
}

/**
 * Returns whether an animation preset is fully supported natively in standard ASS subtitle burn-in.
 */
export function isFullySupportedInASS(preset: CaptionAnimationPreset): boolean {
  const cap = getAnimationExportSupport(preset);
  return cap.supportLevelASS === 'full';
}
