import type { AudioChunk } from './audio/chunker';
import type { TranscriptionResponse, TranscriptionSegment, TranscriptionWord } from './types';

export interface ChunkWithResponse {
  chunk: AudioChunk;
  response: TranscriptionResponse;
}

function normalizeWordText(w: string): string {
  return w.toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '').trim();
}

/**
 * Offsets timestamps in segments and words by chunk.startTimeSec.
 */
export function applyTimestampOffset(
  response: TranscriptionResponse,
  offsetSec: number
): TranscriptionResponse {
  if (offsetSec === 0) {
    return response;
  }

  const offsetSegments: TranscriptionSegment[] = (response.segments || []).map((seg) => {
    const start = Math.max(0, seg.start + offsetSec);
    const end = Math.max(start, seg.end + offsetSec);
    const words = (seg.words || []).map((w) => ({
      word: w.word,
      start: Math.max(0, w.start + offsetSec),
      end: Math.max(w.start + offsetSec, w.end + offsetSec),
    }));

    return {
      ...seg,
      start,
      end,
      seek: seg.seek + offsetSec,
      words: words.length > 0 ? words : undefined,
    };
  });

  const offsetWords: TranscriptionWord[] = (response.words || []).map((w) => ({
    word: w.word,
    start: Math.max(0, w.start + offsetSec),
    end: Math.max(w.start + offsetSec, w.end + offsetSec),
  }));

  return {
    ...response,
    segments: offsetSegments,
    words: offsetWords.length > 0 ? offsetWords : undefined,
  };
}

/**
 * Deduplicates boundary words between two adjacent overlapping chunks.
 */
export function deduplicateOverlapWords(
  firstWords: TranscriptionWord[],
  secondWords: TranscriptionWord[],
  overlapStartSec: number,
  overlapEndSec: number
): TranscriptionWord[] {
  if (firstWords.length === 0) return [...secondWords];
  if (secondWords.length === 0) return [...firstWords];

  // Midpoint of overlap window
  const midSec = (overlapStartSec + overlapEndSec) / 2;

  // Words from first chunk that end before or at midSec
  const keptFirst = firstWords.filter((w) => w.start < midSec);

  // Words from second chunk that start after or at midSec
  let keptSecond = secondWords.filter((w) => w.start >= midSec);

  // Check boundary transition for duplicate word (e.g. word right before midSec and word right after)
  if (keptFirst.length > 0 && keptSecond.length > 0) {
    const lastFirst = keptFirst[keptFirst.length - 1];
    const firstSecond = keptSecond[0];

    if (lastFirst && firstSecond) {
      const isSameWord = normalizeWordText(lastFirst.word) === normalizeWordText(firstSecond.word);
      const timeDelta = Math.abs(firstSecond.start - lastFirst.start);

      // If identical word uttered within 1.2s across the boundary seam, drop the duplicate in chunk 2
      if (isSameWord && timeDelta < 1.2) {
        keptSecond = keptSecond.slice(1);
      }
    }
  }

  return [...keptFirst, ...keptSecond];
}

/**
 * Groups a sequence of words into segment blocks based on silence gaps.
 */
export function reconstructSegmentsFromWords(
  words: TranscriptionWord[],
  maxSegmentDurationSec = 6.0,
  maxGapSec = 1.0
): TranscriptionSegment[] {
  if (words.length === 0) {
    return [];
  }

  const first = words[0];
  if (!first) {
    return [];
  }

  const segments: TranscriptionSegment[] = [];
  let currentWords: TranscriptionWord[] = [first];
  let segmentId = 0;

  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const curr = words[i];
    const firstWordOfCurrent = currentWords[0];
    const lastWordOfCurrent = currentWords[currentWords.length - 1];

    if (!prev || !curr || !firstWordOfCurrent || !lastWordOfCurrent) {
      continue;
    }

    const gap = curr.start - prev.end;
    const currentDuration = curr.end - firstWordOfCurrent.start;

    // Split segment if gap is large or max duration exceeded
    if (gap > maxGapSec || currentDuration > maxSegmentDurationSec) {
      const segStart = firstWordOfCurrent.start;
      const segEnd = lastWordOfCurrent.end;
      const segText = currentWords.map((w) => w.word).join(' ').trim();

      segments.push({
        id: segmentId++,
        seek: segStart,
        start: segStart,
        end: segEnd,
        text: segText,
        words: [...currentWords],
      });

      currentWords = [curr];
    } else {
      currentWords.push(curr);
    }
  }

  if (currentWords.length > 0) {
    const segFirst = currentWords[0];
    const segLast = currentWords[currentWords.length - 1];
    if (segFirst && segLast) {
      const segStart = segFirst.start;
      const segEnd = segLast.end;
      const segText = currentWords.map((w) => w.word).join(' ').trim();

      segments.push({
        id: segmentId++,
        seek: segStart,
        start: segStart,
        end: segEnd,
        text: segText,
        words: [...currentWords],
      });
    }
  }

  return segments;
}

/**
 * Stitches multiple audio chunk transcription responses together into a single
 * coherent TranscriptionResponse, adjusting timestamps and removing boundary duplicates.
 */
export function stitchChunkResponses(chunkResults: ChunkWithResponse[]): TranscriptionResponse {
  if (chunkResults.length === 0) {
    return {
      text: '',
      segments: [],
      words: [],
    };
  }

  if (chunkResults.length === 1) {
    const single = chunkResults[0];
    return single
      ? applyTimestampOffset(single.response, single.chunk.startTimeSec)
      : { text: '', segments: [], words: [] };
  }

  // Sort chunks by start time
  const sorted = [...chunkResults].sort((a, b) => a.chunk.startTimeSec - b.chunk.startTimeSec);
  const firstSorted = sorted[0];
  if (!firstSorted) {
    return { text: '', segments: [], words: [] };
  }

  let accumulatedWords: TranscriptionWord[] = [];
  let detectedLanguage = firstSorted.response.language;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (!item) continue;

    const { chunk, response } = item;
    const offsetResp = applyTimestampOffset(response, chunk.startTimeSec);

    // Extract word list from offset response (either from top-level words or flattened from segments)
    const chunkWords: TranscriptionWord[] = offsetResp.words && offsetResp.words.length > 0
      ? offsetResp.words
      : (offsetResp.segments || []).flatMap((seg) => seg.words || []);

    if (i === 0) {
      accumulatedWords = chunkWords;
    } else {
      const prev = sorted[i - 1];
      const overlapStart = chunk.startTimeSec;
      const overlapEnd = prev ? prev.chunk.startTimeSec + prev.chunk.durationSec : chunk.startTimeSec;

      accumulatedWords = deduplicateOverlapWords(
        accumulatedWords,
        chunkWords,
        overlapStart,
        overlapEnd
      );
    }

    if (!detectedLanguage && response.language) {
      detectedLanguage = response.language;
    }
  }

  // Reconstruct clean segments with word timing
  const stitchedSegments = reconstructSegmentsFromWords(accumulatedWords);
  const fullText = stitchedSegments.map((s) => s.text).join(' ').trim();

  return {
    text: fullText,
    language: detectedLanguage,
    segments: stitchedSegments,
    words: accumulatedWords,
  };
}
