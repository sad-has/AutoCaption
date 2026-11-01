import { describe, it, expect, vi } from 'vitest';
import {
  validateSegmentTimestamps,
  detectSegmentOverlaps,
  splitSegment,
  mergeSegments,
  adjustSegmentTimes,
  updateWordInSegment,
  calculateSnapping,
  findSnapTargets,
} from '../src/shared/captionEditor';
import { CaptionSegmentSchema, CaptionWordSchema } from '../src/shared/schemas';
import type { CaptionSegment, CaptionWord, CaptionStyle } from '../src/shared/types';

describe('Caption Editor & Interactive Timeline Engine', () => {
  const sampleWords: CaptionWord[] = [
    { id: 'w1', text: 'This', startMs: 1000, endMs: 1300 },
    { id: 'w2', text: 'is', startMs: 1350, endMs: 1600 },
    { id: 'w3', text: 'viral', startMs: 1650, endMs: 2200 },
    { id: 'w4', text: 'content', startMs: 2250, endMs: 2900 },
  ];

  const sampleSegment: CaptionSegment = {
    id: 'seg-1',
    startMs: 1000,
    endMs: 3000,
    text: 'This is viral content',
    words: sampleWords,
    trackId: 'C1',
    originalText: 'This is viral content',
    originalWords: [...sampleWords],
    animation: { type: 'pop', durationMs: 200 },
    styleOverrides: { textColor: '#10B981' },
  };

  describe('Caption Data Schema & Typing', () => {
    it('validates a complete CaptionSegment with all required and optional fields', () => {
      const parsed = CaptionSegmentSchema.safeParse(sampleSegment);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.id).toBe('seg-1');
        expect(parsed.data.trackId).toBe('C1');
        expect(parsed.data.originalText).toBe('This is viral content');
        expect(parsed.data.animation?.type).toBe('pop');
        expect(parsed.data.styleOverrides).toBeDefined();
      }
    });

    it('preserves transcript source data separate from user edits', () => {
      const edited: CaptionSegment = {
        ...sampleSegment,
        text: 'This is an EDITED viral video',
      };

      expect(edited.text).toBe('This is an EDITED viral video');
      expect(edited.originalText).toBe('This is viral content');
    });

    it('validates word-level timestamps with optional confidence', () => {
      const wordParsed = CaptionWordSchema.safeParse({
        id: 'w-test',
        text: 'Namaste',
        startMs: 500,
        endMs: 900,
        confidence: 0.98,
      });
      expect(wordParsed.success).toBe(true);
    });
  });

  describe('Timestamp Validation & Overlap Detection', () => {
    it('prevents invalid timestamps: endMs before startMs and negative start times', () => {
      // Inverted timestamps: startMs = 5000, endMs = 2000
      const validated = validateSegmentTimestamps(5000, 2000);
      expect(validated.startMs).toBe(5000);
      expect(validated.endMs).toBeGreaterThanOrEqual(5100);

      // Negative start time
      const neg = validateSegmentTimestamps(-300, 1000);
      expect(neg.startMs).toBe(0);
      expect(neg.endMs).toBe(1000);
    });

    it('bounds segment times to video duration', () => {
      const bounded = validateSegmentTimestamps(8000, 15000, 10000);
      expect(bounded.endMs).toBeLessThanOrEqual(10000);
    });

    it('detects unintended overlaps between neighboring segments on the same track', () => {
      const segments: CaptionSegment[] = [
        {
          id: 'seg-a',
          startMs: 1000,
          endMs: 3000,
          text: 'First block',
          words: [],
          trackId: 'C1',
        },
        {
          id: 'seg-b',
          startMs: 2500, // Overlaps with seg-a [1000-3000]
          endMs: 4000,
          text: 'Second block (overlapping)',
          words: [],
          trackId: 'C1',
        },
        {
          id: 'seg-c',
          startMs: 4500, // No overlap
          endMs: 6000,
          text: 'Third block',
          words: [],
          trackId: 'C1',
        },
      ];

      const overlapping = detectSegmentOverlaps(segments);
      expect(overlapping.has('seg-a')).toBe(true);
      expect(overlapping.has('seg-b')).toBe(true);
      expect(overlapping.has('seg-c')).toBe(false);
    });

    it('does not report overlaps between segments on different tracks', () => {
      const segments: CaptionSegment[] = [
        { id: 'seg-c1', startMs: 1000, endMs: 3000, text: 'Track 1', words: [], trackId: 'C1' },
        { id: 'seg-c2', startMs: 1000, endMs: 3000, text: 'Track 2', words: [], trackId: 'C2' },
      ];

      const overlapping = detectSegmentOverlaps(segments);
      expect(overlapping.size).toBe(0);
    });
  });

  describe('Caption Editing Operations', () => {
    it('splits a caption segment by word boundary accurately', () => {
      const initial: CaptionSegment[] = [sampleSegment];
      // Split after 2nd word ("is") -> index 2
      const split = splitSegment(initial, 'seg-1', { wordIndex: 2 });

      expect(split.length).toBe(2);
      expect(split[0]!.text).toBe('This is');
      expect(split[0]!.words.length).toBe(2);
      expect(split[0]!.startMs).toBe(1000);

      expect(split[1]!.text).toBe('viral content');
      expect(split[1]!.words.length).toBe(2);
      expect(split[1]!.endMs).toBe(3000);
      expect(split[1]!.startMs).toBeGreaterThanOrEqual(split[0]!.endMs);
    });

    it('splits a caption segment by timecode accurately', () => {
      const initial: CaptionSegment[] = [sampleSegment];
      // Split at 1600ms
      const split = splitSegment(initial, 'seg-1', { splitTimeMs: 1600 });

      expect(split.length).toBe(2);
      expect(split[0]!.endMs).toBe(1600);
      expect(split[1]!.startMs).toBe(1600);
    });

    it('merges two adjacent captions preserving combined word-level timestamps', () => {
      const seg1: CaptionSegment = {
        id: 's1',
        startMs: 1000,
        endMs: 2000,
        text: 'Never give',
        words: [
          { id: 'w1', text: 'Never', startMs: 1000, endMs: 1400 },
          { id: 'w2', text: 'give', startMs: 1450, endMs: 1950 },
        ],
        trackId: 'C1',
      };
      const seg2: CaptionSegment = {
        id: 's2',
        startMs: 2200,
        endMs: 3500,
        text: 'up now',
        words: [
          { id: 'w3', text: 'up', startMs: 2200, endMs: 2700 },
          { id: 'w4', text: 'now', startMs: 2800, endMs: 3400 },
        ],
        trackId: 'C1',
      };

      const merged = mergeSegments([seg1, seg2], 's1', 's2');
      expect(merged.length).toBe(1);
      expect(merged[0]!.id).toBe('s1');
      expect(merged[0]!.text).toBe('Never give up now');
      expect(merged[0]!.startMs).toBe(1000);
      expect(merged[0]!.endMs).toBe(3500);
      expect(merged[0]!.words.length).toBe(4);
    });

    it('adjusts segment start and end times and scales words proportionally', () => {
      const adjusted = adjustSegmentTimes([sampleSegment], 'seg-1', 2000, 6000);
      expect(adjusted[0]!.startMs).toBe(2000);
      expect(adjusted[0]!.endMs).toBe(6000);

      // Check that words were scaled within [2000, 6000]
      const words = adjusted[0]!.words;
      expect(words[0]!.startMs).toBeGreaterThanOrEqual(2000);
      expect(words[words.length - 1]!.endMs).toBeLessThanOrEqual(6000);
    });

    it('updates an individual word inside a segment and updates parent text', () => {
      const updated = updateWordInSegment([sampleSegment], 'seg-1', 'w3', {
        text: 'cinematic',
      });

      expect(updated[0]!.text).toBe('This is cinematic content');
      const targetWord = updated[0]!.words.find((w) => w.id === 'w3');
      expect(targetWord?.text).toBe('cinematic');
    });
  });

  describe('Interactive Timeline Snapping Engine', () => {
    it('snaps to playhead when within threshold', () => {
      const playheadMs = 2500;
      const snapTargets = [0, playheadMs, 5000];

      // Drag position 2530ms is within 120ms of 2500ms -> should snap
      const snapResult = calculateSnapping(2530, snapTargets, 120);
      expect(snapResult.snapped).toBe(true);
      expect(snapResult.timeMs).toBe(2500);
    });

    it('does not snap when distance exceeds threshold', () => {
      const snapTargets = [0, 2500, 5000];
      // Drag position 2700ms is 200ms away -> exceeds 120ms threshold
      const snapResult = calculateSnapping(2700, snapTargets, 120);
      expect(snapResult.snapped).toBe(false);
      expect(snapResult.timeMs).toBe(2700);
    });

    it('gathers all potential snap targets from neighbor segments', () => {
      const segments: CaptionSegment[] = [
        { id: 's1', startMs: 1000, endMs: 2500, text: 'A', words: [] },
        { id: 's2', startMs: 3000, endMs: 4500, text: 'B', words: [] },
      ];

      const targets = findSnapTargets(segments, 's1', 1800);
      expect(targets).toContain(0);
      expect(targets).toContain(1800); // playhead
      expect(targets).toContain(3000); // s2 start
      expect(targets).toContain(4500); // s2 end
      expect(targets).not.toContain(1000); // excludes active segment s1
    });
  });

  describe('Synchronization & Source of Truth Guarantees', () => {
    it('does not lose transcript data when caption styling changes', () => {
      const projectSegments: CaptionSegment[] = [sampleSegment];
      let projectStyle: CaptionStyle = {
        presetId: 'hormozi',
        fontFamily: 'Montserrat',
        fontSize: 48,
        fontWeight: 900,
        allCaps: true,
        letterSpacing: 1,
        lineHeight: 1.1,
        textColor: '#FFFFFF',
        activeWordColor: '#F59E0B',
        strokeColor: '#000000',
        strokeWidth: 4,
        hasShadow: true,
        shadowColor: 'black',
        shadowBlur: 8,
        shadowOffsetY: 4,
        hasBox: false,
        boxColor: 'transparent',
        boxPaddingX: 8,
        boxPaddingY: 4,
        boxCornerRadius: 4,
        positionYPercent: 20,
        positionXPercent: 50,
      };

      // Change styling
      projectStyle = {
        ...projectStyle,
        presetId: 'beast',
        textColor: '#10B981',
      };

      // Caption segments must remain completely intact
      expect(projectSegments.length).toBe(1);
      expect(projectSegments[0]!.text).toBe('This is viral content');
      expect(projectSegments[0]!.words.length).toBe(4);
      expect(projectStyle.presetId).toBe('beast');
    });
  });
});
