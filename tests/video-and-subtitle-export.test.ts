import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Mock electron app & BrowserWindow for headful/headless runner compatibility
vi.mock('electron', () => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp_export_test_data');
  return {
    app: {
      getPath: () => tmpDir,
    },
    BrowserWindow: {
      getAllWindows: () => [],
    },
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

const testTmpDir = path.join(process.cwd(), 'tests', 'tmp_export_test_data');

import {
  formatSrtTimestamp,
  formatVttTimestamp,
  formatAssTimestamp,
  colorToAssColor,
  exportToSrt,
  exportToWebVtt,
  exportToAss,
  getAnimationExportSupport,
} from '../src/shared/export/subtitles';
import {
  escapeFFmpegFilterPath,
  VideoExportManager,
  getTempExportDir,
} from '../src/main/export/videoExporter';
import { createProject } from '../src/main/projects/service';
import { inspectMediaFile } from '../src/main/media/prober';
import type { CaptionSegment, CaptionStyle } from '../src/shared/types';
import { defaultFallbackStyle } from '../src/renderer/src/store/useAppStore';

describe('Video and Subtitle Export Pipeline', () => {
  const userA = '00000000-0000-4000-a000-00000000000a';
  const userB = '00000000-0000-4000-a000-00000000000b';

  const sampleVideoFixture = path.resolve(__dirname, 'fixtures', 'sample_9x16.mp4');

  beforeAll(() => {
    if (!fs.existsSync(testTmpDir)) {
      fs.mkdirSync(testTmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testTmpDir)) {
      try {
        fs.rmSync(testTmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors on open locks
      }
    }
  });

  describe('1. Timecode & Color Formats for Subtitles', () => {
    it('formats SRT timestamps correctly (HH:MM:SS,mmm)', () => {
      expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
      expect(formatSrtTimestamp(1234)).toBe('00:00:01,234');
      expect(formatSrtTimestamp(65432)).toBe('00:01:05,432');
      expect(formatSrtTimestamp(3661005)).toBe('01:01:01,005');
    });

    it('formats WebVTT timestamps correctly (HH:MM:SS.mmm)', () => {
      expect(formatVttTimestamp(0)).toBe('00:00:00.000');
      expect(formatVttTimestamp(1234)).toBe('00:00:01.234');
      expect(formatVttTimestamp(65432)).toBe('00:01:05.432');
      expect(formatVttTimestamp(3661005)).toBe('01:01:01.005');
    });

    it('formats ASS timestamps correctly (H:MM:SS.cc)', () => {
      expect(formatAssTimestamp(0)).toBe('0:00:00.00');
      expect(formatAssTimestamp(1234)).toBe('0:00:01.23');
      expect(formatAssTimestamp(65432)).toBe('0:01:05.43');
      expect(formatAssTimestamp(3661005)).toBe('1:01:01.00');
    });

    it('converts CSS colors to ASS format (&HAABBGGRR) with inverted alpha', () => {
      // Pure White #FFFFFF fully opaque: alpha 00, B=FF, G=FF, R=FF -> &H00FFFFFF
      expect(colorToAssColor('#FFFFFF', 1.0)).toBe('&H00FFFFFF');

      // Pure Red #FF0000: B=00, G=00, R=FF -> &H000000FF
      expect(colorToAssColor('#FF0000', 1.0)).toBe('&H000000FF');

      // Pure Blue #0000FF: B=FF, G=00, R=00 -> &H00FF0000
      expect(colorToAssColor('#0000FF', 1.0)).toBe('&H00FF0000');

      // 50% opacity: alpha = Math.round(255 * 0.5) = 128 -> hex '80'
      const semi = colorToAssColor('#FFFFFF', 0.5);
      expect(semi.startsWith('&H80')).toBe(true);

      // Short hex #FFF
      expect(colorToAssColor('#FFF', 1.0)).toBe('&H00FFFFFF');

      // rgba(255, 0, 0, 0.8)
      const rgbaColor = colorToAssColor('rgba(255, 0, 0, 0.8)');
      expect(rgbaColor).toMatch(/^&H[0-9A-F]{2}0000FF$/i);
    });
  });

  describe('2. Subtitle File Generation (SRT & WebVTT)', () => {
    const mockSegments: CaptionSegment[] = [
      {
        id: 'seg-1',
        startMs: 1000,
        endMs: 3000,
        text: 'This is the edited caption.',
        originalText: 'Unedited original audio',
        words: [],
      },
      {
        id: 'seg-2',
        startMs: 3500,
        endMs: 6000,
        text: 'हिन्दी और Hinglish words included.',
        words: [],
      },
    ];

    it('generates compliant SRT reflecting edited text, never original transcript', () => {
      const srt = exportToSrt(mockSegments);

      // Sequence numbers
      expect(srt).toContain('1\n00:00:01,000 --> 00:00:03,000\nThis is the edited caption.');
      expect(srt).toContain('2\n00:00:03,500 --> 00:00:06,000\nहिन्दी और Hinglish words included.');

      // Never contains originalText
      expect(srt).not.toContain('Unedited original audio');
    });

    it('generates compliant WebVTT starting with WEBVTT header and title', () => {
      const vtt = exportToWebVtt(mockSegments, 'My Project');

      expect(vtt.startsWith('WEBVTT')).toBe(true);
      expect(vtt).toContain('NOTE Title: My Project');
      expect(vtt).toContain('00:00:01.000 --> 00:00:03.000\nThis is the edited caption.');
      expect(vtt).toContain('00:00:03.500 --> 00:00:06.000\nहिन्दी और Hinglish words included.');
    });

    it('sorts segments chronologically in subtitle exports', () => {
      const unordered: CaptionSegment[] = [
        { id: 'seg-b', startMs: 5000, endMs: 7000, text: 'Second', words: [] },
        { id: 'seg-a', startMs: 1000, endMs: 2500, text: 'First', words: [] },
      ];

      const srt = exportToSrt(unordered);
      const firstPos = srt.indexOf('First');
      const secondPos = srt.indexOf('Second');
      expect(firstPos).toBeLessThan(secondPos);
    });
  });

  describe('3. Advanced SubStation Alpha (.ass) Generation', () => {
    it('generates ASS script with correct script headers, styles and alignments', () => {
      const style: CaptionStyle = {
        ...defaultFallbackStyle,
        fontFamily: 'Montserrat, sans-serif',
        fontSize: 36,
        fontWeight: 800,
        textColor: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 4,
        hasShadow: true,
        shadowColor: '#000000',
        shadowBlur: 8,
        shadowOffsetY: 4,
        positionYPercent: 20,
        textAlign: 'center',
      };

      const segments: CaptionSegment[] = [
        {
          id: 'seg-1',
          startMs: 1000,
          endMs: 3000,
          text: 'Hello Cinematic World',
          words: [],
        },
      ];

      const ass = exportToAss({
        segments,
        style,
        videoWidth: 1080,
        videoHeight: 1920,
        title: 'Test ASS Script',
      });

      expect(ass).toContain('[Script Info]');
      expect(ass).toContain('PlayResX: 1080');
      expect(ass).toContain('PlayResY: 1920');
      expect(ass).toContain('[V4+ Styles]');
      expect(ass).toContain('Format: Name, Fontname, Fontsize, PrimaryColour');
      expect(ass).toContain('Montserrat');
      expect(ass).toContain('[Events]');
      expect(ass).toContain('Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\fad(250,200)}HELLO CINEMATIC WORLD');
    });

    it('includes ASS \\fad tags for fade transitions and \\k tags for word karaoke', () => {
      const styleWithAnim: CaptionStyle = {
        ...defaultFallbackStyle,
        animation: {
          preset: 'fade',
          entranceDurationMs: 300,
          exitDurationMs: 250,
          intensity: 1,
          wordEmphasis: false,
        },
      };

      const fadeAss = exportToAss({
        segments: [{ id: '1', startMs: 500, endMs: 2000, text: 'Fading text', words: [] }],
        style: styleWithAnim,
        videoWidth: 1080,
        videoHeight: 1920,
      });

      expect(fadeAss).toContain('{\\fad(300,250)}FADING TEXT');

      // Test karaoke tags
      const karaokeStyle: CaptionStyle = {
        ...defaultFallbackStyle,
        animation: {
          preset: 'karaoke-highlight',
          entranceDurationMs: 100,
          exitDurationMs: 100,
          intensity: 1,
          wordEmphasis: true,
        },
      };

      const karaokeAss = exportToAss({
        segments: [
          {
            id: '1',
            startMs: 1000,
            endMs: 2500,
            text: 'One Two Three',
            words: [
              { id: 'w1', text: 'One', startMs: 1000, endMs: 1500, confidence: 1 },
              { id: 'w2', text: 'Two', startMs: 1500, endMs: 2000, confidence: 1 },
              { id: 'w3', text: 'Three', startMs: 2000, endMs: 2500, confidence: 1 },
            ],
          },
        ],
        style: karaokeStyle,
        videoWidth: 1080,
        videoHeight: 1920,
      });

      expect(karaokeAss).toContain('{\\k50}ONE {\\k50}TWO {\\k50}THREE');
    });

    it('reports correct export compatibility for animations', () => {
      const fadeSupport = getAnimationExportSupport('fade');
      expect(fadeSupport.isFullySupported).toBe(true);
      expect(fadeSupport.status).toBe('native');

      const karaokeSupport = getAnimationExportSupport('karaoke-highlight');
      expect(karaokeSupport.isFullySupported).toBe(true);
      expect(karaokeSupport.status).toBe('native');

      const popSupport = getAnimationExportSupport('pop');
      expect(popSupport.isFullySupported).toBe(false);
      expect(popSupport.status).toBe('fallback');

      const slideSupport = getAnimationExportSupport('slide-up');
      expect(slideSupport.isFullySupported).toBe(false);
      expect(slideSupport.status).toBe('fallback');
    });

    it('escapes Windows backslashes and colons for FFmpeg filter paths', () => {
      const winPath = 'C:\\Users\\User\\AppData\\Local\\Temp\\sub.ass';
      const escaped = escapeFFmpegFilterPath(winPath);

      expect(escaped).toBe('C\\:/Users/User/AppData/Local/Temp/sub.ass');
      expect(escaped.replace(/\\:/g, '')).not.toContain('\\');
    });
  });

  describe('4. Real Video Export with FFmpeg & Hindi Typography', () => {
    let testProjectId: string;
    const exportManager = new VideoExportManager();

    beforeAll(async () => {
      expect(fs.existsSync(sampleVideoFixture)).toBe(true);

      const created = await createProject(userA, {
        name: 'Export Test Video Project',
        aspectRatio: '9:16',
        captionSegments: [
          {
            id: 'seg-1',
            startMs: 100,
            endMs: 800,
            text: 'नमस्ते दुनिया हिन्दी सबटाइटल्स',
            words: [],
          },
          {
            id: 'seg-2',
            startMs: 900,
            endMs: 1500,
            text: 'AutoCaption Production Quality MP4',
            words: [],
          },
        ],
      });

      expect(created.success).toBe(true);
      expect(created.project).toBeDefined();
      testProjectId = created.project!.id;
    });

    it('exports a real burned-in MP4 video and verifies integrity via prober', async () => {
      const startResult = await exportManager.startExport(
        {
          projectId: testProjectId,
          videoPath: sampleVideoFixture,
          resolution: 'original',
          quality: 'standard',
          burnInCaptions: true,
        },
        userA
      );

      expect(startResult.success).toBe(true);
      expect(startResult.jobId).toBeDefined();

      const jobId = startResult.jobId!;

      // Wait for background worker to complete
      let job = exportManager.getJob(jobId, userA);
      let attempts = 0;
      while (job && (job.status === 'queued' || job.status === 'preparing' || job.status === 'rendering' || job.status === 'verifying' || job.status === 'uploading')) {
        await new Promise((r) => setTimeout(r, 400));
        job = exportManager.getJob(jobId, userA);
        attempts++;
        if (attempts > 50) break; // 20s timeout safeguard
      }

      expect(job).toBeDefined();
      expect(job?.status).toBe('completed');
      expect(job?.progress).toBe(100);
      expect(job?.outputPath).toBeDefined();
      expect(fs.existsSync(job!.outputPath!)).toBe(true);

      // Verify the output MP4 using FFprobe
      const probe = await inspectMediaFile(job!.outputPath!);
      expect(probe.success).toBe(true);
      expect(probe.metadata).toBeDefined();

      const meta = probe.metadata!;
      expect(meta.fileSize).toBeGreaterThan(1000);
      expect(meta.durationMs).toBeGreaterThan(500);
      expect(meta.videoCodec).toBe('h264');
      expect(meta.hasAudio).toBe(true);

      // Audio sync verification
      expect(meta.audioCodec).toBe('aac');
    }, 25000);

    it('supports 720p resolution scaling during export', async () => {
      const startResult = await exportManager.startExport(
        {
          projectId: testProjectId,
          videoPath: sampleVideoFixture,
          resolution: '720p',
          quality: 'draft',
          burnInCaptions: true,
        },
        userA
      );

      expect(startResult.success).toBe(true);
      const jobId = startResult.jobId!;

      let job = exportManager.getJob(jobId, userA);
      let attempts = 0;
      while (job && (job.status === 'queued' || job.status === 'preparing' || job.status === 'rendering' || job.status === 'verifying' || job.status === 'uploading')) {
        await new Promise((r) => setTimeout(r, 400));
        job = exportManager.getJob(jobId, userA);
        attempts++;
        if (attempts > 50) break;
      }

      expect(job?.status).toBe('completed');
      const probe = await inspectMediaFile(job!.outputPath!);
      expect(probe.success).toBe(true);
      expect(probe.metadata?.width).toBe(720);
      expect(probe.metadata?.height).toBe(1280);
    }, 25000);
  });

  describe('5. Security, Ownership & RLS Isolation', () => {
    let projectUserA: string;
    const exportManager = new VideoExportManager();

    beforeAll(async () => {
      const p = await createProject(userA, {
        name: 'User A Private Video',
      });
      projectUserA = p.project!.id;
    });

    it('strictly forbids User B from exporting User A project', async () => {
      const result = await exportManager.startExport(
        {
          projectId: projectUserA,
          videoPath: sampleVideoFixture,
        },
        userB // Unauthorized user
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Project not found or access denied');
    });

    it('strictly forbids User B from exporting subtitles for User A project', async () => {
      const result = await exportManager.exportSubtitles(
        {
          projectId: projectUserA,
          format: 'srt',
        },
        userB // Unauthorized user
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Project not found or access denied');
    });

    it('strictly forbids User B from polling or accessing User A export job', async () => {
      const startResult = await exportManager.startExport(
        {
          projectId: projectUserA,
          videoPath: sampleVideoFixture,
        },
        userA
      );

      expect(startResult.success).toBe(true);
      const jobId = startResult.jobId!;

      // User B tries to get status
      expect(() => {
        exportManager.getJob(jobId, userB);
      }).toThrow(/Access denied/i);

      // User B tries to cancel User A's job
      const cancelResult = await exportManager.cancelExport(jobId, userB);
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.error).toContain('Access denied');
    });
  });

  describe('6. Cancellation & File Safety', () => {
    const exportManager = new VideoExportManager();

    it('cancels an active rendering job cleanly without corrupting the original video', async () => {
      const p = await createProject(userA, {
        name: 'Cancellation Test Project',
      });

      const startResult = await exportManager.startExport(
        {
          projectId: p.project!.id,
          videoPath: sampleVideoFixture,
        },
        userA
      );

      expect(startResult.success).toBe(true);
      const jobId = startResult.jobId!;

      // Immediately cancel the job
      const cancelResult = await exportManager.cancelExport(jobId, userA);
      expect(cancelResult.success).toBe(true);

      const job = exportManager.getJob(jobId, userA);
      expect(job?.status).toBe('cancelled');

      // Verify the original source video fixture remains untouched and valid
      expect(fs.existsSync(sampleVideoFixture)).toBe(true);
      const probeOriginal = await inspectMediaFile(sampleVideoFixture);
      expect(probeOriginal.success).toBe(true);
      expect(probeOriginal.metadata?.fileSize).toBeGreaterThan(1000);
    });
  });
});
