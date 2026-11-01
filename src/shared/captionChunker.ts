import type { CaptionSegment, CaptionWord } from './types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Chunks an array of CaptionWords into discrete CaptionSegments of size wordsPerSegment.
 * Smoothes minor inter-word pauses (< 350ms) to prevent visual subtitle blinking.
 */
export function chunkWordsIntoSegments(
  words: CaptionWord[],
  wordsPerSegment: number,
  fallbackSegmentEndMs?: number
): CaptionSegment[] {
  if (words.length === 0 || wordsPerSegment <= 0) {
    return [];
  }

  const result: CaptionSegment[] = [];
  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const chunk = words.slice(i, i + wordsPerSegment);
    if (chunk.length === 0) continue;

    const firstWord = chunk[0]!;
    const lastWord = chunk[chunk.length - 1]!;
    const chunkStartMs = firstWord.startMs;
    const rawEndMs = lastWord.endMs;

    let chunkEndMs = rawEndMs;
    const nextWord = words[i + wordsPerSegment];
    if (nextWord) {
      if (nextWord.startMs > rawEndMs && nextWord.startMs - rawEndMs < 350) {
        chunkEndMs = nextWord.startMs;
      }
    } else if (fallbackSegmentEndMs && fallbackSegmentEndMs > rawEndMs) {
      chunkEndMs = Math.min(fallbackSegmentEndMs, rawEndMs + 250);
    }

    const text = chunk.map((w) => w.text).join(' ');
    result.push({
      id: generateId(),
      startMs: chunkStartMs,
      endMs: Math.max(chunkStartMs + 80, chunkEndMs),
      text,
      words: chunk,
      trackId: 'C1',
      originalText: text,
      originalWords: [...chunk],
      isDemo: false,
    });
  }

  return result;
}
