import type { CaptionSegment, CaptionWord } from './types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validates and sanitizes start/end timestamps for a caption segment.
 * Ensures non-negative, endMs > startMs, minimum duration, and optional duration clamping.
 */
export function validateSegmentTimestamps(
  startMs: number,
  endMs: number,
  maxDurationMs?: number,
  minDurationMs = 100
): { startMs: number; endMs: number; isValid: boolean; error?: string } {
  let validStart = Math.max(0, Math.round(startMs));
  let validEnd = Math.round(endMs);

  if (maxDurationMs && maxDurationMs > 0) {
    validStart = Math.min(validStart, maxDurationMs - minDurationMs);
    validEnd = Math.min(validEnd, maxDurationMs);
  }

  if (validEnd < validStart + minDurationMs) {
    validEnd = validStart + minDurationMs;
  }

  return {
    startMs: validStart,
    endMs: validEnd,
    isValid: true,
  };
}

/**
 * Detects unintended overlapping segments on the same track.
 * Returns a set of segment IDs that have time collisions.
 */
export function detectSegmentOverlaps(segments: CaptionSegment[]): Set<string> {
  const overlappingIds = new Set<string>();
  const trackMap = new Map<string, CaptionSegment[]>();

  // Group by track
  for (const seg of segments) {
    const track = seg.trackId || 'C1';
    const list = trackMap.get(track) || [];
    list.push(seg);
    trackMap.set(track, list);
  }

  // Check pairwise within each track
  for (const [, list] of trackMap.entries()) {
    const sorted = [...list].sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;

        // Since sorted by startMs, if b.startMs >= a.endMs, no subsequent item can overlap a
        if (b.startMs >= a.endMs) {
          break;
        }

        // Overlap detected: b.startMs < a.endMs
        overlappingIds.add(a.id);
        overlappingIds.add(b.id);
      }
    }
  }

  return overlappingIds;
}

/**
 * Splits a caption segment into two segments.
 * Can split by wordIndex or by timestamp splitTimeMs.
 */
export function splitSegment(
  segments: CaptionSegment[],
  segmentId: string,
  options: { splitTimeMs?: number; wordIndex?: number }
): CaptionSegment[] {
  const index = segments.findIndex((s) => s.id === segmentId);
  if (index === -1) return segments;

  const target = segments[index]!;
  const words = target.words || [];

  let firstWords: CaptionWord[] = [];
  let secondWords: CaptionWord[] = [];
  let splitMs: number;

  if (options.wordIndex !== undefined && options.wordIndex > 0 && options.wordIndex < words.length) {
    firstWords = words.slice(0, options.wordIndex);
    secondWords = words.slice(options.wordIndex);
    const lastFirstWord = firstWords[firstWords.length - 1]!;
    const firstSecondWord = secondWords[0]!;
    splitMs = Math.round((lastFirstWord.endMs + firstSecondWord.startMs) / 2);
  } else if (options.splitTimeMs !== undefined) {
    splitMs = Math.max(target.startMs + 50, Math.min(target.endMs - 50, Math.round(options.splitTimeMs)));
    if (words.length > 0) {
      firstWords = words.filter((w) => w.startMs < splitMs);
      secondWords = words.filter((w) => w.startMs >= splitMs);

      // If split fell before all words or after all words, distribute at least 1
      if (firstWords.length === 0 && words.length > 1) {
        firstWords = [words[0]!];
        secondWords = words.slice(1);
      } else if (secondWords.length === 0 && words.length > 1) {
        firstWords = words.slice(0, -1);
        secondWords = [words[words.length - 1]!];
      }
    }
  } else {
    // Default to midpoint split
    splitMs = Math.round((target.startMs + target.endMs) / 2);
    if (words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      firstWords = words.slice(0, mid);
      secondWords = words.slice(mid);
    }
  }

  const firstText = firstWords.length > 0
    ? firstWords.map((w) => w.text).join(' ')
    : target.text.slice(0, Math.ceil(target.text.length / 2)).trim();

  const secondText = secondWords.length > 0
    ? secondWords.map((w) => w.text).join(' ')
    : target.text.slice(Math.ceil(target.text.length / 2)).trim();

  const firstSegment: CaptionSegment = {
    ...target,
    id: target.id,
    startMs: target.startMs,
    endMs: splitMs,
    text: firstText,
    words: firstWords,
  };

  const secondSegment: CaptionSegment = {
    ...target,
    id: generateId(),
    startMs: splitMs,
    endMs: target.endMs,
    text: secondText,
    words: secondWords,
  };

  const next = [...segments];
  next.splice(index, 1, firstSegment, secondSegment);
  return next;
}

