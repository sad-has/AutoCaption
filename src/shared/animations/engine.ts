import type {
  CaptionAnimationConfig,
  CaptionAnimationPreset,
  CaptionSegment,
  CaptionStyle,
  CaptionWord,
} from '../types';

export type { CaptionAnimationPreset };

export const DEFAULT_ANIMATION_CONFIG: CaptionAnimationConfig = {
  preset: 'pop',
  entranceDurationMs: 250,
  exitDurationMs: 200,
  intensity: 1.0,
  wordEmphasis: true,
  delayMs: 0,
  staggerMs: 0,
};

export interface ComputedWordAnimation {
  id: string;
  text: string;
  isVisible: boolean;
  opacity: number;
  color: string;
  scale: number;
  backgroundColor?: string;
  isHighlighted: boolean;
  blurPx?: number;
  transform: string;
}

export interface ComputedSegmentAnimation {
  isVisible: boolean;
  opacity: number;
  transform: string;
  letterSpacingPx?: number;
  blurPx?: number;
  renderedText?: string;
  wordStates?: ComputedWordAnimation[];
}

export interface ComputeAnimationOptions {
  currentTimeMs: number;
  segment: CaptionSegment;
  style: CaptionStyle;
  configOverride?: Partial<CaptionAnimationConfig>;
  prefersReducedMotion?: boolean;
}

// Math & Easing Helpers
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutBack(t: number, overshoot = 1.70158): number {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const t2 = t - 1.5 / d1;
    return n1 * t2 * t2 + 0.75;
  } else if (t < 2.5 / d1) {
    const t3 = t - 2.25 / d1;
    return n1 * t3 * t3 + 0.9375;
  } else {
    const t4 = t - 2.625 / d1;
    return n1 * t4 * t4 + 0.984375;
  }
}

/**
 * Checks system preferences for reduced motion.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

/**
 * Checks whether the segment contains valid, reliable word timings.
 * Returns false if word list is missing, empty, or dummy-filled with segment bounds.
 */
export function areWordTimingsReliable(words?: CaptionWord[]): boolean {
  if (!words || words.length === 0) return false;

  // If there's only 1 word, verify it has positive duration
  if (words.length === 1) {
    const w = words[0];
    return w !== undefined && w.endMs > w.startMs;
  }

  // If multiple words exist, check that timestamps are non-zero and not all identical
  let distinctTimings = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w) continue;
    if (w.endMs > w.startMs) {
      distinctTimings++;
    }
  }

  // At least 2 words must have distinct positive durations to be considered reliable speech timing
  return distinctTimings >= Math.min(2, words.length);
}

/**
 * Pure, deterministic caption animation evaluator.
 * Computes the exact visual state of the caption and its words at any given millisecond.
 * Perfectly handles pause, real-time playback, scrubbing, and reverse seeking.
 */
