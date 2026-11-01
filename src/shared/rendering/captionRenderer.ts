import type {
  CaptionSegment,
  CaptionStyle,
  CaptionWord,
} from '../types';

export const BASE_CANVAS_SHORT_DIM = 1080;
export const FONT_SCALE_MULTIPLIER = 2.1; // Proportional scaling from template style base to 1080p reference canvas

export interface NormalizedCaptionRendering {
  fontSizePx: number;
  hasStroke: boolean;
  strokeWidthPx: number;
  strokeColor: string;
  hasShadow: boolean;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  hasBox: boolean;
  boxColor: string;
  boxOpacity: number;
  boxPaddingXPx: number;
  boxPaddingYPx: number;
  boxCornerRadiusPx: number;
  fontFamily: string;
  primaryFontName: string;
  fallbackFontNames: string[];
  secondaryFontFamily?: string;
  secondaryFontName?: string;
  secondaryFontWeight?: number;
  fontWeight: number;
  textColor: string;
  activeWordColor: string;
  hasWordEmphasis: boolean;
  activeWordScale: number;
  activeWordBgColor?: string;
  highlightStyle?: 'word' | 'sweep' | 'pill' | 'box';
  positionYPercent: number;
  positionXPercent: number;
  textAlign: 'left' | 'center' | 'right';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  letterSpacingPx: number;
  lineHeight: number;
  maxWidthPercent: number;
  words?: NormalizedWordRendering[];
}

export interface NormalizedWordRendering {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  isActive: boolean;
  isPast: boolean;
  isFuture: boolean;
  isMainWord?: boolean;
  fontFamily?: string;
  fontWeight?: number;
  color: string;
  backgroundColor?: string;
  scale: number;
  opacity: number;
  isVisible: boolean;
}

export interface ResolveRenderingOptions {
  style: CaptionStyle;
  segment?: CaptionSegment;
  currentTimeMs?: number;
  canvasWidth: number;
  canvasHeight: number;
  prefersReducedMotion?: boolean;
}

/**
 * Returns the scale factor relative to a standard 1080p short-edge canvas (1080px).
 * Whether the canvas is 1080x1920 (9:16), 1920x1080 (16:9), 1080x1080 (1:1), or a preview DOM container,
 * this ensures that typography and geometry maintain identical visual proportions.
 */
export function getCanvasScaleFactor(canvasWidth: number, canvasHeight: number): number {
  const shortDim = Math.min(canvasWidth > 0 ? canvasWidth : 1080, canvasHeight > 0 ? canvasHeight : 1920);
  return shortDim / BASE_CANVAS_SHORT_DIM;
}

export const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

/**
 * Parses a CSS font-family stack and extracts cleanly trimmed individual font names.
 */
