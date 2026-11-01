import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  UploadCloud,
  HardDrive,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Volume1,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatTimecode } from '../../utils/timecode';
import { cn } from '../../utils/cn';
import { VideoPlayer } from '../player/VideoPlayer';
import type { AspectRatio, MediaAsset } from '@shared/types';
import { logger } from '../../utils/logger';

export const CenterPreview: React.FC = () => {
  const {
    currentProject,
    aspectRatio,
    setAspectRatio,
    showSafeMargins,
    toggleSafeMargins,
    currentTimeMs,
    setCurrentTimeMs,
    durationMs,
    isPlaying,
    togglePlay,
    playbackRate,
    setPlaybackRate,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    zoomLevel,
    setZoomLevel,
    importMedia,
    mediaLoading,
    setMediaLoading,
    setMediaError,
    mediaWarning,
    setMediaWarning,
    setTranscriptionModalOpen,
  } = useAppStore();

  const [isHoverDrop, setIsHoverDrop] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common file inspection logic supporting both Electron native paths and browser File objects
  const processSelectedFile = async (fileOrPath: File | string) => {
    setMediaLoading(true);
    setMediaError(null);
    setMediaWarning(null);

    try {
      let resolvedPath: string | null = null;
      let domFile: File | null = null;

      if (typeof fileOrPath === 'string') {
        resolvedPath = fileOrPath;
      } else {
        domFile = fileOrPath;
        if (window.electronAPI?.getPathForFile) {
          try {
            resolvedPath = window.electronAPI.getPathForFile(fileOrPath);
          } catch (err) {
            logger.warn('CenterPreview', 'Could not get path from webUtils', err);
          }
        }
        if (
          !resolvedPath &&
          'path' in fileOrPath &&
          typeof (fileOrPath as { path?: string }).path === 'string' &&
          (fileOrPath as { path?: string }).path
        ) {
          resolvedPath = (fileOrPath as { path: string }).path;
        }
      }

      if (resolvedPath && window.electronAPI) {
        const inspectResult = await window.electronAPI.inspectMediaFile(resolvedPath);

        if (!inspectResult.success || !inspectResult.metadata) {
          const err = inspectResult.error || 'Failed to inspect media file.';
          logger.error('CenterPreview', err);
          setMediaError(err);
          return;
        }

        const meta = inspectResult.metadata;
        if (meta.warning) {
          setMediaWarning(meta.warning);
        }

        const newAsset: MediaAsset = {
          id: `media-${Date.now()}`,
          name: meta.fileName,
          filePath: meta.filePath,
          streamUrl: meta.streamUrl,
          durationMs: meta.durationMs,
          width: meta.width,
          height: meta.height,
          sizeBytes: meta.fileSize,
          fps: meta.fps,
          aspectRatio: meta.aspectRatio,
          videoCodec: meta.videoCodec,
          audioCodec: meta.audioCodec,
          hasAudio: meta.hasAudio,
          isSupportedByBrowser: meta.isSupportedByBrowser,
          createdAt: new Date().toISOString(),
        };

        importMedia(newAsset);

        // Upload real video file to dev server media cache so export has the exact original file
        if (domFile) {
          fetch(`/api/dev/media/upload?fileName=${encodeURIComponent(domFile.name)}&projectId=${useAppStore.getState().currentProject.id}`, {
            method: 'POST',
            body: domFile,
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.filePath) {
                logger.info('CenterPreview', `Uploaded source video to server disk cache: ${data.filePath}`);
                useAppStore.getState().importMedia({
                  ...newAsset,
                  filePath: data.filePath,
                  durationMs: data.metadata?.durationMs || newAsset.durationMs,
                  width: data.metadata?.width || newAsset.width,
                  height: data.metadata?.height || newAsset.height,
                });
              }
            })
            .catch((uploadErr) => {
              logger.warn('CenterPreview', 'Background dev media upload error', uploadErr);
            });
        }

        if (resolvedPath) {
          void useAppStore.getState().startVideoUpload(resolvedPath);
        }
      } else if (domFile) {
        // Fallback for browser mode or when filesystem path is inaccessible
        logger.info('CenterPreview', `Using browser object URL for ${domFile.name}`);
        const streamUrl = URL.createObjectURL(domFile);
        const ext = domFile.name.split('.').pop()?.toLowerCase() || '';

        const newAsset: MediaAsset = {
          id: `media-${Date.now()}`,
          name: domFile.name,
          filePath: resolvedPath || domFile.name,
          streamUrl,
          durationMs: 0, // VideoPlayer onLoadedMetadata updates with real duration
          width: 1920,
          height: 1080,
          sizeBytes: domFile.size,
          fps: 30,
          aspectRatio: '9:16',
          videoCodec: ext === 'webm' ? 'vp8' : 'h264',
          audioCodec: 'aac',
          hasAudio: true,
          isSupportedByBrowser: true,
          browserFile: domFile,
          createdAt: new Date().toISOString(),
        };

        importMedia(newAsset);

        // Upload real video file to dev server media cache so export has the exact original file
        if (domFile) {
          fetch(`/api/dev/media/upload?fileName=${encodeURIComponent(domFile.name)}&projectId=${useAppStore.getState().currentProject.id}`, {
            method: 'POST',
            body: domFile,
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.filePath) {
                logger.info('CenterPreview', `Uploaded source video to server disk cache: ${data.filePath}`);
                useAppStore.getState().importMedia({
                  ...newAsset,
                  filePath: data.filePath,
                  durationMs: data.metadata?.durationMs || newAsset.durationMs,
                  width: data.metadata?.width || newAsset.width,
                  height: data.metadata?.height || newAsset.height,
                });
              }
            })
            .catch((uploadErr) => {
              logger.warn('CenterPreview', 'Background dev media upload error', uploadErr);
            });
        }

        if (resolvedPath) {
          void useAppStore.getState().startVideoUpload(resolvedPath);
        }
      } else {
        setMediaError('Could not determine file path. Please use the Import Video button.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error opening video';
      logger.error('CenterPreview', msg, err);
      setMediaError(msg);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleBrowseVideo = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.openFileDialog({
          title: 'Select Video for Captioning',
          filters: [
            { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4v'] },
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (!result.canceled && result.filePath) {
          await processSelectedFile(result.filePath);
          return;
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      logger.error('CenterPreview', 'Open file dialog error, triggering fallback file input', err);
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleStepFrame = (forward: boolean) => {
    const fps = currentProject.mediaAsset?.fps || 30;
    const frameMs = 1000 / fps;
    const maxDur = durationMs > 0 ? durationMs : 18000;
    setCurrentTimeMs(forward ? Math.min(maxDur, currentTimeMs + frameMs) : Math.max(0, currentTimeMs - frameMs));
  };

  const renderVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="h-3.5 w-3.5 text-neutral-400" />;
    if (volume < 0.5) return <Volume1 className="h-3.5 w-3.5 text-emerald-400" />;
    return <Volume2 className="h-3.5 w-3.5 text-emerald-400" />;
  };

  const currentMedia = currentProject.mediaAsset;

  return (
    <main className="flex h-full flex-1 flex-col bg-[#08090d] text-neutral-300 overflow-hidden select-none">
      {/* Top Controls Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#1b212c] bg-[#0c0f14] px-3 text-xs">
        {/* Left: Aspect Ratio Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400">Ratio:</span>
          {(['9:16', '16:9', '1:1', '4:5'] as AspectRatio[]).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setAspectRatio(ratio)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all',
                aspectRatio === ratio
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-neutral-400 hover:bg-[#161a23] hover:text-neutral-200'
              )}
            >
              {ratio}
            </button>
          ))}

          {/* Video Metadata Chip if loaded */}
          {currentMedia && (
            <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-[#1f2633] text-[10px] text-neutral-400 font-mono">
              <span className="text-neutral-200">{currentMedia.width}×{currentMedia.height}</span>
              <span>•</span>
              <span className="uppercase text-emerald-400">{currentMedia.videoCodec || 'MP4'}</span>
              <span>•</span>
              <span>{currentMedia.fps} fps</span>
            </div>
          )}
        </div>

        {/* Right: Safe Margins, Replace Video, Zoom */}
        <div className="flex items-center gap-2">
          {/* Warning Banner Badge if needed */}
          {mediaWarning && (
            <div className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20" title={mediaWarning}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="max-w-[140px] truncate">{mediaWarning}</span>
            </div>
          )}

          {/* Safe Margins Toggle */}
          <button
            type="button"
            onClick={toggleSafeMargins}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border transition-colors',
              showSafeMargins
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-[#212735] text-neutral-400 hover:bg-[#161b24]'
            )}
            title="Toggle TikTok / Reels Safe Margins Overlay"
          >
            {showSafeMargins ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            <span>Safe Margins</span>
          </button>

          {/* Replace Video Button (When video is loaded) */}
          {currentMedia && (
            <>
              <button
                type="button"
                onClick={handleBrowseVideo}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border border-[#273245] bg-[#141924] text-neutral-300 hover:text-neutral-100 hover:bg-[#1b2230] transition-colors"
                title="Replace current video with another file"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Replace</span>
              </button>

              <button
                type="button"
                onClick={() => setTranscriptionModalOpen(true)}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors shadow-sm"
                title="Generate subtitles and captions with Groq Whisper"
              >
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span>Transcribe</span>
              </button>
            </>
          )}

          {/* Zoom Selector */}
          <div className="flex items-center gap-1 border-l border-[#1b212c] pl-2 text-[10px] text-neutral-400">
            <span>Zoom:</span>
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              className="rounded border border-[#212836] bg-[#12161f] px-1 py-0.5 text-[10px] text-neutral-200 focus:outline-none"
            >
              <option value="1">Fit (100%)</option>
              <option value="0.75">75%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Center Canvas Viewport */}
      <div className="relative flex flex-1 items-center justify-center p-4 overflow-hidden">
        {/* Hidden File Picker Fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/*,audio/*"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {mediaLoading ? (
          // Loading State
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#222a38] bg-[#0e1219]/80 p-8 shadow-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
            <h4 className="text-sm font-semibold text-neutral-100">Probing Video File...</h4>
            <p className="mt-1 text-xs text-neutral-400">Inspecting video streams, duration, and aspect ratio</p>
          </div>
        ) : currentMedia ? (
          // Active Video Player with Aspect Ratio Preservation
          <div style={{ transform: `scale(${zoomLevel})` }} className="flex h-full w-full items-center justify-center transition-transform">
            <VideoPlayer mediaAsset={currentMedia} onReplaceVideo={handleBrowseVideo} />
          </div>
        ) : (
          // Clear Import-Video Empty State
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsHoverDrop(true);
            }}
            onDragLeave={() => setIsHoverDrop(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsHoverDrop(false);
              const file = e.dataTransfer.files[0];
              if (file) {
                void processSelectedFile(file);
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center transition-all max-w-md w-full',
              isHoverDrop
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-[#222a38] bg-[#0e1219]/70 hover:border-[#354257] hover:bg-[#111620]'
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#171c26] text-emerald-400 border border-[#273041] mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>

            <h3 className="text-sm font-semibold text-neutral-100">No Video Imported</h3>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed max-w-xs">
              Select or drop a raw video to start playback, verify aspect framing, and preview synced captions.
            </p>

            <button
              type="button"
              onClick={handleBrowseVideo}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors"
            >
              <HardDrive className="h-3.5 w-3.5" />
              <span>Import Video</span>
            </button>

            <div className="mt-4 text-[10px] text-neutral-400">
              Supports MP4, MOV, WebM, MKV • 100% on-device local streaming
            </div>
          </div>
        )}
      </div>

      {/* Bottom Transport Controls Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-t border-[#1b212c] bg-[#0c0f14] px-4 text-xs">
        {/* Left: Timecode readout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded bg-[#131720] px-2.5 py-1 font-mono text-xs font-bold text-emerald-400 border border-[#212836]">
            <span>{formatTimecode(currentTimeMs)}</span>
          </div>

          <div className="text-[11px] text-neutral-400 font-mono">
            / <span>{formatTimecode(durationMs > 0 ? durationMs : 18000)}</span>
          </div>
        </div>

        {/* Center: Playback Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleStepFrame(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-[#181d27] hover:text-neutral-200"
            title="Step Back 1 Frame (Left Arrow)"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!currentMedia}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-white shadow transition-colors',
              currentMedia
                ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'
                : 'bg-[#1b212d] text-neutral-500 cursor-not-allowed opacity-50'
            )}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => handleStepFrame(true)}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-[#181d27] hover:text-neutral-200"
            title="Step Forward 1 Frame (Right Arrow)"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right: Volume & Playback Speed */}
        <div className="flex items-center gap-3">
          {/* Volume Control */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={toggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
              className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-[#181d27] hover:text-neutral-200"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {renderVolumeIcon()}
            </button>

            {/* Volume Slider Popover */}
            {showVolumeSlider && (
              <div
                onMouseLeave={() => setShowVolumeSlider(false)}
                className="absolute bottom-8 -left-6 z-40 flex items-center gap-2 rounded-lg border border-[#273245] bg-[#121620] px-3 py-2 shadow-xl"
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="h-1.5 w-20 accent-emerald-500 cursor-pointer"
                />
                <span className="font-mono text-[10px] text-neutral-300 w-7 text-right">
                  {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                </span>
              </div>
            )}
          </div>

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="rounded border border-[#212836] bg-[#12161f] px-1.5 py-0.5 text-[11px] text-neutral-300 focus:outline-none"
          >
            <option value="0.5">0.5×</option>
            <option value="1">1.0×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2.0×</option>
          </select>
        </div>
      </div>
    </main>
  );
};
