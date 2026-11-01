import type { CaptionSegment, CaptionStyle, CaptionWord, CaptionAnimationPreset } from '../types';
import {
  resolveNormalizedCaptionRendering,
  FONT_SCALE_MULTIPLIER,
  getCanvasScaleFactor,
} from '../rendering/captionRenderer';

/**
 * Formats milliseconds into SRT timecode format: HH:MM:SS,mmm
 * Example: 65432ms -> 00:01:05,432
 */
export function formatSrtTimestamp(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    ',' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Formats milliseconds into WebVTT timecode format: HH:MM:SS.mmm
 * Example: 65432ms -> 00:01:05.432
 */
export function formatVttTimestamp(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    '.' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Formats milliseconds into ASS timecode format: H:MM:SS.cc (hundredths of a second)
 * Example: 65432ms -> 0:01:05.43
 */
export function formatAssTimestamp(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const centis = Math.floor((safeMs % 1000) / 10);

  return (
    String(hours) +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    '.' +
    String(centis).padStart(2, '0')
  );
}

/**
 * Converts standard CSS color (#RRGGBB, #RGB, rgba, rgb) to ASS color format: &HAABBGGRR
 * Note: ASS stores Alpha in inverted order (00 = opaque, FF = transparent)
 * and color components in BGR order!
 */
export function colorToAssColor(colorStr: string, defaultOpacity = 1): string {
  let r = 255;
  let g = 255;
  let b = 255;
  let a = defaultOpacity;

  const hexMatch = colorStr.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch && hexMatch[1]) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0]!, 16);
      g = parseInt(hex[1]! + hex[1]!, 16);
      b = parseInt(hex[2]! + hex[2]!, 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = parseInt(hex.substring(6, 8), 16) / 255;
    }
  } else {
    const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgbaMatch) {
      r = parseInt(rgbaMatch[1] || '255', 10);
      g = parseInt(rgbaMatch[2] || '255', 10);
      b = parseInt(rgbaMatch[3] || '255', 10);
      if (rgbaMatch[4] !== undefined) {
        a = parseFloat(rgbaMatch[4]);
      }
    }
  }

  // ASS Alpha: 00 = fully opaque, FF = fully transparent
  const assAlpha = Math.round((1 - a) * 255);
  const aa = clampByte(assAlpha).toString(16).padStart(2, '0').toUpperCase();
  const bb = clampByte(b).toString(16).padStart(2, '0').toUpperCase();
  const gg = clampByte(g).toString(16).padStart(2, '0').toUpperCase();
  const rr = clampByte(r).toString(16).padStart(2, '0').toUpperCase();

  return `&H${aa}${bb}${gg}${rr}`;
}

/**
 * Converts CSS color to ASS inline tag format: &HBBGGRR&
 */
export function toInlineAssColor(colorStr: string): string {
  const ass = colorToAssColor(colorStr);
  const bgr = ass.substring(4, 10);
  return `&H${bgr}&`;
}

export const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

function clampByte(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}

/**
 * Generates SubRip (.srt) subtitle content from edited caption segments.
 * Strictly reflects current user-edited segment text and timestamps.
 */
export function exportToSrt(segments: CaptionSegment[]): string {
  // Sort by startMs
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);

  const lines: string[] = [];

  sorted.forEach((seg, index) => {
    const text = seg.text.trim();
    if (!text) return;

    lines.push(String(index + 1));
    lines.push(`${formatSrtTimestamp(seg.startMs)} --> ${formatSrtTimestamp(seg.endMs)}`);
    lines.push(text);
    lines.push(''); // Blank separator line
  });

  return lines.join('\n');
}

/**
 * Generates WebVTT (.vtt) subtitle content from edited caption segments.
 */
export function exportToWebVtt(segments: CaptionSegment[], title?: string): string {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);

  const lines: string[] = ['WEBVTT'];
  if (title) {
    lines.push(`NOTE Title: ${title}`);
  }
  lines.push('');

  sorted.forEach((seg, index) => {
    const text = seg.text.trim();
    if (!text) return;

    lines.push(String(index + 1));
    lines.push(`${formatVttTimestamp(seg.startMs)} --> ${formatVttTimestamp(seg.endMs)}`);
    lines.push(text);
    lines.push('');
  });

  return lines.join('\n');
}

export interface GenerateAssOptions {
  segments: CaptionSegment[];
  style: CaptionStyle;
  videoWidth: number;
  videoHeight: number;
  title?: string;
  enableWordEmphasis?: boolean;
  /** When false, disables all animation tags even if the style requests them. */
  enableAnimation?: boolean;
}

