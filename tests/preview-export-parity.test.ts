import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';

// Mock electron app & BrowserWindow for headful/headless runner compatibility
vi.mock('electron', () => {
  const tmpDir = path.join(os.tmpdir(), 'autocaption_preview_export_parity');
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

import {
  resolveNormalizedCaptionRendering,
  getCanvasScaleFactor,
  resolveFontNames,
} from '../src/shared/rendering/captionRenderer';
import { exportToAss } from '../src/shared/export/subtitles';
import { BUILTIN_TEMPLATES } from '../src/shared/templates';
import { VideoExportManager, getExportTargetCanvas } from '../src/main/export/videoExporter';
import { getFFmpegBinaryPath, inspectMediaFile } from '../src/main/media/prober';
import { createProject } from '../src/main/projects/service';
import type { CaptionSegment, CaptionStyle } from '../src/shared/types';

describe('Phase 11A: Preview and MP4 Export Rendering Parity', () => {
  const testOutputDir = path.join(os.tmpdir(), 'autocaption_preview_export_parity');
  let ffmpegPath: string;
  let testSampleVideoPath: string;
  let testProjectId: string;
  const mockUserId = '00000000-0000-4000-a000-00000000000b';
  const exportManager = new VideoExportManager();

  beforeAll(async () => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    const binary = getFFmpegBinaryPath();
    expect(binary).toBeTruthy();
    ffmpegPath = binary!;

    // Create a 4-second test video (1920x1080 16:9) with audio tone
    testSampleVideoPath = path.join(testOutputDir, 'sample_source_16x9.mp4');
    const genArgs = [
      '-y',
      '-f', 'lavfi', '-i', 'color=c=0x1a202c:s=1920x1080:d=4:r=30',
      '-f', 'lavfi', '-i', 'sine=frequency=500:duration=4',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      testSampleVideoPath,
    ];
    const genResult = spawnSync(ffmpegPath, genArgs, { encoding: 'utf-8' });
    expect(genResult.status).toBe(0);

    const cinematicTemplate = BUILTIN_TEMPLATES.find((t) => t.id === 'cinematic-trailer') || BUILTIN_TEMPLATES[0]!;

    const created = await createProject(mockUserId, {
      name: 'Preview Export Parity Project',
      aspectRatio: '16:9',
      captionStyle: cinematicTemplate.style,
      captionSegments: [
        {
          id: 'seg-1',
          startMs: 500,
          endMs: 3500,
          text: 'STAY WITH ME',
          words: [
            { id: 'w1', text: 'STAY', startMs: 600, endMs: 1400, confidence: 1 },
            { id: 'w2', text: 'WITH', startMs: 1400, endMs: 2200, confidence: 1 },
            { id: 'w3', text: 'ME', startMs: 2200, endMs: 3200, confidence: 1 },
          ],
        },
      ],
    });
    expect(created.success).toBe(true);
    testProjectId = created.project!.id;
  }, 30000);

  afterAll(() => {
    try {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      }
    } catch {
      // Best-effort cleanup
    }
  });

  it('1. Normalized Typography Scale Parity: ratio of font size to canvas is consistent across screen and export', () => {
    const cinematicStyle = BUILTIN_TEMPLATES[0]!.style;

    // Preview DOM container (e.g. 620x348 in 16:9 mode)
    const previewRendering = resolveNormalizedCaptionRendering({
      style: cinematicStyle,
      canvasWidth: 620,
      canvasHeight: 348,
    });

    // Export Canvas (1920x1080 in 16:9 mode)
    const exportRendering = resolveNormalizedCaptionRendering({
      style: cinematicStyle,
      canvasWidth: 1920,
      canvasHeight: 1080,
    });

    // Ratio of font size to canvas short edge must match exactly
    const previewRatio = previewRendering.fontSizePx / 348;
    const exportRatio = exportRendering.fontSizePx / 1080;

    expect(Math.abs(previewRatio - exportRatio)).toBeLessThan(0.01);

    // Font size at 1080p must be bold and prominent (not tiny 34px)
    expect(exportRendering.fontSizePx).toBeGreaterThanOrEqual(65);
    expect(exportRendering.activeWordColor).toBe('#EAB308');
  });

  it('2. Word-Level Highlighting in ASS: produces golden active-word color tags matching preview', () => {
    const cinematicStyle: CaptionStyle = {
      ...BUILTIN_TEMPLATES[0]!.style,
      activeWordColor: '#EAB308', // Golden accent
      textColor: '#FFFFFF',
      hasWordEmphasis: true,
    };

    const segments: CaptionSegment[] = [
      {
        id: 'seg-test',
        startMs: 1000,
        endMs: 4000,
        text: 'STAY WITH ME',
        words: [
          { id: 'w1', text: 'STAY', startMs: 1200, endMs: 2000 },
          { id: 'w2', text: 'WITH', startMs: 2000, endMs: 2800 },
          { id: 'w3', text: 'ME', startMs: 2800, endMs: 3800 },
        ],
      },
    ];

    const ass = exportToAss({
      segments,
      style: cinematicStyle,
      videoWidth: 1920,
      videoHeight: 1080,
      title: 'Word Emphasis Parity',
      enableWordEmphasis: true,
    });

    // Check that active word color tag &H08B3EA& (#EAB308 BGR) is in the ASS script
    expect(ass).toContain('\\c&H08B3EA&');
    expect(ass).toContain('STAY');
    expect(ass).toContain('WITH');
    expect(ass).toContain('ME');

    // Verify multiple timed dialogue events were generated for word emphasis
    const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBeGreaterThanOrEqual(3);
  });

  it('3. Video Framing & Aspect Ratio Calculations: prevents unintended black bars on matching aspect ratios', () => {
    // 16:9 video in 16:9 project
    const match16x9 = getExportTargetCanvas('16:9', 'original', 1920, 1080);
    expect(match16x9.targetWidth).toBe(1920);
    expect(match16x9.targetHeight).toBe(1080);

    // 9:16 video in 9:16 project
    const match9x16 = getExportTargetCanvas('9:16', 'original', 1080, 1920);
    expect(match9x16.targetWidth).toBe(1080);
    expect(match9x16.targetHeight).toBe(1920);

    // 16:9 video in 9:16 project (intentional vertical crop/fit)
    const fit9x16 = getExportTargetCanvas('9:16', '1080p', 1920, 1080);
    expect(fit9x16.targetWidth).toBe(1080);
    expect(fit9x16.targetHeight).toBe(1920);
  });

  it('4. Font Resolution & Multilingual Fallback: ensures safe system font fallback', () => {
    const resolvedEnglish = resolveFontNames('Cinzel, Georgia, serif', false);
    expect(resolvedEnglish.primaryFontName).toBe('Cinzel');
    expect(resolvedEnglish.fallbackFontNames).toContain('Georgia');
    expect(resolvedEnglish.safeFallback).toBe('Georgia');

    const resolvedHindi = resolveFontNames('Cinzel, Georgia, serif', true);
    expect(resolvedHindi.safeFallback).toBe('Nirmala UI');
  });

  it('5. End-to-End Real Video Export: exports 16:9 MP4 with golden accent words and decodes cleanly', async () => {
    const startResult = await exportManager.startExport(
      {
        projectId: testProjectId,
        videoPath: testSampleVideoPath,
        aspectRatio: '16:9',
        resolution: 'original',
        quality: 'standard',
        burnInCaptions: true,
      },
      mockUserId
    );

    expect(startResult.success).toBe(true);
    expect(startResult.jobId).toBeTruthy();

    const jobId = startResult.jobId!;
    let job = exportManager.getJob(jobId, mockUserId);
    let attempts = 0;
    while (job && (job.status === 'queued' || job.status === 'preparing' || job.status === 'rendering' || job.status === 'verifying' || job.status === 'uploading')) {
      await new Promise((r) => setTimeout(r, 400));
      job = exportManager.getJob(jobId, mockUserId);
      attempts++;
      if (attempts > 50) break;
    }

    expect(job).toBeDefined();
    expect(job?.status).toBe('completed');
    expect(job?.outputPath).toBeTruthy();
    expect(fs.existsSync(job!.outputPath!)).toBe(true);

    const probe = await inspectMediaFile(job!.outputPath!);
    expect(probe.success).toBe(true);
    expect(probe.metadata).toBeTruthy();

    const meta = probe.metadata!;
    // Target 16:9 was respected
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.durationMs).toBeGreaterThan(3500);
    expect(meta.hasAudio).toBe(true);

    // Frame-level decode check with FFmpeg null sink
    const nullSinkResult = spawnSync(ffmpegPath, ['-v', 'error', '-i', job!.outputPath!, '-f', 'null', '-'], {
      encoding: 'utf-8',
    });
    expect(nullSinkResult.status).toBe(0);
    expect(nullSinkResult.stderr.trim()).toBe('');
  }, 35000);
});
