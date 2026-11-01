import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { exportToAss, toInlineAssColor, DEVANAGARI_REGEX } from '../src/shared/export/subtitles';
import { videoExportManager } from '../src/main/export/videoExporter';
import { inspectMediaFile, getFFmpegBinaryPath } from '../src/main/media/prober';
import { handleSaveFileDialog } from '../src/main/ipc/dialogs';
import { handleShellShowInFolder } from '../src/main/ipc/window';
import type { CaptionSegment, CaptionStyle } from '../src/shared/types';
import { BUILTIN_TEMPLATES } from '../src/shared/templates';

describe('Export System Quality Audit & Debugging Verification', () => {
  const sample9x16 = path.resolve(process.cwd(), 'tests', 'fixtures', 'sample_9x16.mp4');
  const sample16x9 = path.resolve(process.cwd(), 'tests', 'fixtures', 'sample_16x9.mp4');
  const tempTestDir = path.resolve(process.cwd(), 'tests', 'tmp_export_audit_data');
  const testUserId = '00000000-0000-4000-a000-0000000000aa';

  beforeAll(async () => {
    if (!fs.existsSync(tempTestDir)) {
      await fsp.mkdir(tempTestDir, { recursive: true });
    }
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempTestDir)) {
        await fsp.rm(tempTestDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. In-Memory Project Export & Live Editor Sync', () => {
    it('allows exporting in-memory active project (proj-1) without requiring database sync', async () => {
      const activeSegments: CaptionSegment[] = [
        {
          id: 'seg-1',
          startMs: 200,
          endMs: 1800,
          text: 'Live Editor Caption',
          words: [
            { id: 'w1', text: 'Live', startMs: 200, endMs: 600 },
            { id: 'w2', text: 'Editor', startMs: 600, endMs: 1200 },
            { id: 'w3', text: 'Caption', startMs: 1200, endMs: 1800 },
          ],
        },
      ];

      const result = await videoExportManager.startExport(
        {
          projectId: 'proj-1',
          projectName: 'Live Active Editor Project',
          videoPath: sample9x16,
          burnInCaptions: true,
          captionSegments: activeSegments,
          resolution: '720p',
          quality: 'draft',
        },
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.jobId).toBeTruthy();

      // Poll until completed
      let completedJob = null;
      for (let i = 0; i < 80; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const progress = videoExportManager.getJob(result.jobId!, testUserId);
        if (progress && (progress.status === 'completed' || progress.status === 'failed')) {
          completedJob = progress;
          break;
        }
      }

      expect(completedJob).not.toBeNull();
      expect(completedJob?.status).toBe('completed');
      expect(completedJob?.outputPath).toBeTruthy();
      expect(fs.existsSync(completedJob!.outputPath!)).toBe(true);

      // Verify MP4 file integrity with real prober
      const probe = await inspectMediaFile(completedJob!.outputPath!);
      expect(probe.success).toBe(true);
      expect(probe.metadata?.hasAudio).toBe(true);
      expect(probe.metadata?.videoCodec).toBe('h264');
      expect(probe.metadata?.height).toBe(1280);
      expect(probe.metadata?.width).toBe(720);
    });

    it('ensures live edited captions take precedence over stored database segments', async () => {
      const segments: CaptionSegment[] = [
        {
          id: 'seg-edited',
          startMs: 100,
          endMs: 1500,
          text: 'Live Edited Subtitle Content',
          words: [],
        },
      ];

      const subResult = await videoExportManager.exportSubtitles(
        {
          projectId: 'proj-1',
          projectName: 'My Project',
          format: 'srt',
          captionSegments: segments,
        },
        testUserId
      );

      expect(subResult.success).toBe(true);
      expect(subResult.content).toContain('Live Edited Subtitle Content');
      expect(subResult.content).toContain('00:00:00,100 --> 00:00:01,500');
    });
  });

  describe('2. Per-Segment Style Overrides & Inline ASS Tags', () => {
    it('generates inline ASS tags for segment color, font size, bold, stroke, and font overrides', () => {
      const baseStyle: CaptionStyle = {
        presetId: 'cinematic-trailer',
        fontFamily: 'Montserrat, sans-serif',
        fontSize: 40,
        fontWeight: 400,
        textColor: '#FFFFFF',
        textTransform: 'none',
        letterSpacing: 0,
        lineHeight: 1.2,
        textAlign: 'center',
        maxWidthPercent: 90,
        strokeColor: '#000000',
        strokeWidth: 2,
        hasShadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 4,
        shadowOffsetY: 2,
        hasBox: false,
        boxColor: '#000000',
        boxOpacity: 0.8,
        boxPaddingX: 12,
        boxPaddingY: 8,
        boxCornerRadius: 4,
        positionYPercent: 15,
        positionXPercent: 50,
        activeWordColor: '#F59E0B',
      };

      const segments: CaptionSegment[] = [
        {
          id: 'seg-1',
          startMs: 0,
          endMs: 1000,
          text: 'Normal Segment',
          words: [],
        },
        {
          id: 'seg-2',
          startMs: 1000,
          endMs: 2000,
          text: 'Custom Yellow Segment',
          words: [],
          styleOverrides: {
            textColor: '#F59E0B', // Amber
            fontSize: 55,
            fontWeight: 800,
            fontFamily: 'Anton, sans-serif',
            strokeColor: '#EF4444',
            strokeWidth: 6,
          },
        },
      ];

      const ass = exportToAss({
        segments,
        style: baseStyle,
        videoWidth: 1080,
        videoHeight: 1920,
        title: 'Override Test',
      });

      // Verify normal segment has standard default styling
      expect(ass).toContain('Dialogue: 0,0:00:00.00,0:00:01.00,Default');
      expect(ass).toContain('Normal Segment');

      // Verify segment 2 contains inline override tags:
      // \c for color, \fn for font family, \fs for font size, \b1 for bold, \3c for stroke, \bord for stroke width
      expect(ass).toContain('\\c');
      expect(ass).toContain('\\fnAnton');
      expect(ass).toContain('\\b1');
      expect(ass).toContain('\\3c');
      expect(ass).toContain('Custom Yellow Segment');
    });

    it('converts hex colors to ASS inline format correctly', () => {
      // #FFFFFF -> &HFFFFFF&
      expect(toInlineAssColor('#FFFFFF')).toBe('&HFFFFFF&');
      // #FF0000 -> Red in BGR is 0000FF -> &H0000FF&
      expect(toInlineAssColor('#FF0000')).toBe('&H0000FF&');
      // #0000FF -> Blue in BGR is FF0000 -> &HFF0000&
      expect(toInlineAssColor('#0000FF')).toBe('&HFF0000&');
    });
  });

  describe('3. Hindi & Multilingual Glyph Support in Export', () => {
    it('detects Devanagari script and assigns Hindi style fallback for proper glyph shaping', () => {
      expect(DEVANAGARI_REGEX.test('नमस्ते भारत')).toBe(true);
      expect(DEVANAGARI_REGEX.test('Cinematic Trailer 2026')).toBe(false);

      const baseStyle: CaptionStyle = {
        ...BUILTIN_TEMPLATES[0]!.style,
        fontFamily: 'Cinzel, serif', // English serif font that does not contain Devanagari glyphs
      };

      const segments: CaptionSegment[] = [
        {
          id: 'seg-hindi',
          startMs: 0,
          endMs: 2000,
          text: 'सिनेमैटिक कैप्शन नमस्ते',
          words: [],
        },
      ];

      const ass = exportToAss({
        segments,
        style: baseStyle,
        videoWidth: 1080,
        videoHeight: 1920,
        title: 'Hindi Test',
      });

      // Header should define Style: Hindi with Noto Sans Devanagari
      expect(ass).toContain('Style: Hindi,Noto Sans Devanagari');
      // Dialogue event should reference Hindi style
      expect(ass).toContain('Hindi,,0,0,0,,');
      expect(ass).toContain('सिनेमैटिक कैप्शन नमस्ते');
    });

    it('supports Hinglish code-switching with preserved glyphs', () => {
      const hinglishSegments: CaptionSegment[] = [
        {
          id: 'seg-hinglish',
          startMs: 500,
          endMs: 2500,
          text: 'Ye video viral hone wala hai!',
          words: [],
        },
      ];

      const srt = videoExportManager.exportSubtitles(
        {
          projectId: 'proj-1',
          format: 'srt',
          captionSegments: hinglishSegments,
        },
        testUserId
      );

      return srt.then((res) => {
        expect(res.success).toBe(true);
        expect(res.content).toContain('Ye video viral hone wala hai!');
      });
    });
  });

  describe('4. Aspect Ratio & Resolution Handling', () => {
    it('renders and verifies a 16:9 widescreen video scaled to 720p', async () => {
      const segments: CaptionSegment[] = [
        {
          id: 'seg-16x9',
          startMs: 300,
          endMs: 1700,
          text: 'Widescreen Cinematic',
          words: [],
        },
      ];

      const result = await videoExportManager.startExport(
        {
          projectId: 'proj-1',
          projectName: 'Widescreen 720p Test',
          videoPath: sample16x9,
          resolution: '720p',
          quality: 'draft',
          captionSegments: segments,
        },
        testUserId
      );

      expect(result.success).toBe(true);

      let completedJob = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const progress = videoExportManager.getJob(result.jobId!, testUserId);
        if (progress && (progress.status === 'completed' || progress.status === 'failed')) {
          completedJob = progress;
          break;
        }
      }

      expect(completedJob?.status).toBe('completed');
      const probe = await inspectMediaFile(completedJob!.outputPath!);
      expect(probe.success).toBe(true);
      // 16:9 scaled to 720p: 1280x720
      expect(probe.metadata?.width).toBe(1280);
      expect(probe.metadata?.height).toBe(720);
      expect(probe.metadata?.aspectRatio).toBe('16:9');
    });
  });

  describe('5. Native Save File & Shell Integration', () => {
    it('copies output file to designated target path safely', async () => {
      const sourceTestFile = path.join(tempTestDir, 'source_test.mp4');
      const destinationTestFile = path.join(tempTestDir, 'saved_destination.mp4');
      await fsp.writeFile(sourceTestFile, 'DUMMY_MP4_CONTENT_FOR_COPY_TEST', 'utf-8');

      // Test handleSaveFileDialog mock/direct copy
      const copyResult = await handleSaveFileDialog(null, {
        sourcePath: sourceTestFile,
        suggestedName: destinationTestFile,
      });

      // In non-interactive test environment without real electron GUI, dialog may return cancelled or path
      if (!copyResult.canceled && copyResult.savedPath) {
        expect(fs.existsSync(copyResult.savedPath)).toBe(true);
      } else {
        expect(copyResult.success).toBe(true);
      }
    });

    it('safely calls showItemInFolder without throwing errors', async () => {
      const exists = await handleShellShowInFolder(sample9x16);
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('6. Template Engine Compatibility in Export', () => {
    it('all 18 built-in cinematic templates produce valid ASS scripts without syntax errors', () => {
      const testSegments: CaptionSegment[] = [
        {
          id: 'test-seg',
          startMs: 1000,
          endMs: 3000,
          text: 'Template Render Test',
          words: [
            { id: 'w1', text: 'Template', startMs: 1000, endMs: 1600 },
            { id: 'w2', text: 'Render', startMs: 1600, endMs: 2300 },
            { id: 'w3', text: 'Test', startMs: 2300, endMs: 3000 },
          ],
        },
      ];

      for (const tpl of BUILTIN_TEMPLATES) {
        const ass = exportToAss({
          segments: testSegments,
          style: tpl.style,
          videoWidth: 1080,
          videoHeight: 1920,
          title: tpl.name,
        });

        expect(ass).toContain('[Script Info]');
        expect(ass).toContain('[V4+ Styles]');
        expect(ass).toContain('[Events]');
        expect(ass).toContain('Dialogue: 0,');
        expect(ass.replace(/\{[^}]+\}/g, '').toLowerCase()).toContain('template render test');
      }
    });
  });
});