/**
 * Generates Advanced SubStation Alpha (.ass) subtitle file content for FFmpeg burn-in rendering.
 * Fully supports:
 * - Font selection & fallback
 * - Font size scaled to video height
 * - Font weight (bold flag)
 * - Text color (PrimaryColour)
 * - Outline stroke color & thickness
 * - Drop shadow / background box
 * - Vertical placement & alignment
 * - Smooth entrance and exit fade animations ({\fad(in,out)})
 * - Karaoke highlight timing tags ({\k<cs>}) when word timings are available
 */
export function exportToAss(options: GenerateAssOptions): string {
  const { segments, style, videoWidth, videoHeight, title = 'AutoCaption Export', enableWordEmphasis = false } = options;

  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);

  // Resolution reference for ASS script
  const playResX = videoWidth > 0 ? videoWidth : 1080;
  const playResY = videoHeight > 0 ? videoHeight : 1920;

  // Normalized styling resolved against target video canvas
  const norm = resolveNormalizedCaptionRendering({
    style,
    canvasWidth: playResX,
    canvasHeight: playResY,
  });

  const fontSize = norm.fontSizePx;
  const primaryFontFamily = norm.primaryFontName;
  const isBold = norm.fontWeight >= 700 ? -1 : 0;
  const primaryColor = colorToAssColor(norm.textColor);
  const secondaryColor = colorToAssColor(norm.activeWordColor);
  const outlineColor = colorToAssColor(norm.strokeColor);
  const shadowColor = colorToAssColor(
    norm.shadowColor,
    norm.hasShadow ? 0.9 : 0
  );
  const boxColor = colorToAssColor(
    norm.boxColor,
    norm.hasBox ? (norm.boxOpacity ?? 0.8) : 0
  );

  // BorderStyle: 1 = Outline + Drop Shadow; 3 = Opaque Box backdrop
  const borderStyle = norm.hasBox ? 3 : 1;
  const outlineWidth = norm.hasBox ? 2 : norm.strokeWidthPx;
  const shadowDepth = norm.hasBox ? 0 : (norm.hasShadow ? Math.max(2, norm.shadowOffsetY) : 0);

  // Alignment: 2 = Bottom-Center, 1 = Bottom-Left, 3 = Bottom-Right
  let alignment = 2;
  if (norm.textAlign === 'left') alignment = 1;
  if (norm.textAlign === 'right') alignment = 3;

  // MarginV from bottom: percentage relative to target canvas height
  const marginV = Math.max(20, Math.round((norm.positionYPercent / 100) * playResY));
  const marginL = Math.max(30, Math.round(((100 - (norm.maxWidthPercent || 90)) / 200) * playResX));
  const marginR = marginL;

  const isHindiCompatibleFont = (font: string): boolean => {
    const lower = font.toLowerCase();
    return (
      lower.includes('devanagari') ||
      lower.includes('nirmala') ||
      lower.includes('poppins') ||
      lower.includes('rozha') ||
      lower.includes('mukta') ||
      lower.includes('mangal')
    );
  };

  const hasAnyHindi = sorted.some((s) => DEVANAGARI_REGEX.test(s.text));
  const hindiFontFamily = isHindiCompatibleFont(primaryFontFamily)
    ? primaryFontFamily
    : 'Noto Sans Devanagari';

  // Build ASS Header and Style definitions
  const assLines: string[] = [
    '[Script Info]',
    `; Script generated by AutoCaption Studio`,
    `Title: ${title}`,
    `ScriptType: v4.00+`,
    `WrapStyle: 0`,
    `ScaledBorderAndShadow: yes`,
    `YCbCr Matrix: TV.709`,
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${primaryFontFamily},${fontSize},${primaryColor},${secondaryColor},${outlineColor},${norm.hasBox ? boxColor : shadowColor},${isBold},0,0,0,100,100,${norm.letterSpacingPx},0,${borderStyle},${outlineWidth},${shadowDepth},${alignment},${marginL},${marginR},${marginV},1`,
  ];

  if (hasAnyHindi && !isHindiCompatibleFont(primaryFontFamily)) {
    assLines.push(
      `Style: Hindi,${hindiFontFamily},${fontSize},${primaryColor},${secondaryColor},${outlineColor},${norm.hasBox ? boxColor : shadowColor},${isBold},0,0,0,100,100,${norm.letterSpacingPx},0,${borderStyle},${outlineWidth},${shadowDepth},${alignment},${marginL},${marginR},${marginV},1`
    );
  }

  assLines.push(
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  );

  sorted.forEach((seg) => {
    const rawText = seg.text.trim();
    if (!rawText) return;

    const isDevanagari = DEVANAGARI_REGEX.test(seg.text);
    const lineStyle = isDevanagari && !isHindiCompatibleFont(primaryFontFamily) ? 'Hindi' : 'Default';

    const segNorm = resolveNormalizedCaptionRendering({
      style,
      segment: seg,
      canvasWidth: playResX,
      canvasHeight: playResY,
    });

    let transformedText = rawText;
    if (segNorm.textTransform === 'uppercase') {
      transformedText = rawText.toUpperCase();
    } else if (segNorm.textTransform === 'lowercase') {
      transformedText = rawText.toLowerCase();
    } else if (segNorm.textTransform === 'capitalize') {
      transformedText = rawText.replace(/\\b\\w/g, (c) => c.toUpperCase());
    }

    const animPreset = seg.animation?.preset || seg.animation?.type || style.animation?.preset || style.animationType || 'pop';
    const entranceDuration = seg.animation?.entranceDurationMs || style.animation?.entranceDurationMs || 250;
    const exitDuration = seg.animation?.exitDurationMs || style.animation?.exitDurationMs || 200;

    let inlineTags = '';
    if (seg.styleOverrides) {
      if (seg.styleOverrides.textColor) {
        inlineTags += `\\c${toInlineAssColor(seg.styleOverrides.textColor)}`;
      }
      if (seg.styleOverrides.fontFamily) {
        const cleanFont = seg.styleOverrides.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim();
        if (cleanFont) inlineTags += `\\fn${cleanFont}`;
      }
      if (seg.styleOverrides.fontSize) {
        const overrideFs = Math.round(seg.styleOverrides.fontSize * FONT_SCALE_MULTIPLIER * getCanvasScaleFactor(playResX, playResY));
        inlineTags += `\\fs${overrideFs}`;
      }
      if (seg.styleOverrides.fontWeight !== undefined) {
        inlineTags += seg.styleOverrides.fontWeight >= 700 ? '\\b1' : '\\b0';
      }
      if (seg.styleOverrides.strokeColor) {
        inlineTags += `\\3c${toInlineAssColor(seg.styleOverrides.strokeColor)}`;
      }
      if (seg.styleOverrides.strokeWidth !== undefined) {
        inlineTags += `\\bord${Math.round(seg.styleOverrides.strokeWidth * FONT_SCALE_MULTIPLIER * getCanvasScaleFactor(playResX, playResY) * 0.75)}`;
      }
      if (seg.styleOverrides.hasShadow === false) {
        inlineTags += '\\shad0';
      } else if (seg.styleOverrides.shadowColor) {
        inlineTags += `\\4c${toInlineAssColor(seg.styleOverrides.shadowColor)}`;
      }
    }

    const hasWords = seg.words && seg.words.length > 0 && seg.words.some((w) => w.endMs > w.startMs);

    // 1. Karaoke Presets: karaoke-highlight & highlight-sweep
    if (hasWords && (animPreset === 'karaoke-highlight' || animPreset === 'highlight-sweep')) {
      const tagPrefix = inlineTags ? `{${inlineTags}\\fad(${entranceDuration},${exitDuration})}` : `{\\fad(${entranceDuration},${exitDuration})}`;
      const kTag = animPreset === 'highlight-sweep' ? '\\kf' : '\\k';
      const dialogueContent = seg.words!
        .map((w: CaptionWord) => {
          const durCs = Math.max(1, Math.round((w.endMs - w.startMs) / 10));
          const wordText = segNorm.textTransform === 'uppercase'
            ? w.text.toUpperCase()
            : segNorm.textTransform === 'lowercase'
            ? w.text.toLowerCase()
            : w.text;
          return `{${kTag}${durCs}}${wordText}`;
        })
        .join(' ')
        .replace(/\\r?\\n/g, '\\N');

      const start = formatAssTimestamp(seg.startMs);
      const end = formatAssTimestamp(seg.endMs);
      assLines.push(`Dialogue: 0,${start},${end},${lineStyle},,0,0,0,,${tagPrefix}${dialogueContent}`);
    }
    // 2. Timed Active Word Emphasis for all other presets (cinematic-trailer, fade, pop, etc.)
    else if (hasWords && segNorm.hasWordEmphasis && enableWordEmphasis) {
      const goldColor = toInlineAssColor(segNorm.activeWordColor);
      const baseColor = toInlineAssColor(segNorm.textColor);

      const words = seg.words!;
      const count = words.length;

      // Handle leading silence before first word if > 60ms
      if (words[0]!.startMs > seg.startMs + 60) {
        const preStart = formatAssTimestamp(seg.startMs);
        const preEnd = formatAssTimestamp(words[0]!.startMs);
        const preText = transformedText.replace(/\r?\n/g, '\\N');
        assLines.push(`Dialogue: 0,${preStart},${preEnd},${lineStyle},,0,0,0,,{\\fad(${entranceDuration},0)}${preText}`);
      }

      // Generate a timed dialogue event for each word interval
      for (let i = 0; i < count; i++) {
        const curWord = words[i]!;
        const wordStartMs = Math.max(seg.startMs, curWord.startMs);
        const nextStartMs = i < count - 1 ? words[i + 1]!.startMs : seg.endMs;
        const wordEndMs = Math.min(seg.endMs, Math.max(curWord.endMs, nextStartMs));

        if (wordEndMs <= wordStartMs) continue;

        const start = formatAssTimestamp(wordStartMs);
        const end = formatAssTimestamp(wordEndMs);

        const isFirstEvent = i === 0 && wordStartMs <= seg.startMs + 60;
        const isLastEvent = i === count - 1 && wordEndMs >= seg.endMs - 60;

        let fadeTag = '';
        if (isFirstEvent && isLastEvent) {
          fadeTag = `\\fad(${entranceDuration},${exitDuration})`;
        } else if (isFirstEvent) {
          fadeTag = `\\fad(${entranceDuration},0)`;
        } else if (isLastEvent) {
          fadeTag = `\\fad(0,${exitDuration})`;
        }

        const tags = [fadeTag, inlineTags].filter(Boolean).join('');
        const prefix = tags ? `{${tags}}` : '';

        // Build line text with the i-th word highlighted in golden accent
        const lineText = words
          .map((w, idx) => {
            const wText = segNorm.textTransform === 'uppercase'
              ? w.text.toUpperCase()
              : segNorm.textTransform === 'lowercase'
              ? w.text.toLowerCase()
              : w.text;
            if (idx === i) {
              return `{\\c${goldColor}}${wText}{\\c${baseColor}}`;
            }
            return wText;
          })
          .join(' ')
          .replace(/\r?\n/g, '\\N');

        assLines.push(`Dialogue: 0,${start},${end},${lineStyle},,0,0,0,,${prefix}${lineText}`);
      }

      // Handle trailing silence after last word if > 60ms
      const lastWord = words[count - 1]!;
      if (seg.endMs > lastWord.endMs + 60) {
        const postStart = formatAssTimestamp(lastWord.endMs);
        const postEnd = formatAssTimestamp(seg.endMs);
        const postText = transformedText.replace(/\r?\n/g, '\\N');
        assLines.push(`Dialogue: 0,${postStart},${postEnd},${lineStyle},,0,0,0,,{\\fad(0,${exitDuration})}${postText}`);
      }
    }
    // 3. Segment without word timings or standard whole-segment animation
    else {
      let fadeTag = '';
      if (animPreset === 'fade' || animPreset === 'fade-in' || animPreset === 'fade-out') {
        const inMs = animPreset === 'fade-out' ? 0 : entranceDuration;
        const outMs = animPreset === 'fade-in' ? 0 : exitDuration;
        fadeTag = `\\fad(${inMs},${outMs})`;
      } else if (entranceDuration > 0 || exitDuration > 0) {
        fadeTag = `\\fad(${entranceDuration},${exitDuration})`;
      }

      const tags = [fadeTag, inlineTags].filter(Boolean).join('');
      const prefix = tags ? `{${tags}}` : '';
      const start = formatAssTimestamp(seg.startMs);
      const end = formatAssTimestamp(seg.endMs);
      const cleanText = transformedText.replace(/\r?\n/g, '\\N');

      assLines.push(`Dialogue: 0,${start},${end},${lineStyle},,0,0,0,,${prefix}${cleanText}`);
    }
  });

  return assLines.join('\n');
}

export interface AnimationExportSupport {
  isFullySupported: boolean;
  status: 'native' | 'fallback';
  description: string;
}

/**
 * Returns rendering pipeline compatibility information for a given animation preset.
 * Natively supported ASS effects: fade, karaoke-highlight.
 * Fallback effects (rendered with smooth entrance/exit fade): pop, slide-up, typewriter, etc.
 */
export function getAnimationExportSupport(preset: CaptionAnimationPreset): AnimationExportSupport {
  switch (preset) {
    case 'fade':
      return {
        isFullySupported: true,
        status: 'native',
        description: 'Native hardware ASS alpha fade transitions (\\fad)',
      };
    case 'fade-in':
      return {
        isFullySupported: true,
        status: 'native',
        description: 'Native hardware ASS entrance fade transition (\\fad)',
      };
    case 'fade-out':
      return {
        isFullySupported: true,
        status: 'native',
        description: 'Native hardware ASS exit fade transition (\\fad)',
      };
    case 'karaoke-highlight':
      return {
        isFullySupported: true,
        status: 'native',
        description: 'Native word-level timing highlight tags (\\k)',
      };
    default:
      return {
        isFullySupported: false,
        status: 'fallback',
        description: 'Rendered with smooth entrance/exit fade fallback in burned-in video',
      };
  }
}

