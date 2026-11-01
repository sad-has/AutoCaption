import { describe, it, expect } from 'vitest';
import { getLocalVideoStreamUrl } from '../src/main/protocol';

describe('Local Video Protocol Streaming URL Generation', () => {
  it('encodes paths safely into local-video URLs', () => {
    const rawPath = 'C:\\Videos\\my video 100%.mp4';
    const streamUrl = getLocalVideoStreamUrl(rawPath);

    expect(streamUrl.startsWith('local-video://stream/?path=')).toBe(true);
    // Path should be URL encoded
    expect(streamUrl).toContain('%20');
  });

  it('preserves and encodes non-English characters in path', () => {
    const unicodePath = 'D:\\Media\\vidéo_हिन्दी.mov';
    const streamUrl = getLocalVideoStreamUrl(unicodePath);

    const parsed = new URL(streamUrl);
    const decoded = decodeURIComponent(parsed.searchParams.get('path') || '');
    expect(decoded).toContain('vidéo_हिन्दी.mov');
  });
});
