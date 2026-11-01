import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, STYLE_PRESETS } from '../src/renderer/src/store/useAppStore';
import type { MediaAsset } from '../src/shared/types';

describe('App State Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeView: 'editor',
      aspectRatio: '9:16',
      currentTimeMs: 0,
      durationMs: 0,
      isPlaying: false,
      volume: 1,
      isMuted: false,
      leftPanelWidth: 260,
      rightPanelWidth: 320,
      bottomPanelHeight: 230,
      currentProject: {
        id: 'test-proj',
        name: 'Test Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaAsset: null,
        captionSegments: [],
        captionStyle: { ...STYLE_PRESETS['hormozi']! },
        aspectRatio: '9:16',
      },
    });
  });

  it('updates project moniker correctly', () => {
    useAppStore.getState().setProjectName('My Viral Reel');
    expect(useAppStore.getState().currentProject.name).toBe('My Viral Reel');
  });

  it('switches aspect ratio properly', () => {
    useAppStore.getState().setAspectRatio('16:9');
    expect(useAppStore.getState().aspectRatio).toBe('16:9');
    expect(useAppStore.getState().currentProject.aspectRatio).toBe('16:9');
  });

  it('applies viral style presets accurately', () => {
    useAppStore.getState().applyPreset('beast');
    const style = useAppStore.getState().currentProject.captionStyle;
    expect(style.presetId).toBe('beast');
    expect(style.fontFamily).toBe(STYLE_PRESETS['beast']!.fontFamily);
    expect(style.activeWordColor).toBe('#10B981');
  });

  it('imports and replaces media assets with duration and aspect ratio update', () => {
    const asset1: MediaAsset = {
      id: 'm1',
      name: 'video1.mp4',
      filePath: '/path/video1.mp4',
      streamUrl: 'local-video://stream/?path=%2Fpath%2Fvideo1.mp4',
      durationMs: 12000,
      width: 1080,
      height: 1920,
      sizeBytes: 10000000,
      fps: 30,
      aspectRatio: '9:16',
      createdAt: new Date().toISOString(),
    };

    useAppStore.getState().importMedia(asset1);
    expect(useAppStore.getState().currentProject.mediaAsset).toEqual(asset1);
    expect(useAppStore.getState().durationMs).toBe(12000);
    expect(useAppStore.getState().aspectRatio).toBe('9:16');

    // Replace with a 16:9 video
    const asset2: MediaAsset = {
      id: 'm2',
      name: 'video2.mp4',
      filePath: '/path/video2.mp4',
      streamUrl: 'local-video://stream/?path=%2Fpath%2Fvideo2.mp4',
      durationMs: 25000,
      width: 1920,
      height: 1080,
      sizeBytes: 20000000,
      fps: 60,
      aspectRatio: '16:9',
      createdAt: new Date().toISOString(),
    };

    useAppStore.getState().replaceMedia(asset2);
    expect(useAppStore.getState().currentProject.mediaAsset?.name).toBe('video2.mp4');
    expect(useAppStore.getState().durationMs).toBe(25000);
    expect(useAppStore.getState().aspectRatio).toBe('16:9');

    // Remove media
    useAppStore.getState().removeMedia();
    expect(useAppStore.getState().currentProject.mediaAsset).toBeNull();
    expect(useAppStore.getState().durationMs).toBe(0);
  });

  it('manages audio volume, muting and playhead scrubbing flags', () => {
    useAppStore.getState().setVolume(0.5);
    expect(useAppStore.getState().volume).toBe(0.5);
    expect(useAppStore.getState().isMuted).toBe(false);

    useAppStore.getState().toggleMute();
    expect(useAppStore.getState().isMuted).toBe(true);

    useAppStore.getState().setIsScrubbing(true);
    expect(useAppStore.getState().isScrubbing).toBe(true);
  });

  it('clamps resizable panel dimensions within safe ranges', () => {
    useAppStore.getState().setLeftPanelWidth(100);
    expect(useAppStore.getState().leftPanelWidth).toBe(180);

    useAppStore.getState().setLeftPanelWidth(600);
    expect(useAppStore.getState().leftPanelWidth).toBe(420);

    useAppStore.getState().setRightPanelWidth(100);
    expect(useAppStore.getState().rightPanelWidth).toBe(240);

    useAppStore.getState().setBottomPanelHeight(50);
    expect(useAppStore.getState().bottomPanelHeight).toBe(140);
  });

  it('adds and modifies caption segments properly', () => {
    const initialCount = useAppStore.getState().currentProject.captionSegments.length;
    useAppStore.getState().addSegment();
    const afterAdd = useAppStore.getState().currentProject.captionSegments;
    expect(afterAdd.length).toBe(initialCount + 1);

    const newSeg = afterAdd[afterAdd.length - 1];
    expect(newSeg).toBeDefined();
    if (newSeg) {
      useAppStore.getState().updateSegmentText(newSeg.id, 'UPDATED CAPTION');
      const updated = useAppStore.getState().currentProject.captionSegments.find((s) => s.id === newSeg.id);
      expect(updated?.text).toBe('UPDATED CAPTION');
    }
  });
});
