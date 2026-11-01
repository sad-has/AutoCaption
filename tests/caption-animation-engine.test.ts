import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeCaptionAnimation,
  areWordTimingsReliable,
  clamp,
  lerp,
  easeOutCubic,
  easeOutBack,
  DEFAULT_ANIMATION_CONFIG,
} from '../src/shared/animations/engine';
import {
  getAnimationExportSupport,
  isFullySupportedInASS,
  ANIMATION_EXPORT_CAPABILITIES,
} from '../src/shared/animations/exportSupport';
import { useAppStore } from '../src/renderer/src/store/useAppStore';
import type { CaptionSegment, CaptionStyle, CaptionWord } from '../src/shared/types';

describe('Caption Animation Engine', () => {
  const sampleStyle: CaptionStyle = {
    presetId: 'test-preset',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 44,
    fontWeight: 700,
    textColor: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    lineHeight: 1.2,
    textAlign: 'center',
    maxWidthPercent: 90,
    strokeColor: '#000000',
    strokeWidth: 2,
    hasShadow: true,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    hasBox: false,
    boxColor: '#000000',
    boxOpacity: 0.8,
    boxPaddingX: 12,
    boxPaddingY: 6,
    boxCornerRadius: 4,
    positionYPercent: 20,
    positionXPercent: 50,
    hasWordEmphasis: true,
    activeWordColor: '#F59E0B',
    activeWordScale: 1.15,
  };

  const sampleWordsWithTimings: CaptionWord[] = [
    { id: 'w1', text: 'CREATE', startMs: 1000, endMs: 1400 },
    { id: 'w2', text: 'VIRAL', startMs: 1450, endMs: 1900 },
    { id: 'w3', text: 'CAPTIONS', startMs: 1950, endMs: 2500 },
  ];

  const sampleSegmentWithWords: CaptionSegment = {
    id: 'seg-1',
    startMs: 1000,
    endMs: 3000,
    text: 'CREATE VIRAL CAPTIONS',
    words: sampleWordsWithTimings,
  };

  const sampleSegmentNoWords: CaptionSegment = {
    id: 'seg-no-words',
    startMs: 1000,
    endMs: 3000,
    text: 'SEGMENT ONLY TIMINGS',
    words: [], // Provider returned segment-level timestamps only
  };

  beforeEach(() => {
    useAppStore.setState({
      globalAnimation: { ...DEFAULT_ANIMATION_CONFIG },
      currentProject: {
        id: 'anim-proj',
        name: 'Animation Test Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaAsset: null,
        captionSegments: [sampleSegmentWithWords, sampleSegmentNoWords],
        captionStyle: sampleStyle,
        aspectRatio: '9:16',
      },
    });
  });

  describe('Boundary Timing & Visibility Guarantees', () => {
    it('is invisible before segment startMs and after segment endMs', () => {
      // 100ms before segment
      const before = computeCaptionAnimation({
        currentTimeMs: 900,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
      });
      expect(before.isVisible).toBe(false);
      expect(before.opacity).toBe(0);

      // 100ms after segment
      const after = computeCaptionAnimation({
        currentTimeMs: 3100,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
      });
      expect(after.isVisible).toBe(false);
      expect(after.opacity).toBe(0);
    });

    it('is visible and active throughout segment duration', () => {
      const activeMid = computeCaptionAnimation({
        currentTimeMs: 2000,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
      });
      expect(activeMid.isVisible).toBe(true);
      expect(activeMid.opacity).toBeGreaterThan(0);
    });

    it('interpolates entrance transition from 0 to 1 over entranceDurationMs', () => {
      // At start (1000ms): entranceProgress is 0 -> opacity starts low
      const atStart = computeCaptionAnimation({
        currentTimeMs: 1000,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'fade', entranceDurationMs: 200 },
      });
      expect(atStart.isVisible).toBe(true);
      expect(atStart.opacity).toBe(0);

      // At entrance midpoint (1100ms): entranceProgress is 0.5 -> opacity is 0.5
      const atMidEntrance = computeCaptionAnimation({
        currentTimeMs: 1100,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'fade', entranceDurationMs: 200 },
      });
      expect(atMidEntrance.opacity).toBeCloseTo(0.5, 2);

      // Past entrance (1250ms): entranceProgress is 1.0 -> full opacity
      const afterEntrance = computeCaptionAnimation({
        currentTimeMs: 1250,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'fade', entranceDurationMs: 200 },
      });
      expect(afterEntrance.opacity).toBe(1.0);
    });

    it('interpolates exit transition from 1 to 0 over exitDurationMs before segment ends', () => {
      // Exit duration 200ms -> segment ends at 3000ms -> exit starts at 2800ms
      const beforeExit = computeCaptionAnimation({
        currentTimeMs: 2750,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'fade', exitDurationMs: 200 },
      });
      expect(beforeExit.opacity).toBe(1.0);

      // Halfway through exit at 2900ms -> opacity is 0.5
      const midExit = computeCaptionAnimation({
        currentTimeMs: 2900,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'fade', exitDurationMs: 200 },
      });
      expect(midExit.opacity).toBeCloseTo(0.5, 2);

      // At end 3000ms -> opacity is 0
      const atEnd = computeCaptionAnimation({
        currentTimeMs: 3000,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'fade', exitDurationMs: 200 },
      });
      expect(atEnd.opacity).toBe(0);
    });
  });

  describe('Deterministic Scrubbing, Reverse Seeking & Pause Fidelity', () => {
    it('produces identical visual output during forward and reverse seeking', () => {
      const times = [1050, 1200, 1750, 2400, 2900];

      // Forward seek simulation
      const forwardStates = times.map((t) =>
        computeCaptionAnimation({
          currentTimeMs: t,
          segment: sampleSegmentWithWords,
          style: sampleStyle,
          configOverride: { preset: 'pop', intensity: 1.2 },
        })
      );

      // Reverse seek simulation
      const reverseStates = [...times].reverse().map((t) =>
        computeCaptionAnimation({
          currentTimeMs: t,
          segment: sampleSegmentWithWords,
          style: sampleStyle,
          configOverride: { preset: 'pop', intensity: 1.2 },
        })
      );

      // Check mathematical equivalence at matching timestamps
      times.forEach((_, idx) => {
        const fwd = forwardStates[idx]!;
        const rev = reverseStates[reverseStates.length - 1 - idx]!;
        expect(fwd.opacity).toBe(rev.opacity);
        expect(fwd.transform).toBe(rev.transform);
        expect(fwd.wordStates?.length).toBe(rev.wordStates?.length);
      });
    });

    it('maintains perfectly stable frame state during pause', () => {
      const pausedTime = 1650;
      const state1 = computeCaptionAnimation({
        currentTimeMs: pausedTime,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
      });
      const state2 = computeCaptionAnimation({
        currentTimeMs: pausedTime,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
      });

      expect(state1).toEqual(state2);
    });
  });

  describe('Animation Presets & Mathematical Transformations', () => {
    it('computes Pop preset with scale spring animation', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1100, // in entrance window
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'pop', entranceDurationMs: 250, intensity: 1.0 },
      });

      expect(state.transform).toMatch(/^scale\(\d+\.\d+\)$/);
      expect(state.opacity).toBeGreaterThan(0);
    });

    it('computes Slide Up preset with vertical translateY translation', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1050,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'slide-up', entranceDurationMs: 200, intensity: 1.0 },
      });

      expect(state.transform).toMatch(/^translateY\(\d+(\.\d+)?px\)$/);
    });

    it('computes Slide Down preset with negative vertical translateY translation', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1050,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'slide-down', entranceDurationMs: 200, intensity: 1.0 },
      });

      expect(state.transform).toMatch(/^translateY\(-\d+(\.\d+)?px\)$/);
    });

    it('computes Cinematic Letter Reveal with dynamic tracking and depth blur', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1050, // near entrance start
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'cinematic-letter-reveal', entranceDurationMs: 300, intensity: 1.0 },
      });

      // Letter spacing should start expanded beyond base 1.5px
      expect(state.letterSpacingPx).toBeGreaterThan(1.5);
      // Blur should start non-zero and clear up
      expect(state.blurPx).toBeGreaterThan(0);

      // At resting state
      const resting = computeCaptionAnimation({
        currentTimeMs: 1600,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'cinematic-letter-reveal', entranceDurationMs: 300 },
      });
      expect(resting.letterSpacingPx).toBe(1.5);
      expect(resting.blurPx).toBe(0);
    });

    it('computes Static (none) preset with zero motion and instant opacity', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1010,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'none' },
      });

      expect(state.opacity).toBe(1);
      expect(state.transform).toBe('none');
    });
  });

  describe('Word Timings & Segment-Only Timestamps Handling ("No Invention Policy")', () => {
    it('accurately distinguishes reliable word timings from segment-only placeholders', () => {
      // 1. Real word timings with positive durations
      expect(areWordTimingsReliable(sampleWordsWithTimings)).toBe(true);

      // 2. Empty words array
      expect(areWordTimingsReliable([])).toBe(false);

      // 3. Undefined
      expect(areWordTimingsReliable(undefined)).toBe(false);

      // 4. Dummy placeholder where words have zero duration
      const zeroDurationWords: CaptionWord[] = [
        { id: 'z1', text: 'ZERO', startMs: 1000, endMs: 1000 },
        { id: 'z2', text: 'DURATION', startMs: 1000, endMs: 1000 },
      ];
      expect(areWordTimingsReliable(zeroDurationWords)).toBe(false);
    });

    it('does NOT invent word timings when the transcription provider returns segment-only timestamps', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1500,
        segment: sampleSegmentNoWords, // Segment with empty words array
        style: sampleStyle,
        configOverride: { preset: 'word-reveal' },
      });

      // Must NOT fabricate wordStates with fake timestamps
      expect(state.wordStates).toBeUndefined();
      // Whole segment text must be cleanly rendered
      expect(state.renderedText).toBe('SEGMENT ONLY TIMINGS');
      expect(state.isVisible).toBe(true);
    });

    it('evaluates word-level timing, highlighting, and progressive reveal when words are reliable', () => {
      // At 1600ms: word 'VIRAL' (1450-1900) is active
      const state = computeCaptionAnimation({
        currentTimeMs: 1600,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'word-reveal', wordEmphasis: true },
      });

      expect(state.wordStates).toBeDefined();
      expect(state.wordStates).toHaveLength(3);

      const [w1, w2, w3] = state.wordStates!;

      // Word 1 ('CREATE'): past -> visible and rendered
      expect(w1?.isVisible).toBe(true);
      expect(w1?.opacity).toBe(1);

      // Word 2 ('VIRAL'): currently active -> highlighted and emphasized
      expect(w2?.isVisible).toBe(true);
      expect(w2?.isHighlighted).toBe(true);
      expect(w2?.color).toBe(sampleStyle.activeWordColor);

      // Word 3 ('CAPTIONS'): future -> hidden in word-reveal mode
      expect(w3?.isVisible).toBe(false);
      expect(w3?.opacity).toBe(0);
    });

    it('tracks Karaoke Highlight: active and past words are colored with highlightColor', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1600, // Word 2 active (1450-1900)
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'karaoke-highlight', highlightColor: '#10B981' },
      });

      expect(state.wordStates).toBeDefined();
      const [w1, w2, w3] = state.wordStates!;

      // Past word 'CREATE' is read -> stays highlighted
      expect(w1?.color).toBe('#10B981');
      // Active word 'VIRAL' -> highlighted
      expect(w2?.color).toBe('#10B981');
      // Future word 'CAPTIONS' -> standard text color
      expect(w3?.color).toBe(sampleStyle.textColor);
    });

    it('renders Typewriter character reveal sequentially over segment duration for segment-only timestamps', () => {
      // Halfway through segment
      const midState = computeCaptionAnimation({
        currentTimeMs: 2000, // half of 1000 - 3000ms
        segment: sampleSegmentNoWords,
        style: sampleStyle,
        configOverride: { preset: 'typewriter' },
      });

      expect(midState.renderedText).toBeDefined();
      expect(midState.renderedText!.length).toBeGreaterThan(0);
      expect(midState.renderedText!.length).toBeLessThan(sampleSegmentNoWords.text.length);
    });
  });

  describe('Accessibility & Reduced Motion Preferences', () => {
    it('disables movement, scaling and blur when prefersReducedMotion is true', () => {
      const reducedState = computeCaptionAnimation({
        currentTimeMs: 1080,
        segment: sampleSegmentWithWords,
        style: sampleStyle,
        configOverride: { preset: 'pop', intensity: 1.5 },
        prefersReducedMotion: true,
      });

      // No transform
      expect(reducedState.transform).toBe('none');
      // No blur
      expect(reducedState.blurPx).toBeUndefined();
      // Simple gentle opacity
      expect(reducedState.opacity).toBeGreaterThan(0);

      // Words still receive color change for readability, but no scaling
      expect(reducedState.wordStates?.[0]?.scale).toBe(1);
    });
  });

  describe('Global Default vs Per-Caption Override Architecture', () => {
    it('applies per-caption animation override when defined on segment', () => {
      const segmentWithOverride: CaptionSegment = {
        ...sampleSegmentWithWords,
        animation: {
          type: 'fade',
          preset: 'fade',
          entranceDurationMs: 150,
        },
      };

      // Global animation is 'pop', but segment overrides with 'fade'
      const state = computeCaptionAnimation({
        currentTimeMs: 1100,
        segment: segmentWithOverride,
        style: sampleStyle,
      });

      expect(state.transform).toBe('none'); // Fade uses no transform
      expect(state.opacity).toBeGreaterThan(0);
    });

    it('falls back to global animation default when segment has no override', () => {
      const state = computeCaptionAnimation({
        currentTimeMs: 1100,
        segment: sampleSegmentWithWords, // No animation override
        style: sampleStyle,
      });

      // Default is 'pop' -> scale transform present
      expect(state.transform).toContain('scale');
    });

    it('supports setting, updating and clearing per-caption overrides via store actions', () => {
      const store = useAppStore.getState();

      // 1. Set override on seg-1
      store.setSegmentAnimation('seg-1', {
        preset: 'slide-down',
        entranceDurationMs: 300,
        exitDurationMs: 150,
        intensity: 1.4,
        wordEmphasis: true,
      });

      const updatedSeg = useAppStore.getState().currentProject.captionSegments.find((s) => s.id === 'seg-1');
      expect(updatedSeg?.animation?.preset).toBe('slide-down');
      expect(updatedSeg?.animation?.entranceDurationMs).toBe(300);

      // 2. Remove override -> falls back to global default
      store.removeSegmentAnimationOverride('seg-1');
      const clearedSeg = useAppStore.getState().currentProject.captionSegments.find((s) => s.id === 'seg-1');
      expect(clearedSeg?.animation).toBeUndefined();
    });
  });

  describe('Export Compatibility Matrix & Pipeline Documentation', () => {
    it('documents export capabilities for every animation preset', () => {
      const presets = Object.keys(ANIMATION_EXPORT_CAPABILITIES);
      expect(presets.length).toBeGreaterThanOrEqual(10);

      presets.forEach((presetKey) => {
        const cap = getAnimationExportSupport(presetKey as any);
        expect(cap.displayName).toBeTruthy();
        expect(['full', 'partial', 'preview-only']).toContain(cap.supportLevelASS);
        expect(['full', 'partial', 'preview-only']).toContain(cap.supportLevelCanvas);
        expect(['full', 'partial', 'preview-only']).toContain(cap.supportLevelSRT);
        expect(cap.description).toBeTruthy();
      });
    });

    it('identifies natively supported ASS burn-in presets (fade, karaoke-highlight, none)', () => {
      expect(isFullySupportedInASS('none')).toBe(true);
      expect(isFullySupportedInASS('fade')).toBe(true);
      expect(isFullySupportedInASS('karaoke-highlight')).toBe(true);

      // Presets requiring frame rasterization or approximation
      expect(isFullySupportedInASS('cinematic-letter-reveal')).toBe(false);
      expect(isFullySupportedInASS('pop')).toBe(false);
    });

    it('provides export warning and recommended fallback for canvas-only effects', () => {
      const cinematicCap = getAnimationExportSupport('cinematic-letter-reveal');
      expect(cinematicCap.exportWarning).toBeTruthy();
      expect(cinematicCap.recommendedAlternative).toBe('fade');
    });
  });
});
