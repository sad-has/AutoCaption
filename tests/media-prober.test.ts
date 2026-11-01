import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { inspectMediaFile } from '../src/main/media/prober';

describe('Real Media Prober (FFmpeg Integration)', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('probes a real 9:16 vertical MP4 video correctly', async () => {
    const filePath = path.join(fixturesDir, 'sample_9x16.mp4');
    const result = await inspectMediaFile(filePath);

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    if (result.metadata) {
      expect(result.metadata.width).toBe(1080);
      expect(result.metadata.height).toBe(1920);
      expect(result.metadata.aspectRatio).toBe('9:16');
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(2800);
      expect(result.metadata.durationMs).toBeLessThanOrEqual(3200);
      expect(result.metadata.videoCodec).toBe('h264');
      expect(result.metadata.hasAudio).toBe(true);
      expect(result.metadata.fps).toBe(30);
      expect(result.metadata.streamUrl).toContain('local-video://stream/?path=');
    }
  });

  it('probes a real 16:9 widescreen MP4 video correctly', async () => {
    const filePath = path.join(fixturesDir, 'sample_16x9.mp4');
    const result = await inspectMediaFile(filePath);

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    if (result.metadata) {
      expect(result.metadata.width).toBe(1920);
      expect(result.metadata.height).toBe(1080);
      expect(result.metadata.aspectRatio).toBe('16:9');
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(1800);
      expect(result.metadata.durationMs).toBeLessThanOrEqual(2200);
    }
  });

  it('handles spaces and non-English (Unicode) characters in file paths', async () => {
    const filePath = path.join(fixturesDir, 'sample video with spaces & español हिन्दी 9x16.mp4');
    const result = await inspectMediaFile(filePath);

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    if (result.metadata) {
      expect(result.metadata.width).toBe(720);
      expect(result.metadata.height).toBe(1280);
      expect(result.metadata.aspectRatio).toBe('9:16');
      expect(result.metadata.fileName).toContain('español');
    }
  });

  it('returns clean error state for corrupted or invalid files', async () => {
    const filePath = path.join(fixturesDir, 'corrupted_video.mp4');
    const result = await inspectMediaFile(filePath);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('unsupported_format');
    expect(result.error).toContain('does not contain a recognized video');
  });

  it('returns not_found error for missing file paths', async () => {
    const filePath = path.join(fixturesDir, 'completely_missing_video_file.mp4');
    const result = await inspectMediaFile(filePath);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('not_found');
  });
});
