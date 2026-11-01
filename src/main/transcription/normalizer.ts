import type { CaptionSegment, CaptionWord } from '../../shared/types';
import type { TranscriptionResponse, TranscriptionSegment, TranscriptionWord } from './types';
import { chunkWordsIntoSegments } from '../../shared/captionChunker';

export { chunkWordsIntoSegments };

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Synthesizes word timings for a segment when word-level timestamps are missing.
 */
function synthesizeWordsForSegment(
  text: string,
  startMs: number,
  endMs: number
): CaptionWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const durationMs = Math.max(tokens.length * 150, endMs - startMs);
  const wordDurationMs = durationMs / tokens.length;

  return tokens.map((token, i) => {
    const wordStart = Math.round(startMs + i * wordDurationMs);
    const wordEnd = Math.round(Math.min(endMs, wordStart + wordDurationMs));
    return {
      id: generateId(),
      text: token,
      startMs: wordStart,
      endMs: Math.max(wordStart + 50, wordEnd),
    };
  });
}

/**
 * Converts a TranscriptionWord into a CaptionWord with millisecond timestamps.
 */
export function normalizeWord(word: TranscriptionWord): CaptionWord {
  const startMs = Math.max(0, Math.round(word.start * 1000));
  const endMs = Math.max(startMs + 50, Math.round(word.end * 1000));
  return {
    id: generateId(),
    text: word.word.trim(),
    startMs,
    endMs,
  };
}

/**
 * Normalizes a TranscriptionSegment into the application's internal CaptionSegment schema.
 */
export function normalizeSegment(seg: TranscriptionSegment): CaptionSegment {
  const startMs = Math.max(0, Math.round(seg.start * 1000));
  const endMs = Math.max(startMs + 100, Math.round(seg.end * 1000));
  const text = seg.text.trim();

  let words: CaptionWord[] = [];
  if (seg.words && seg.words.length > 0) {
    words = seg.words.map(normalizeWord);
  } else {
    words = synthesizeWordsForSegment(text, startMs, endMs);
  }

  return {
    id: generateId(),
    startMs,
    endMs,
    text,
    words,
    trackId: 'C1',
    originalText: text,
    originalWords: [...words],
    isDemo: false,
  };
}

export interface NormalizerOptions {
  /**
   * Number of words to appear at once in each caption segment.
   * If 0 or omitted, segments preserve natural sentence boundaries as detected by Whisper.
   * If 1, each word gets its own punchy segment (Hormozi style).
   * If 2-6, words are grouped into short readable phrases.
   */
  wordsPerSegment?: number;
}


/**
 * Converts a complete TranscriptionResponse into internal CaptionSegment[] array.
 * Supports configurable wordsPerSegment for short-form video caption pacing.
 */
export function normalizeTranscriptionResponse(
  response: TranscriptionResponse,
  options?: NormalizerOptions
): CaptionSegment[] {
  const wordsPerSegment = options?.wordsPerSegment ?? 0;

  if (!response.segments || response.segments.length === 0) {
    // If only raw text or words were provided, create segments
    let allWords: CaptionWord[] = [];
    let text = response.text || '';

    if (response.words && response.words.length > 0) {
      allWords = response.words.map(normalizeWord);
      text = text || allWords.map((w) => w.text).join(' ');
    } else if (text.trim().length > 0) {
      allWords = synthesizeWordsForSegment(text.trim(), 0, 5000);
    } else {
      return [];
    }

    if (wordsPerSegment > 0 && allWords.length > 0) {
      return chunkWordsIntoSegments(allWords, wordsPerSegment);
    }

    const firstWord = allWords[0];
    const lastWord = allWords[allWords.length - 1];
    return [
      {
        id: generateId(),
        startMs: firstWord?.startMs ?? 0,
        endMs: lastWord?.endMs ?? 5000,
        text,
        words: allWords,
        trackId: 'C1',
        originalText: text,
        originalWords: [...allWords],
        isDemo: false,
      },
    ];
  }

  // Filter out completely empty segments
  const validSegments = response.segments.filter((s) => s.text && s.text.trim().length > 0);

  if (wordsPerSegment > 0) {
    const chunked: CaptionSegment[] = [];
    for (const seg of validSegments) {
      const startMs = Math.max(0, Math.round(seg.start * 1000));
      const endMs = Math.max(startMs + 100, Math.round(seg.end * 1000));
      const text = seg.text.trim();

      let words: CaptionWord[] = [];
      if (seg.words && seg.words.length > 0) {
        words = seg.words.map(normalizeWord);
      } else {
        words = synthesizeWordsForSegment(text, startMs, endMs);
      }

      if (words.length > 0) {
        const segChunks = chunkWordsIntoSegments(words, wordsPerSegment, endMs);
        chunked.push(...segChunks);
      }
    }
    return chunked;
  }

  return validSegments.map(normalizeSegment);
}
