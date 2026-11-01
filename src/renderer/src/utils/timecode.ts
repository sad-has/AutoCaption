/**
 * SMPTE Timecode Formatter for video playback and timeline.
 * Format: HH:MM:SS:FF (or HH:MM:SS.mmm)
 */

export function formatTimecode(milliseconds: number, fps: number = 30): string {
  if (isNaN(milliseconds) || milliseconds < 0) {
    milliseconds = 0;
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const remainingMs = milliseconds % 1000;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((remainingMs / 1000) * fps);

  const pad = (num: number, len = 2) => String(num).padStart(len, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

export function formatShortTime(milliseconds: number): string {
  if (isNaN(milliseconds) || milliseconds < 0) {
    milliseconds = 0;
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (num: number, len = 2) => String(num).padStart(len, '0');
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function parseTimecodeToMs(timecode: string, fps: number = 30): number {
  const parts = timecode.split(':').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) {
    return 0;
  }

  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  const frames = parts[3] ?? 0;
  const frameDurationMs = 1000 / fps;

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + Math.floor(frames * frameDurationMs);
}
