import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Mock electron
vi.mock('electron', () => {
  const tmpDir = path.join(__dirname, 'tmp_transcription_test_data');
  return {
    app: {
      getPath: () => tmpDir,
    },
    BrowserWindow: {
      getAllWindows: () => [],
      fromWebContents: () => null,
    },
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

import { GroqTranscriptionProvider } from '../src/main/transcription/providers/groqProvider';
import { MockTranscriptionProvider } from '../src/main/transcription/providers/mockProvider';
import {
  chunkAudioIfNeeded,
  cleanupAudioChunks,
  DEFAULT_MAX_CHUNK_BYTES,
  AudioChunk,
} from '../src/main/transcription/audio/chunker';
import {
  applyTimestampOffset,
  deduplicateOverlapWords,
  reconstructSegmentsFromWords,
  stitchChunkResponses,
} from '../src/main/transcription/stitching';
import {
  normalizeTranscriptionResponse,
  normalizeSegment,
  normalizeWord,
} from '../src/main/transcription/normalizer';
import { TranscriptionJobManager } from '../src/main/transcription/jobManager';
import { createProject } from '../src/main/projects/service';
import { StartTranscriptionSchema } from '../src/shared/schemas';
import type { TranscriptionResponse, TranscriptionWord } from '../src/main/transcription/types';

describe('Groq Speech-to-Text Integration & Pipeline', () => {
  const tmpDir = path.join(__dirname, 'tmp_transcription_test_data');
  const dummyAudioPath = path.join(tmpDir, 'test_audio.mp3');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    // Create a small dummy audio file for testing
    fs.writeFileSync(dummyAudioPath, Buffer.alloc(1024 * 10, 0));
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('GroqTranscriptionProvider Architecture', () => {
    it('throws descriptive error when instantiated without API key', () => {
      const prev = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      expect(() => new GroqTranscriptionProvider()).toThrow(/GROQ_API_KEY is required/i);

      if (prev) process.env.GROQ_API_KEY = prev;
    });

    it('returns supported models with whisper-large-v3-turbo as default', () => {
      const provider = new GroqTranscriptionProvider({ apiKey: 'gsk_test_fake_key' });
      const models = provider.getSupportedModels();

      expect(models.length).toBeGreaterThanOrEqual(2);
      const defaultModel = models.find((m) => m.isDefault);
      expect(defaultModel?.id).toBe('whisper-large-v3-turbo');

      const multilingual = models.find((m) => m.id === 'whisper-large-v3');
      expect(multilingual).toBeDefined();
    });

    it('reports accurate provider capabilities matching Groq documentation', () => {
      const provider = new GroqTranscriptionProvider({ apiKey: 'gsk_test_fake_key' });
      const caps = provider.getCapabilities();

      expect(caps.wordTimestamps).toBe(true);
      expect(caps.segmentTimestamps).toBe(true);
      expect(caps.maxFileSizeMB).toBe(25);
      expect(caps.supportedLanguages).toContain('en');
      expect(caps.supportedLanguages).toContain('hi');
    });

    it('throws error when audio file does not exist on disk', async () => {
      const provider = new GroqTranscriptionProvider({ apiKey: 'gsk_test_fake_key' });
      await expect(
        provider.transcribe('non_existent_audio_path.mp3')
      ).rejects.toThrow(/Audio file not found/i);
    });
  });

  describe('MockTranscriptionProvider for Deterministic Unit Testing', () => {
    it('generates bilingual Hindi-English transcript segments with word timestamps', async () => {
      const mockProvider = new MockTranscriptionProvider();
      const result = await mockProvider.transcribe(dummyAudioPath);

      expect(result.text).toBeTruthy();
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.words?.length).toBeGreaterThan(0);

      // Verify word timestamp format
      const firstWord = result.words![0]!;
      expect(typeof firstWord.word).toBe('string');
      expect(firstWord.end).toBeGreaterThan(firstWord.start);

      // Verify presence of bilingual Hindi/English words
      const fullText = result.text.toLowerCase();
      expect(fullText).toContain('autocaption');
      expect(fullText).toContain('namaste');
    });

    it('respects simulated latency and error options', async () => {
      const mockProvider = new MockTranscriptionProvider({
        shouldFail: true,
        errorMessage: 'Simulated 429 rate limit error',
      });

      await expect(mockProvider.transcribe(dummyAudioPath)).rejects.toThrow(
        /Simulated 429 rate limit error/
      );
    });
  });

  describe('Audio Chunker & File Limits', () => {
    it('returns single original chunk when file size fits within limit', async () => {
      const smallFile = path.join(tmpDir, 'small.mp3');
      fs.writeFileSync(smallFile, Buffer.alloc(1024 * 500)); // 500 KB

      const chunks = await chunkAudioIfNeeded(smallFile, 10000, {
        maxChunkSizeBytes: DEFAULT_MAX_CHUNK_BYTES,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0]!.isOriginal).toBe(true);
      expect(chunks[0]!.startTimeSec).toBe(0);
      expect(chunks[0]!.filePath).toBe(smallFile);
    });

    it('safely cleans up chunks without error', async () => {
      const fakeChunk: AudioChunk = {
        index: 0,
        filePath: path.join(tmpDir, 'temp_chunk_to_delete.mp3'),
        startTimeSec: 0,
        durationSec: 10,
        isOriginal: false,
      };
      fs.writeFileSync(fakeChunk.filePath, 'dummy chunk content');

      expect(fs.existsSync(fakeChunk.filePath)).toBe(true);
      await cleanupAudioChunks([fakeChunk]);
      expect(fs.existsSync(fakeChunk.filePath)).toBe(false);
    });
  });

  describe('Timestamp Stitching & Boundary Seam Deduplication', () => {
    it('applies timestamp offset correctly to segments and words', () => {
      const sampleResponse: TranscriptionResponse = {
        text: 'hello world',
        segments: [
          {
            id: 0,
            seek: 0,
            start: 1.0,
            end: 3.0,
            text: 'hello world',
            words: [
              { word: 'hello', start: 1.0, end: 1.8 },
              { word: 'world', start: 1.9, end: 3.0 },
            ],
          },
        ],
        words: [
          { word: 'hello', start: 1.0, end: 1.8 },
          { word: 'world', start: 1.9, end: 3.0 },
        ],
      };

      const offsetResp = applyTimestampOffset(sampleResponse, 10.5);

      expect(offsetResp.segments[0]!.start).toBe(11.5);
      expect(offsetResp.segments[0]!.end).toBe(13.5);
      expect(offsetResp.words![0]!.start).toBe(11.5);
      expect(offsetResp.words![1]!.start).toBe(12.4);
    });

    it('deduplicates duplicate words at overlapping boundary seams', () => {
      const firstChunkWords: TranscriptionWord[] = [
        { word: 'This', start: 10.0, end: 10.5 },
        { word: 'is', start: 10.6, end: 10.8 },
        { word: 'a', start: 10.9, end: 11.0 },
        { word: 'complete', start: 11.1, end: 11.8 },
      ];

      // Second chunk overlaps starting at 11.0s, and re-transcribes "complete sentence"
      const secondChunkWords: TranscriptionWord[] = [
        { word: 'complete', start: 11.2, end: 11.85 }, // Duplicate in overlap
        { word: 'sentence', start: 11.9, end: 12.5 },
        { word: 'now', start: 12.6, end: 13.0 },
      ];

      // Overlap window [11.0s, 12.0s], midSec = 11.5s
      const deduplicated = deduplicateOverlapWords(
        firstChunkWords,
        secondChunkWords,
        11.0,
        12.0
      );

      const wordsText = deduplicated.map((w) => w.word);
      // 'complete' should appear exactly once
      const count = wordsText.filter((w) => w.toLowerCase() === 'complete').length;
      expect(count).toBe(1);
    });

    it('reconstructs segments from words based on speech pauses', () => {
      const words: TranscriptionWord[] = [
        { word: 'First', start: 0.1, end: 0.5 },
        { word: 'phrase', start: 0.6, end: 1.0 },
        // 2-second pause gap
        { word: 'Second', start: 3.0, end: 3.4 },
        { word: 'phrase', start: 3.5, end: 4.0 },
      ];

      const segments = reconstructSegmentsFromWords(words, 5.0, 1.0);
      expect(segments.length).toBe(2);
      expect(segments[0]!.text).toBe('First phrase');
      expect(segments[1]!.text).toBe('Second phrase');
    });

    it('stitches multiple chunk responses seamlessly into a single response', () => {
      const chunk1: AudioChunk = {
        index: 0,
        filePath: 'chunk0.mp3',
        startTimeSec: 0,
        durationSec: 10,
        isOriginal: false,
      };
      const chunk2: AudioChunk = {
        index: 1,
        filePath: 'chunk1.mp3',
        startTimeSec: 8, // 2s overlap
        durationSec: 10,
        isOriginal: false,
      };

      const resp1: TranscriptionResponse = {
        text: 'hello from chunk one',
        language: 'en',
        segments: [],
        words: [
          { word: 'hello', start: 0.5, end: 1.0 },
          { word: 'from', start: 1.1, end: 1.5 },
          { word: 'chunk', start: 1.6, end: 2.0 },
          { word: 'one', start: 8.2, end: 8.8 },
        ],
      };

      const resp2: TranscriptionResponse = {
        text: 'one and chunk two',
        language: 'en',
        segments: [],
        words: [
          // Within chunk 2, relative to 0
          { word: 'one', start: 0.2, end: 0.8 }, // 8.2s absolute (duplicate)
          { word: 'and', start: 1.0, end: 1.4 },  // 9.0s absolute
          { word: 'chunk', start: 1.5, end: 1.9 },
          { word: 'two', start: 2.0, end: 2.5 },
        ],
      };

      const stitched = stitchChunkResponses([
        { chunk: chunk1, response: resp1 },
        { chunk: chunk2, response: resp2 },
      ]);

      expect(stitched.words?.length).toBeGreaterThan(0);
      expect(stitched.text).toContain('hello');
      expect(stitched.text).toContain('two');
    });
  });

  describe('Transcription Normalizer', () => {
    it('normalizes single word to millisecond timestamps', () => {
      const norm = normalizeWord({ word: 'Namaste', start: 1.234, end: 1.89 });
      expect(norm.text).toBe('Namaste');
      expect(norm.startMs).toBe(1234);
      expect(norm.endMs).toBe(1890);
      expect(norm.id).toBeDefined();
    });

    it('normalizes segment with words into CaptionSegment schema', () => {
      const seg = normalizeSegment({
        id: 1,
        seek: 0,
        start: 0.5,
        end: 2.0,
        text: 'Hello world',
        words: [
          { word: 'Hello', start: 0.5, end: 1.1 },
          { word: 'world', start: 1.2, end: 2.0 },
        ],
      });

      expect(seg.startMs).toBe(500);
      expect(seg.endMs).toBe(2000);
      expect(seg.text).toBe('Hello world');
      expect(seg.words.length).toBe(2);
      expect(seg.words[0]!.startMs).toBe(500);
      expect(seg.isDemo).toBe(false);
    });

    it('synthesizes word timings evenly when segment lacks word-level timestamps', () => {
      const seg = normalizeSegment({
        id: 2,
        seek: 0,
        start: 1.0,
        end: 3.0,
        text: 'Word one two three',
      });

      expect(seg.words.length).toBe(4);
      expect(seg.words[0]!.text).toBe('Word');
      expect(seg.words[3]!.text).toBe('three');
      expect(seg.words[0]!.startMs).toBe(1000);
      expect(seg.words[3]!.endMs).toBeLessThanOrEqual(3000);
    });

    it('normalizes entire TranscriptionResponse into CaptionSegment[]', () => {
      const response: TranscriptionResponse = {
        text: 'Segment one. Segment two.',
        segments: [
          {
            id: 0,
            seek: 0,
            start: 0,
            end: 2.0,
            text: 'Segment one.',
            words: [
              { word: 'Segment', start: 0, end: 0.8 },
              { word: 'one.', start: 0.9, end: 1.8 },
            ],
          },
          {
            id: 1,
            seek: 2.0,
            start: 2.0,
            end: 4.0,
            text: 'Segment two.',
            words: [
              { word: 'Segment', start: 2.0, end: 2.8 },
              { word: 'two.', start: 2.9, end: 3.8 },
            ],
          },
        ],
      };

      const result = normalizeTranscriptionResponse(response);
      expect(result.length).toBe(2);
      expect(result[0]!.startMs).toBe(0);
      expect(result[0]!.endMs).toBe(2000);
      expect(result[1]!.startMs).toBe(2000);
      expect(result[1]!.endMs).toBe(4000);
    });

    it('chunks words per segment when wordsPerSegment = 1 (single-word punchy style)', () => {
      const response: TranscriptionResponse = {
        text: 'Never give up now',
        segments: [
          {
            id: 0,
            seek: 0,
            start: 0,
            end: 2.0,
            text: 'Never give up now',
            words: [
              { word: 'Never', start: 0.1, end: 0.4 },
              { word: 'give', start: 0.5, end: 0.8 },
              { word: 'up', start: 0.9, end: 1.2 },
              { word: 'now', start: 1.3, end: 1.7 },
            ],
          },
        ],
      };

      const result = normalizeTranscriptionResponse(response, { wordsPerSegment: 1 });
      expect(result.length).toBe(4);
      expect(result[0]!.text).toBe('Never');
      expect(result[0]!.words.length).toBe(1);
      expect(result[1]!.text).toBe('give');
      expect(result[2]!.text).toBe('up');
      expect(result[3]!.text).toBe('now');
    });

    it('chunks words into multi-word groups when wordsPerSegment = 2', () => {
      const response: TranscriptionResponse = {
        text: 'Never give up now',
        segments: [
          {
            id: 0,
            seek: 0,
            start: 0,
            end: 2.0,
            text: 'Never give up now',
            words: [
              { word: 'Never', start: 0.1, end: 0.4 },
              { word: 'give', start: 0.5, end: 0.8 },
              { word: 'up', start: 0.9, end: 1.2 },
              { word: 'now', start: 1.3, end: 1.7 },
            ],
          },
        ],
      };

      const result = normalizeTranscriptionResponse(response, { wordsPerSegment: 2 });
      expect(result.length).toBe(2);
      expect(result[0]!.text).toBe('Never give');
      expect(result[0]!.words.length).toBe(2);
      expect(result[1]!.text).toBe('up now');
      expect(result[1]!.words.length).toBe(2);
    });
  });

  describe('TranscriptionJobManager & Security', () => {
    const testUserId = '00000000-0000-4000-a000-000000000001';
    const unauthorizedUserId = '00000000-0000-4000-a000-000000000099';

    it('validates start transcription input via Zod schema', () => {
      const invalid = StartTranscriptionSchema.safeParse({
        // missing projectId
        model: 'whisper-large-v3-turbo',
      });
      expect(invalid.success).toBe(false);

      const valid = StartTranscriptionSchema.safeParse({
        projectId: 'project-123',
        model: 'whisper-large-v3-turbo',
        language: 'hi',
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.model).toBe('whisper-large-v3-turbo');
        expect(valid.data.language).toBe('hi');
      }
    });

    it('denies transcription if project is not owned by requesting user', async () => {
      // Create project owned by testUserId
      const projRes = await createProject(testUserId, {
        name: 'Private Project',
        aspectRatio: '9:16',
      });
      expect(projRes.success).toBe(true);
      const projectId = projRes.project!.id;

      const manager = new TranscriptionJobManager();
      const mockProvider = new MockTranscriptionProvider();

      // Attempt start with unauthorizedUserId
      await expect(
        manager.startTranscription(
          unauthorizedUserId,
          { projectId, videoFilePath: dummyAudioPath },
          mockProvider
        )
      ).rejects.toThrow(/not found or access denied/i);
    });

    it('rejects transcription if video file does not exist on disk', async () => {
      const projRes = await createProject(testUserId, {
        name: 'Missing Video Project',
        aspectRatio: '9:16',
      });
      const projectId = projRes.project!.id;

      const manager = new TranscriptionJobManager();
      const mockProvider = new MockTranscriptionProvider();

      await expect(
        manager.startTranscription(
          testUserId,
          { projectId, videoFilePath: 'fictional_missing_file.mp4' },
          mockProvider
        )
      ).rejects.toThrow(/Video file path not found or inaccessible/i);
    });

    it('allows job cancellation and safely updates job status', async () => {
      const manager = new TranscriptionJobManager();
      const mockProvider = new MockTranscriptionProvider({ latencyMs: 500 });

      const projRes = await createProject(testUserId, {
        name: 'Cancel Test Project',
        aspectRatio: '9:16',
      });
      const projectId = projRes.project!.id;

      // Note: Video file is dummy, startTranscription will validate file existence
      const startRes = await manager.startTranscription(
        testUserId,
        { projectId, videoFilePath: dummyAudioPath },
        mockProvider
      );

      expect(startRes.jobId).toBeDefined();
      expect(startRes.status).toBe('queued');

      // Cancel the job immediately
      const cancelled = manager.cancelJob(startRes.jobId);
      expect(cancelled).toBe(true);

      const status = manager.getJob(startRes.jobId);
      expect(status?.status).toBe('cancelled');
    });

    it('throws when Groq API key is missing and no mock provider is configured', () => {
      const prevKey = process.env.GROQ_API_KEY;
      const prevMock = process.env.USE_MOCK_TRANSCRIPTION;
      const prevNodeEnv = process.env.NODE_ENV;

      delete process.env.GROQ_API_KEY;
      delete process.env.USE_MOCK_TRANSCRIPTION;
      process.env.NODE_ENV = 'production';

      const manager = new TranscriptionJobManager();
      expect(() => manager.getProvider()).toThrow(/Groq API key is not configured/i);

      // Restore env
      if (prevKey) process.env.GROQ_API_KEY = prevKey;
      if (prevMock) process.env.USE_MOCK_TRANSCRIPTION = prevMock;
      process.env.NODE_ENV = prevNodeEnv;
    });
  });
});
