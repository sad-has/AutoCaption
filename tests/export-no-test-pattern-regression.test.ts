import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';

// Mock electron app & BrowserWindow for headful/headless runner compatibility
vi.mock('electron', () => {
  const tmpDir = path.join(os.tmpdir(), 'autocaption_test_pattern_regression');
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

import { VideoExportManager } from '../src/main/export/videoExporter';
import { getFFmpegBinaryPath, inspectMediaFile } from '../src/main/media/prober';
import { createProject } from '../src/main/projects/service';
import type { UserSession } from '../src/shared/types';

describe('Regression & Integrity: Export Original Video Without Test Patterns', () => {
  const testOutputDir = path.join(os.tmpdir(), 'autocaption_test_pattern_regression');
  let ffmpegPath: string;
  let customSampleVideoPath: string;
  let testProjectId: string;
  const sampleDurationSec = 5; // 5.0 seconds (5000ms), distinctly different from 3.0s test patterns
  const mockUserId = '00000000-0000-4000-a000-00000000000a';
  const exportManager = new VideoExportManager();

  beforeAll(async () => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    const binary = getFFmpegBinaryPath();
    expect(binary).toBeTruthy();
    ffmpegPath = binary!;

    // Generate a unique 5-second test video with solid teal background (NOT smptebars / colorbars)
    // and a real 440Hz sine wave audio tone so both video & audio streams are active.
    customSampleVideoPath = path.join(testOutputDir, 'real_user_video_5s.mp4');
    const genArgs = [
      '-y',
      '-f', 'lavfi', '-i', `color=c=0x008080:s=720x1280:d=${sampleDurationSec}:r=30`,
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${sampleDurationSec}`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      customSampleVideoPath,
    ];

    const genResult = spawnSync(ffmpegPath, genArgs, { encoding: 'utf-8' });
    expect(genResult.status).toBe(0);
    expect(fs.existsSync(customSampleVideoPath)).toBe(true);

    const created = await createProject(mockUserId, {
      name: 'Regression Test Real Video Project',
      aspectRatio: '9:16',
      captionSegments: [
        {
          id: 'seg-1',
          startMs: 500,
          endMs: 3500,
          text: 'Verified Real Video Export Without Patterns',
          words: [],
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

  it('1. Codebase Audit: Verify no fallback to sample_9x16.mp4 or smptebars in export paths', () => {
    const devServerPath = path.resolve(process.cwd(), 'scripts', 'devServerTranscription.ts');
    const devServerCode = fs.readFileSync(devServerPath, 'utf-8');

    // Ensure sample_9x16.mp4 is NEVER referenced as a fallback in devServer export endpoint
    expect(devServerCode).not.toContain("const testFixture = path.resolve(process.cwd(), 'tests', 'fixtures', 'sample_9x16.mp4');");
    expect(devServerCode).not.toContain("videoPath = testFixture;");

    // Ensure videoExporter.ts does not generate test patterns on missing media
    const videoExporterPath = path.resolve(process.cwd(), 'src', 'main', 'export', 'videoExporter.ts');
    const videoExporterCode = fs.readFileSync(videoExporterPath, 'utf-8');
    expect(videoExporterCode).not.toContain('smptebars');
    expect(videoExporterCode).not.toContain('testsrc');
  });

  it('2. Fails cleanly when source video does not exist, never generating a test pattern fallback', async () => {
    const nonExistentPath = path.join(testOutputDir, 'completely_missing_video_file_12345.mp4');

    const result = await exportManager.startExport(
      {
        projectId: testProjectId,
        videoPath: nonExistentPath,
        resolution: 'original',
        quality: 'standard',
        burnInCaptions: true,
      },
      mockUserId
    );

    // Should either reject at start or fail in background job without creating any fake video
    if (result.success && result.jobId) {
      let job = exportManager.getJob(result.jobId, mockUserId);
      let attempts = 0;
      while (job && job.status !== 'completed' && job.status !== 'failed') {
        await new Promise((r) => setTimeout(r, 200));
        job = exportManager.getJob(result.jobId, mockUserId);
        attempts++;
        if (attempts > 30) break;
      }
      expect(job?.status).toBe('failed');
      expect(job?.error).toMatch(/not available|does not exist|not found|corrupt/i);
    } else {
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not available|does not exist|not found|corrupt/i);
    }
  });

  it('3. Renders the exact user video, preserves full 5s duration, audio stream, and decodes cleanly', async () => {
    const startResult = await exportManager.startExport(
      {
        projectId: testProjectId,
        videoPath: customSampleVideoPath,
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
      if (attempts > 60) break; // 24s safety timeout
    }

    expect(job).toBeDefined();
    expect(job?.status).toBe('completed');
    expect(job?.outputPath).toBeTruthy();
    expect(fs.existsSync(job!.outputPath!)).toBe(true);

    const stats = fs.statSync(job!.outputPath!);
    expect(stats.size).toBeGreaterThan(10 * 1024); // Size > 10KB

    // Inspect exported MP4 metadata using inspectMediaFile probe
    const probe = await inspectMediaFile(job!.outputPath!);
    expect(probe.success).toBe(true);
    expect(probe.metadata).toBeTruthy();

    const meta = probe.metadata!;
    // Duration must match the original 5000ms video (within ±1000ms), NOT 3000ms (the 3-second test clip)!
    expect(meta.durationMs).toBeGreaterThan(4500);
    expect(meta.durationMs).toBeLessThan(5500);

    // Audio stream must be preserved
    expect(meta.hasAudio).toBe(true);
    expect(meta.audioCodec).toBe('aac');

    // Full frame decodability test with null sink
    const nullSinkResult = spawnSync(ffmpegPath, ['-v', 'error', '-i', job!.outputPath!, '-f', 'null', '-'], {
      encoding: 'utf-8',
    });
    expect(nullSinkResult.status).toBe(0);
    expect(nullSinkResult.stderr.trim()).toBe('');
  }, 35000);
});