export function parseFontStack(fontFamilyStr: string): string[] {
  if (!fontFamilyStr) return ['Arial'];
  return fontFamilyStr
    .split(',')
    .map((f) => f.replace(/['"]/g, '').trim())
    .filter((f) => f.length > 0);
}

/**
 * Known system fonts pre-installed across Windows, macOS, and Linux that are guaranteed to render safely.
 */
export const SYSTEM_INSTALLED_FONTS = new Set([
  'arial',
  'georgia',
  'segoe ui',
  'times new roman',
  'trebuchet ms',
  'verdana',
  'tahoma',
  'impact',
  'courier new',
  'comic sans ms',
  'nirmala ui',
  'mangal',
  'aparajita',
  'utsaah',
]);

/**
 * Resolves the primary font name and safe fallbacks for rendering.
 */
export function resolveFontNames(fontFamilyStr: string, isHindi = false): {
  primaryFontName: string;
  fallbackFontNames: string[];
  safeFallback: string;
} {
  const fonts = parseFontStack(fontFamilyStr);
  const primary = fonts[0] || 'Arial';
  const fallbacks = fonts.slice(1);

  let safeFallback = 'Arial';
  if (isHindi) {
    safeFallback = 'Nirmala UI';
  } else {
    const isSerif = fontFamilyStr.toLowerCase().includes('serif') && !fontFamilyStr.toLowerCase().includes('sans-serif');
    if (isSerif) {
      safeFallback = 'Georgia';
    } else {
      safeFallback = 'Arial';
    }
  }

  return {
    primaryFontName: primary,
    fallbackFontNames: fallbacks,
    safeFallback,
  };
}

/**
 * Resolves a unified, normalized caption rendering configuration.
 * Used identically by both editor preview (DOM) and video exporter (ASS/FFmpeg).
 */
export function resolveNormalizedCaptionRendering(
  options: ResolveRenderingOptions
): NormalizedCaptionRendering {
  const { style, segment, currentTimeMs, canvasWidth, canvasHeight } = options;

  const effectiveStyle: CaptionStyle = segment?.styleOverrides
    ? { ...style, ...segment.styleOverrides }
    : style;

  const scale = getCanvasScaleFactor(canvasWidth, canvasHeight);

  // Proportional typography sizing
  const fontSizePx = Math.round(effectiveStyle.fontSize * FONT_SCALE_MULTIPLIER * scale);
  const hasStroke = effectiveStyle.hasStroke !== undefined
    ? Boolean(effectiveStyle.hasStroke)
    : effectiveStyle.strokeWidth > 0;
  const strokeWidthPx = hasStroke && effectiveStyle.strokeWidth > 0
    ? Math.max(1, Math.round(effectiveStyle.strokeWidth * FONT_SCALE_MULTIPLIER * scale * 0.75))
    : (hasStroke ? Math.max(1, Math.round(4 * FONT_SCALE_MULTIPLIER * scale * 0.75)) : 0);

  const shadowOffsetX = Math.round((effectiveStyle.shadowOffsetX ?? 0) * scale * 1.5);
  const shadowOffsetY = Math.round((effectiveStyle.shadowOffsetY ?? 2) * scale * 1.5);
  const shadowBlur = Math.round((effectiveStyle.shadowBlur ?? 4) * scale * 1.5);

  const boxPaddingXPx = Math.round(effectiveStyle.boxPaddingX * scale * 1.5);
  const boxPaddingYPx = Math.round(effectiveStyle.boxPaddingY * scale * 1.5);
  const boxCornerRadiusPx = Math.round(effectiveStyle.boxCornerRadius * scale * 1.5);
  const letterSpacingPx = Number((effectiveStyle.letterSpacing * scale).toFixed(1));

  const isHindi = segment ? DEVANAGARI_REGEX.test(segment.text) : false;
  const { primaryFontName, fallbackFontNames } = resolveFontNames(effectiveStyle.fontFamily, isHindi);

  let secondaryFontName: string | undefined;
  if (effectiveStyle.secondaryFontFamily) {
    const resolvedSecondary = resolveFontNames(effectiveStyle.secondaryFontFamily, isHindi);
    secondaryFontName = resolvedSecondary.primaryFontName;
  }

  // Text transformation
  let textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize' = 'none';
  if (effectiveStyle.textTransform) {
    textTransform = effectiveStyle.textTransform;
  } else if (effectiveStyle.allCaps) {
    textTransform = 'uppercase';
  }

  const activeWordColor = effectiveStyle.activeWordColor || '#EAB308'; // Premium golden yellow default
  const hasWordEmphasis = effectiveStyle.hasWordEmphasis !== false;
  const activeWordScale = effectiveStyle.activeWordScale || 1.1;

  // Word-level rendering calculation when segment and timings are available
  let words: NormalizedWordRendering[] | undefined;
  if (segment?.words && segment.words.length > 0) {
    const time = currentTimeMs ?? segment.startMs;
    const animPreset = segment.animation?.preset || effectiveStyle.animation?.preset || effectiveStyle.animationType || 'fade';

    words = segment.words.map((w: CaptionWord, idx) => {
      const isActive = time >= w.startMs && time <= w.endMs;
      const isPast = time > w.endMs;
      const isFuture = time < w.startMs;

      const isExplicitMainWord = Boolean(w.highlighted);
      const isMainWord = isExplicitMainWord || (isActive && hasWordEmphasis);

      let wordFontFamily = effectiveStyle.fontFamily;
      let wordFontWeight = effectiveStyle.fontWeight || 700;

      if (effectiveStyle.secondaryFontFamily && isMainWord) {
        wordFontFamily = effectiveStyle.secondaryFontFamily;
        wordFontWeight = effectiveStyle.secondaryFontWeight || 900;
      }
      if (w.fontFamily) {
        wordFontFamily = w.fontFamily;
      }
      if (w.fontWeight) {
        wordFontWeight = w.fontWeight;
      }

      let color = effectiveStyle.textColor;
      let scale = 1;
      const opacity = 1;
      const isVisible = true;
      const backgroundColor = effectiveStyle.activeWordBgColor;

      if (hasWordEmphasis) {
        if (animPreset === 'karaoke-highlight' || animPreset === 'highlight-sweep') {
          // Cumulative karaoke highlight: read words remain highlighted
          if (isActive || isPast) {
            color = activeWordColor;
            scale = isActive ? activeWordScale : 1.0;
          }
        } else {
          // Standard word emphasis: only the current spoken word lights up
          if (isActive) {
            color = activeWordColor;
            scale = activeWordScale;
          } else if (isExplicitMainWord) {
            color = activeWordColor;
          }
        }
      } else if (isExplicitMainWord) {
        color = activeWordColor;
      }

      let transformedText = w.text;
      if (textTransform === 'uppercase') {
        transformedText = transformedText.toUpperCase();
      } else if (textTransform === 'lowercase') {
        transformedText = transformedText.toLowerCase();
      } else if (textTransform === 'capitalize') {
        transformedText = transformedText.replace(/\b\w/g, (c) => c.toUpperCase());
      }

      return {
        id: w.id || `word-${idx}`,
        text: transformedText,
        startMs: w.startMs,
        endMs: w.endMs,
        isActive,
        isPast,
        isFuture,
        isMainWord,
        fontFamily: wordFontFamily,
        fontWeight: wordFontWeight,
        color,
        backgroundColor: isActive ? backgroundColor : undefined,
        scale,
        opacity,
        isVisible,
      };
    });
  }

  return {
    fontSizePx,
    hasStroke,
    strokeWidthPx,
    strokeColor: effectiveStyle.strokeColor || '#000000',
    hasShadow: effectiveStyle.hasShadow,
    shadowColor: effectiveStyle.shadowColor || 'rgba(0,0,0,0.85)',
    shadowOffsetX,
    shadowOffsetY,
    shadowBlur,
    hasBox: effectiveStyle.hasBox,
    boxColor: effectiveStyle.boxColor || '#000000',
    boxOpacity: effectiveStyle.boxOpacity ?? 0.8,
    boxPaddingXPx,
    boxPaddingYPx,
    boxCornerRadiusPx,
    fontFamily: effectiveStyle.fontFamily,
    primaryFontName,
    fallbackFontNames,
    secondaryFontFamily: effectiveStyle.secondaryFontFamily,
    secondaryFontName,
    secondaryFontWeight: effectiveStyle.secondaryFontWeight || 900,
    fontWeight: effectiveStyle.fontWeight || 700,
    textColor: effectiveStyle.textColor || '#FFFFFF',
    activeWordColor,
    hasWordEmphasis,
    activeWordScale,
    activeWordBgColor: effectiveStyle.activeWordBgColor,
    highlightStyle: effectiveStyle.highlightStyle || 'word',
    positionYPercent: effectiveStyle.positionYPercent ?? 18,
    positionXPercent: effectiveStyle.positionXPercent ?? 50,
    textAlign: effectiveStyle.textAlign || 'center',
    textTransform,
    letterSpacingPx,
    lineHeight: effectiveStyle.lineHeight || 1.25,
    maxWidthPercent: effectiveStyle.maxWidthPercent || 90,
    words,
  };
}
