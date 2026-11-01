import { describe, it, expect } from 'vitest';
import { formatTimecode, parseTimecodeToMs } from '../src/renderer/src/utils/timecode';

describe('SMPTE Timecode Formatter', () => {
  it('formats 0 milliseconds properly', () => {
    expect(formatTimecode(0)).toBe('00:00:00:00');
  });

  it('formats seconds and frames correctly at 30 fps', () => {
    // 1500 ms = 1 second + 500 ms = 15 frames at 30fps
    expect(formatTimecode(1500, 30)).toBe('00:00:01:15');
  });

  it('formats minutes and hours correctly', () => {
    // 1 hour, 2 minutes, 3 seconds = 3600000 + 120000 + 3000 = 3723000 ms
    expect(formatTimecode(3723000, 30)).toBe('01:02:03:00');
  });

  it('handles negative or invalid values gracefully', () => {
    expect(formatTimecode(-100)).toBe('00:00:00:00');
    expect(formatTimecode(NaN)).toBe('00:00:00:00');
  });

  it('parses timecode back to milliseconds correctly', () => {
    const ms = parseTimecodeToMs('00:00:01:15', 30);
    expect(ms).toBe(1500);
  });
});
