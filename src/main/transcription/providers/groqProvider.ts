import * as fs from 'fs';
import Groq from 'groq-sdk';
import { logger } from '../../logger';
import type {
  TranscriptionProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  TranscriptionModelInfo,
  ProviderCapabilities,
  TranscriptionSegment,
  TranscriptionWord,
} from '../types';

export class GroqTranscriptionProvider implements TranscriptionProvider {
  readonly id = 'groq';
  readonly name = 'Groq Cloud (Whisper)';

  private configuredApiKey?: string;

  constructor(config?: { apiKey?: string }) {
    if (config?.apiKey) {
      this.configuredApiKey = config.apiKey;
    }
    const key = this.getApiKey();
    if (!key) {
      throw new Error('GROQ_API_KEY is required to initialize GroqTranscriptionProvider.');
    }
  }

  private getApiKey(): string | null {
    const key = this.configuredApiKey || process.env.GROQ_API_KEY;
    if (!key || key.trim() === '' || key === 'your-groq-api-key') {
      return null;
    }
    return key.trim();
  }

  getSupportedModels(): TranscriptionModelInfo[] {
    return [
      {
        id: 'whisper-large-v3-turbo',
        name: 'Whisper Large v3 Turbo',
        description: 'Ultra-fast speech-to-text with word-level timestamps (Recommended)',
        isDefault: true,
      },
      {
        id: 'whisper-large-v3',
        name: 'Whisper Large v3',
        description: 'High accuracy multilingual transcription alternative',
        isDefault: false,
      },
    ];
  }

  getCapabilities(): ProviderCapabilities {
    return {
      wordTimestamps: true,
      segmentTimestamps: true,
      streaming: false,
      maxFileSizeMB: 25, // Documented Groq free-tier direct limit
      supportedLanguages: [
        'auto',
        'en',
        'hi',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'nl',
        'ja',
        'zh',
        'ko',
        'ar',
        'ru',
      ],
    };
  }

  async transcribe(
    audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResponse> {
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found at path: ${audioFilePath}`);
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Groq API key is not configured. Please set GROQ_API_KEY in .env.local to transcribe audio.'
      );
    }

    const model = options.model || 'whisper-large-v3-turbo';
    const client = new Groq({ apiKey });

    const maxRetries = 3;
    let delayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (options.signal?.aborted) {
        throw new Error('Transcription was cancelled by the user.');
      }

      try {
        logger.info(
          'GroqProvider',
          `Submitting audio chunk to Groq (${model}, attempt ${attempt}/${maxRetries})...`
        );

        const fileStream = fs.createReadStream(audioFilePath);

        // Prepare request parameters
        const requestParams: Parameters<typeof client.audio.transcriptions.create>[0] = {
          file: fileStream,
          model,
          response_format: 'verbose_json',
          timestamp_granularities: options.timestampGranularities || ['segment', 'word'],
          temperature: options.temperature ?? 0,
        };

        if (options.language && options.language !== 'auto') {
          requestParams.language = options.language;
        }

        if (options.prompt) {
          requestParams.prompt = options.prompt;
        }

        // Call Groq API
        const rawResponse = await client.audio.transcriptions.create(requestParams, {
          signal: options.signal,
          timeout: 90000, // 90 seconds timeout
        });

        // Parse structured verbose_json output
        const responseData = rawResponse as unknown as {
          text?: string;
          language?: string;
          duration?: number;
          segments?: Array<{
            id: number;
            seek: number;
            start: number;
            end: number;
            text: string;
            tokens?: number[];
            temperature?: number;
            avg_logprob?: number;
            compression_ratio?: number;
            no_speech_prob?: number;
          }>;
          words?: Array<{
            word: string;
            start: number;
            end: number;
          }>;
        };

        const segments: TranscriptionSegment[] = (responseData.segments || []).map((seg) => ({
          id: seg.id ?? 0,
          seek: seg.seek ?? 0,
          start: typeof seg.start === 'number' ? seg.start : 0,
          end: typeof seg.end === 'number' ? seg.end : 0,
          text: (seg.text || '').trim(),
          tokens: seg.tokens,
          temperature: seg.temperature,
          avg_logprob: seg.avg_logprob,
          compression_ratio: seg.compression_ratio,
          no_speech_prob: seg.no_speech_prob,
        }));

        const words: TranscriptionWord[] = (responseData.words || []).map((w) => ({
          word: (w.word || '').trim(),
          start: typeof w.start === 'number' ? w.start : 0,
          end: typeof w.end === 'number' ? w.end : 0,
        }));

        logger.info(
          'GroqProvider',
          `Groq transcription succeeded: ${segments.length} segments, ${words.length} words.`
        );

        return {
          text: responseData.text || '',
          language: responseData.language,
          duration: responseData.duration,
          segments,
          words,
        };
      } catch (err: unknown) {
        if (options.signal?.aborted) {
          throw new Error('Transcription was cancelled by the user.');
        }

        const isRateLimit =
          err instanceof Error &&
          (err.message.includes('429') ||
            err.message.toLowerCase().includes('rate limit') ||
            err.message.toLowerCase().includes('too many requests'));

        if (isRateLimit && attempt < maxRetries) {
          logger.warn(
            'GroqProvider',
            `Rate limit hit (429). Retrying in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
          continue;
        }

        const isTimeout =
          err instanceof Error &&
          (err.message.includes('timeout') || err.message.includes('ETIMEDOUT'));

        if (isTimeout && attempt < maxRetries) {
          logger.warn(
            'GroqProvider',
            `Request timed out. Retrying in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }

        const msg = err instanceof Error ? err.message : 'Unknown Groq transcription error';
        logger.error('GroqProvider', `Groq transcription failed: ${msg}`, err);
        throw new Error(`Groq Speech-to-Text API Error: ${msg}`);
      }
    }

    throw new Error('Groq transcription failed after maximum retry attempts.');
  }
}