export function computeCaptionAnimation(options: ComputeAnimationOptions): ComputedSegmentAnimation {
  const { currentTimeMs, segment, style, configOverride, prefersReducedMotion = false } = options;

  // 1. Boundary check: If current time is outside segment bounds, caption is not visible
  if (currentTimeMs < segment.startMs || currentTimeMs > segment.endMs) {
    return {
      isVisible: false,
      opacity: 0,
      transform: 'none',
    };
  }

  // 2. Resolve effective animation config: per-segment override -> style.animation -> default
  const baseConfig: CaptionAnimationConfig = {
    ...DEFAULT_ANIMATION_CONFIG,
    ...(style.animation || {}),
    ...(configOverride || {}),
  };

  // If style.animationType exists and config wasn't explicitly overridden, respect it
  if (style.animationType && !configOverride?.preset && !style.animation?.preset) {
    baseConfig.preset = style.animationType;
  }

  // If segment has specific animation override
  if (segment.animation?.type) {
    baseConfig.preset = segment.animation.type;
  }
  if (segment.animation?.durationMs) {
    baseConfig.entranceDurationMs = segment.animation.durationMs;
  }

  const preset = baseConfig.preset;
  const intensity = clamp(baseConfig.intensity ?? 1.0, 0.1, 2.0);
  const highlightColor = baseConfig.highlightColor || style.activeWordColor || '#EAB308';
  const hasWordEmphasis = baseConfig.wordEmphasis && style.hasWordEmphasis !== false;

  const segmentDuration = segment.endMs - segment.startMs;
  const delayMs = clamp(baseConfig.delayMs || 0, 0, Math.floor(segmentDuration / 3));

  // Actual timing inside segment
  const elapsedMs = Math.max(0, currentTimeMs - segment.startMs - delayMs);
  const remainingMs = Math.max(0, segment.endMs - currentTimeMs);

  // Entrance and exit duration clamped to half duration so they don't overlap awkwardly
  const entranceDurationMs = Math.min(baseConfig.entranceDurationMs, Math.max(50, segmentDuration / 2));
  const exitDurationMs = Math.min(baseConfig.exitDurationMs, Math.max(50, segmentDuration / 2));

  const entranceProgress = entranceDurationMs > 0 ? clamp(elapsedMs / entranceDurationMs, 0, 1) : 1;
  const exitProgress = exitDurationMs > 0 ? clamp(remainingMs / exitDurationMs, 0, 1) : 1;

  // 3. Handle Reduced Motion preference: Disable aggressive transforms
  if (prefersReducedMotion || preset === 'none') {
    const opacity = preset === 'none' ? 1 : clamp(entranceProgress * exitProgress, 0, 1);
    const wordsReliable = areWordTimingsReliable(segment.words);

    let wordStates: ComputedWordAnimation[] | undefined;
    if (wordsReliable && segment.words) {
      wordStates = segment.words.map((word) => {
        const isActive = currentTimeMs >= word.startMs && currentTimeMs <= word.endMs;
        return {
          id: word.id,
          text: word.text,
          isVisible: true,
          opacity: 1,
          color: isActive && hasWordEmphasis ? highlightColor : style.textColor,
          scale: 1,
          isHighlighted: isActive && hasWordEmphasis,
          transform: 'none',
        };
      });
    }

    return {
      isVisible: true,
      opacity,
      transform: 'none',
      wordStates,
    };
  }

  // 4. Calculate Container Transforms & Visual Attributes based on Preset
  let containerOpacity = clamp(entranceProgress * exitProgress, 0, 1);
  let containerTransform = 'none';
  let letterSpacingPx = style.letterSpacing;
  let blurPx: number | undefined;
  let renderedText: string | undefined;

  switch (preset) {
    case 'fade': {
      // Pure smooth alpha transition
      containerOpacity = clamp(entranceProgress * exitProgress, 0, 1);
      containerTransform = 'none';
      break;
    }

    case 'fade-in': {
      // Smooth entrance dissolve, steady exit
      containerOpacity = clamp(easeOutCubic(entranceProgress) * exitProgress, 0, 1);
      containerTransform = 'none';
      break;
    }

    case 'fade-out': {
      // Steady entrance, smooth exit dissolve
      containerOpacity = clamp(entranceProgress * easeInQuad(exitProgress), 0, 1);
      containerTransform = 'none';
      break;
    }

    case 'scale': {
      // Elastic dynamic scale entrance
      const easedEntrance = easeOutBack(entranceProgress, 1.25 * intensity);
      const scaleEntrance = lerp(0.76, 1.0, easedEntrance);
      const scaleExit = exitProgress < 1 ? lerp(0.85, 1.0, exitProgress) : 1.0;
      const finalScale = scaleEntrance * scaleExit;
      containerTransform = `scale(${finalScale.toFixed(3)})`;
      break;
    }

    case 'pop': {
      const easedEntrance = easeOutBack(entranceProgress, 1.35 * intensity);
      const scaleEntrance = lerp(0.65, 1.0, easedEntrance);
      const scaleExit = exitProgress < 1 ? lerp(0.85, 1.0, exitProgress) : 1.0;
      const finalScale = scaleEntrance * scaleExit;
      containerTransform = `scale(${finalScale.toFixed(3)})`;
      break;
    }

    case 'slide-up': {
      const startOffsetY = 36 * intensity;
      const exitOffsetY = -24 * intensity;
      const offsetY = lerp(startOffsetY, 0, easeOutCubic(entranceProgress)) +
        lerp(0, exitOffsetY, 1 - exitProgress);
      containerTransform = `translateY(${offsetY.toFixed(1)}px)`;
      break;
    }

    case 'slide-down': {
      const startOffsetY = -36 * intensity;
      const exitOffsetY = 24 * intensity;
      const offsetY = lerp(startOffsetY, 0, easeOutCubic(entranceProgress)) +
        lerp(0, exitOffsetY, 1 - exitProgress);
      containerTransform = `translateY(${offsetY.toFixed(1)}px)`;
      break;
    }

    case 'bounce': {
      const bounceY = lerp(-40 * intensity, 0, easeOutBounce(entranceProgress));
      containerTransform = `translateY(${bounceY.toFixed(1)}px)`;
      break;
    }

    case 'cinematic-letter-reveal': {
      // Letter spacing smoothly contracts from expanded to base, blur clears
      const expandedSpacing = style.letterSpacing + 6 * intensity;
      letterSpacingPx = lerp(expandedSpacing, style.letterSpacing, easeOutCubic(entranceProgress));
      blurPx = lerp(5 * intensity, 0, easeOutQuad(entranceProgress));
      containerOpacity = clamp(entranceProgress * exitProgress, 0, 1);
      break;
    }

    case 'typewriter': {
      containerOpacity = clamp(exitProgress, 0, 1);
      // Typewriter handles text reveal below
      break;
    }

    case 'word-reveal':
    case 'karaoke-highlight':
    case 'emphasis-scale': {
      // Container remains stable; animations occur at word level
      containerOpacity = clamp(exitProgress, 0, 1);
      containerTransform = 'none';
      break;
    }
  }

  // 5. Calculate Word-Level Animation States
  const wordsReliable = areWordTimingsReliable(segment.words);

  let wordStates: ComputedWordAnimation[] | undefined;

  if (wordsReliable && segment.words && segment.words.length > 0) {
    wordStates = segment.words.map((word, index) => {
      const isPast = currentTimeMs > word.endMs;
      const isActive = currentTimeMs >= word.startMs && currentTimeMs <= word.endMs;
      const isFuture = currentTimeMs < word.startMs;

      let wordVisible = true;
      let wordOpacity = 1;
      let wordColor = style.textColor;
      let wordScale = 1;
      let wordBgColor = style.activeWordBgColor;
      let wordTransform = 'none';

      // Preset specific word styling
      if (preset === 'word-reveal') {
        if (isFuture) {
          wordVisible = false;
          wordOpacity = 0;
        } else if (isActive) {
          // Word just appeared: subtle pop
          const wordElapsed = currentTimeMs - word.startMs;
          const wordProgress = clamp(wordElapsed / 150, 0, 1);
          wordScale = lerp(1.2 * intensity, 1.0, easeOutBack(wordProgress, 1.2));
          wordOpacity = 1;
          wordColor = hasWordEmphasis ? highlightColor : style.textColor;
        } else {
          wordVisible = true;
          wordOpacity = 1;
          wordColor = style.textColor;
        }
      } else if (preset === 'karaoke-highlight') {
        if (isActive) {
          wordColor = highlightColor;
          wordScale = hasWordEmphasis ? lerp(1.0, 1.12 * intensity, 1) : 1;
        } else if (isPast) {
          // In karaoke, read words stay highlighted in accent or reading color
          wordColor = highlightColor;
        } else {
          // Future unread words stay standard text color
          wordColor = style.textColor;
        }
      } else if (preset === 'emphasis-scale') {
        if (isActive) {
          const wordDuration = Math.max(100, word.endMs - word.startMs);
          const wordProgress = clamp((currentTimeMs - word.startMs) / wordDuration, 0, 1);
          // Sine curve pulse: swells up and settles
          const pulse = Math.sin(wordProgress * Math.PI);
          wordScale = 1 + (style.activeWordScale ? (style.activeWordScale - 1) : 0.2) * intensity * pulse;
          wordColor = highlightColor;
          wordBgColor = style.activeWordBgColor;
        } else {
          wordColor = style.textColor;
          wordScale = 1;
        }
      } else if (preset === 'highlight-sweep') {
        if (isActive) {
          const wordElapsed = currentTimeMs - word.startMs;
          const wordDuration = Math.max(100, word.endMs - word.startMs);
          const progress = clamp(wordElapsed / wordDuration, 0, 1);
          wordScale = lerp(1.2 * intensity, 1.05, easeOutCubic(progress));
          wordColor = highlightColor;
          wordOpacity = 1;
        } else if (isPast) {
          wordColor = highlightColor;
          wordOpacity = 0.95;
        } else {
          wordColor = style.textColor;
          wordOpacity = 0.65;
        }
      } else if (preset === 'typewriter') {
        // Words reveal up to the active speech position
        if (isFuture) {
          wordVisible = false;
          wordOpacity = 0;
        } else {
          wordVisible = true;
          wordOpacity = 1;
          wordColor = isActive && hasWordEmphasis ? highlightColor : style.textColor;
        }
      } else {
        // General presets (fade, pop, slide, bounce, scale, cinematic): standard karaoke word emphasis
        if (isActive && hasWordEmphasis) {
          wordColor = highlightColor;
          wordScale = style.activeWordScale || (1.0 + 0.1 * intensity);
          wordOpacity = 1;
        } else {
          wordColor = style.textColor;
          wordScale = 1;
          wordOpacity = style.presetId === 'spotlight-line' ? 0.55 : 1;
        }
      }

      wordTransform = wordScale !== 1 ? `scale(${wordScale.toFixed(3)})` : 'none';

      return {
        id: word.id || `w-${index}`,
        text: word.text,
        isVisible: wordVisible,
        opacity: wordOpacity,
        color: wordColor,
        scale: wordScale,
        backgroundColor: isActive && hasWordEmphasis ? wordBgColor : undefined,
        isHighlighted: isActive && hasWordEmphasis,
        transform: wordTransform,
      };
    });
  } else {
    // Word timings are NOT reliable or segment-only timestamps returned:
    // Do NOT invent word timings. Handle entire segment text cleanly!
    if (preset === 'typewriter') {
      const progress = clamp(elapsedMs / Math.max(200, segmentDuration - exitDurationMs), 0, 1);
      const charsToReveal = Math.round(progress * segment.text.length);
      renderedText = segment.text.substring(0, charsToReveal);
    } else {
      renderedText = segment.text;
    }
  }

  return {
    isVisible: true,
    opacity: containerOpacity,
    transform: containerTransform,
    letterSpacingPx,
    blurPx,
    renderedText,
    wordStates,
  };
}
