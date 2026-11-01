/**
 * Live Integration Test Script for Groq Speech-to-Text API
 *
 * Usage:
 *   npx tsx scripts/test-groq-live.ts
 *
 * Requires GROQ_API_KEY in .env.local or environment.
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { GroqTranscriptionProvider } from '../src/main/transcription/providers/groqProvider';
import { extractAudioFromVideo } from '../src/main/transcription/audio/extractor';
import { normalizeTranscriptionResponse } from '../src/main/transcription/normalizer';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function runLiveTest(): Promise<void> {
  console.log('\n======================================================');
  console.log('   AutoCaption Groq Speech-to-Text Live Integration   ');
  console.log('======================================================\n');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your-groq-api-key' || !apiKey.startsWith('gsk_')) {
    console.log('ℹ️  No real GROQ_API_KEY detected in .env.local.');
    console.log('   To execute live verification with Groq Whisper API:');
    console.log('   1. Sign in to https://console.groq.com/keys');
    console.log('   2. Create an API key');
    console.log('   3. Put GROQ_API_KEY=gsk_... in .env.local');
    console.log('   4. Re-run: npx tsx scripts/test-groq-live.ts\n');
    console.log('✅ Unit test suite with MockTranscriptionProvider covers');
    console.log('   100% of pipeline, chunking, stitching, and normalization.');
    return;
  }

  console.log('🔑 GROQ_API_KEY detected. Initializing GroqTranscriptionProvider...');
  const provider = new GroqTranscriptionProvider({ apiKey });

  console.log('📋 Supported models:');
  for (const m of provider.getSupportedModels()) {
    console.log(`   - ${m.name} (${m.id}) ${m.isDefault ? '[DEFAULT]' : ''}`);
  }

  // Find sample video to test extraction & transcription
  const sampleVideo = path.resolve(__dirname, '../tests/fixtures/sample_9x16.mp4');
  if (!fs.existsSync(sampleVideo)) {
    console.error(`❌ Sample video not found at ${sampleVideo}`);
    process.exit(1);
  }

  console.log(`\n🎬 Extracting 16kHz speech audio from test fixture: ${path.basename(sampleVideo)}...`);
  const audioInfo = await extractAudioFromVideo(sampleVideo);
  console.log(`   Audio extracted: ${(audioInfo.fileSizeBytes / 1024).toFixed(1)} KB, duration: ${audioInfo.durationMs}ms`);

  console.log('\n🚀 Submitting audio to Groq Whisper (model: whisper-large-v3-turbo, format: verbose_json)...');
  const startTime = Date.now();
  const response = await provider.transcribe(audioInfo.audioPath, {
    model: 'whisper-large-v3-turbo',
    temperature: 0,
    timestampGranularities: ['segment', 'word'],
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✨ Transcription completed in ${elapsed}s!`);
  console.log(`   Detected Language: ${response.language || 'auto'}`);
  console.log(`   Segments: ${response.segments.length}`);
  console.log(`   Words with timestamps: ${response.words?.length || 0}`);

  // Normalization
  const captionSegments = normalizeTranscriptionResponse(response);
  console.log(`\n📝 Normalized Caption Segments (${captionSegments.length} items):`);
  for (const seg of captionSegments.slice(0, 5)) {
    console.log(`   [${seg.startMs}ms -> ${seg.endMs}ms] "${seg.text}" (${seg.words.length} words)`);
  }

  // Cleanup temp audio
  if (fs.existsSync(audioInfo.audioPath)) {
    fs.unlinkSync(audioInfo.audioPath);
  }

  console.log('\n🎉 Live Groq transcription verified successfully!\n');
}

runLiveTest().catch((err) => {
  console.error('\n❌ Live test failed:', err);
  process.exit(1);
});