/**
 * Merges two adjacent or chosen caption segments into a single cohesive segment.
 */
export function mergeSegments(
  segments: CaptionSegment[],
  idA: string,
  idB: string
): CaptionSegment[] {
  const segA = segments.find((s) => s.id === idA);
  const segB = segments.find((s) => s.id === idB);
  if (!segA || !segB || idA === idB) return segments;

  const [first, second] = segA.startMs <= segB.startMs ? [segA, segB] : [segB, segA];

  const mergedWords = [...(first.words || []), ...(second.words || [])].sort(
    (a, b) => a.startMs - b.startMs
  );

  const mergedText = `${first.text} ${second.text}`.trim();
  const mergedSegment: CaptionSegment = {
    ...first,
    id: first.id,
    startMs: first.startMs,
    endMs: Math.max(first.endMs, second.endMs),
    text: mergedText,
    words: mergedWords,
  };

  return segments
    .filter((s) => s.id !== second.id)
    .map((s) => (s.id === first.id ? mergedSegment : s));
}

/**
 * Adjusts start and end times of a segment, keeping word timings scaled within range.
 */
export function adjustSegmentTimes(
  segments: CaptionSegment[],
  segmentId: string,
  newStartMs: number,
  newEndMs: number,
  maxDurationMs?: number
): CaptionSegment[] {
  const validated = validateSegmentTimestamps(newStartMs, newEndMs, maxDurationMs);

  return segments.map((seg) => {
    if (seg.id !== segmentId) return seg;

    const oldDuration = Math.max(1, seg.endMs - seg.startMs);
    const newDuration = validated.endMs - validated.startMs;
    const ratio = newDuration / oldDuration;

    // Proportionally scale words to fit within the new segment duration
    const adjustedWords = (seg.words || []).map((w) => {
      const relStart = w.startMs - seg.startMs;
      const relEnd = w.endMs - seg.startMs;
      const scaledStart = validated.startMs + Math.round(relStart * ratio);
      const scaledEnd = validated.startMs + Math.round(relEnd * ratio);
      return {
        ...w,
        startMs: Math.max(validated.startMs, scaledStart),
        endMs: Math.min(validated.endMs, Math.max(scaledStart + 30, scaledEnd)),
      };
    });

    return {
      ...seg,
      startMs: validated.startMs,
      endMs: validated.endMs,
      words: adjustedWords,
    };
  });
}

/**
 * Updates an individual word inside a segment and recomputes segment text.
 */
export function updateWordInSegment(
  segments: CaptionSegment[],
  segmentId: string,
  wordId: string,
  updates: Partial<CaptionWord>
): CaptionSegment[] {
  return segments.map((seg) => {
    if (seg.id !== segmentId) return seg;

    const words = (seg.words || []).map((w) => {
      if (w.id !== wordId) return w;
      return { ...w, ...updates };
    });

    // If text was modified, recompute parent segment text
    const text = words.map((w) => w.text).join(' ');

    return {
      ...seg,
      text: updates.text !== undefined ? text : seg.text,
      words,
    };
  });
}

/**
 * Calculates snapping against a list of target timestamps (playhead, adjacent boundaries).
 */
export function calculateSnapping(
  currentTimeMs: number,
  snapTargets: number[],
  snapThresholdMs = 120
): { timeMs: number; snapped: boolean; snapTarget?: number } {
  let closestTarget: number | undefined;
  let minDiff = Infinity;

  for (const target of snapTargets) {
    const diff = Math.abs(currentTimeMs - target);
    if (diff <= snapThresholdMs && diff < minDiff) {
      minDiff = diff;
      closestTarget = target;
    }
  }

  if (closestTarget !== undefined) {
    return {
      timeMs: closestTarget,
      snapped: true,
      snapTarget: closestTarget,
    };
  }

  return {
    timeMs: currentTimeMs,
    snapped: false,
  };
}

/**
 * Finds all potential snap targets for a dragged segment: playhead and neighbor segment edges.
 */
export function findSnapTargets(
  segments: CaptionSegment[],
  activeSegmentId: string | null,
  playheadMs: number
): number[] {
  const targets = new Set<number>();
  targets.add(0);
  if (playheadMs >= 0) {
    targets.add(playheadMs);
  }

  for (const seg of segments) {
    if (seg.id === activeSegmentId) continue;
    targets.add(seg.startMs);
    targets.add(seg.endMs);
  }

  return Array.from(targets);
}
