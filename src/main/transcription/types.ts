/**
 * Provider-agnostic Speech-to-Text Transcription Types & Interfaces.
 * Keeps the application architecture modular so providers beyond Groq
 * (e.g., local Whisper, OpenAI, Deepgram) can be seamlessly integrated.
 */

export interface TranscriptionOptions {
  model?: string;
  language?: string; // e.g., 'en', 'hi', or undefined for auto-detection
  temperature?: number;
  prompt?: string;
  timestampGranularities?: Array<'word' | 'segment'>;
  wordsPerSegment?: number; // 0 or undefined for natural sentence chunks, or 1+ words per segment
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface TranscriptionWord {
  word: string;
  start: number; // in seconds float
  end: number;   // in seconds float
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number; // in seconds float
  end: number;   // in seconds float
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
  words?: TranscriptionWord[];
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments: TranscriptionSegment[];
  words?: TranscriptionWord[];
}

export interface TranscriptionModelInfo {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

export interface ProviderCapabilities {
  wordTimestamps: boolean;
  segmentTimestamps: boolean;
  streaming: boolean;
  maxFileSizeMB: number;
  supportedLanguages: string[];
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly name: string;
  transcribe(audioFilePath: string, options?: TranscriptionOptions): Promise<TranscriptionResponse>;
  getSupportedModels(): TranscriptionModelInfo[];
  getCapabilities(): ProviderCapabilities;
}
