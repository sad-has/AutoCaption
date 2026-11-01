import type {
  TranscriptionProvider,
  TranscriptionOptions,
  TranscriptionResponse,
  TranscriptionModelInfo,
  ProviderCapabilities,
} from '../types';

export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly id = 'mock';
  readonly name = 'Mock Speech-to-Text Provider';

  private mockResponses: TranscriptionResponse[] = [];
  private shouldFail = false;
  private failureMessage = 'Simulated transcription failure';
  private delayMs = 50;

  constructor(config?: { shouldFail?: boolean; errorMessage?: string; latencyMs?: number }) {
    if (config?.shouldFail !== undefined) this.shouldFail = config.shouldFail;
    if (config?.errorMessage) this.failureMessage = config.errorMessage;
    if (config?.latencyMs !== undefined) this.delayMs = config.latencyMs;
  }

  setMockResponse(response: TranscriptionResponse): void {
    this.mockResponses = [response];
    this.shouldFail = false;
  }

  setMockResponses(responses: TranscriptionResponse[]): void {
    this.mockResponses = [...responses];
    this.shouldFail = false;
  }

  setFailure(message = 'Simulated transcription failure'): void {
    this.shouldFail = true;
    this.failureMessage = message;
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  getSupportedModels(): TranscriptionModelInfo[] {
    return [
      {
        id: 'whisper-large-v3-turbo',
        name: 'Whisper Large v3 Turbo (Mock)',
        description: 'Mocked turbo model for testing',
        isDefault: true,
      },
      {
        id: 'whisper-large-v3',
        name: 'Whisper Large v3 (Mock)',
        description: 'Mocked large v3 model',
        isDefault: false,
      },
    ];
  }

  getCapabilities(): ProviderCapabilities {
    return {
      wordTimestamps: true,
      segmentTimestamps: true,
      streaming: false,
      maxFileSizeMB: 25,
      supportedLanguages: ['auto', 'en', 'hi'],
    };
  }

  async transcribe(
    _audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResponse> {
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    if (options.signal?.aborted) {
      throw new Error('Transcription was cancelled by the user.');
    }

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    if (this.mockResponses.length > 0) {
      const resp = this.mockResponses.shift()!;
      return resp;
    }

    // Default mock response: English and Hindi bilingual sentence
    return {
      text: 'Namaste friends aaj hum AutoCaption Studio se viral subtitles generate karenge.',
      language: options.language || 'english',
      duration: 5.5,
      segments: [
        {
          id: 0,
          seek: 0,
          start: 0.0,
          end: 2.5,
          text: 'Namaste friends aaj hum',
        },
        {
          id: 1,
          seek: 0,
          start: 2.5,
          end: 5.5,
          text: 'AutoCaption Studio se viral subtitles generate karenge.',
        },
      ],
      words: [
        { word: 'Namaste', start: 0.0, end: 0.4 },
        { word: 'friends', start: 0.45, end: 0.9 },
        { word: 'aaj', start: 1.0, end: 1.3 },
        { word: 'hum', start: 1.35, end: 1.6 },
        { word: 'AutoCaption', start: 2.5, end: 3.1 },
        { word: 'Studio', start: 3.15, end: 3.6 },
        { word: 'se', start: 3.65, end: 3.8 },
        { word: 'viral', start: 3.85, end: 4.2 },
        { word: 'subtitles', start: 4.25, end: 4.7 },
        { word: 'generate', start: 4.75, end: 5.1 },
        { word: 'karenge.', start: 5.15, end: 5.5 },
      ],
    };
  }
}
