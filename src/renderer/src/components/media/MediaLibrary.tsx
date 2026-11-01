import React, { useState, useRef } from 'react';
import { UploadCloud, FileVideo, HardDrive, Trash2, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { logger } from '../../utils/logger';
import type { MediaAsset } from '@shared/types';
import { formatTimecode } from '../../utils/timecode';

export const MediaLibrary: React.FC = () => {
  const {
    currentProject,
    importMedia,
    removeMedia,
    setMediaLoading,
    setMediaError,
    setMediaWarning,
    setTranscriptionModalOpen,
  } = useAppStore();

  const [isHoveringDropzone, setIsHoveringDropzone] = useState(false);
  const [isOpeningDialog, setIsOpeningDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (fileOrPath: File | string) => {
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
            logger.warn('MediaLibrary', 'Could not get path from webUtils', err);
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
        const inspect = await window.electronAPI.inspectMediaFile(resolvedPath);

        if (!inspect.success || !inspect.metadata) {
          const err = inspect.error || 'Failed to inspect media file.';
          logger.error('MediaLibrary', err);
          setMediaError(err);
          return;
        }

        const meta = inspect.metadata;
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
                logger.info('MediaLibrary', `Uploaded source video to server disk cache: ${data.filePath}`);
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
              logger.warn('MediaLibrary', 'Background dev media upload error', uploadErr);
            });
        }

        if (resolvedPath) {
          void useAppStore.getState().startVideoUpload(resolvedPath);
        }
      } else if (domFile) {
        // Fallback for browser mode or when filesystem path is inaccessible
        logger.info('MediaLibrary', `Using browser object URL for ${domFile.name}`);
        const streamUrl = URL.createObjectURL(domFile);
        const ext = domFile.name.split('.').pop()?.toLowerCase() || '';

        const newAsset: MediaAsset = {
          id: `media-${Date.now()}`,
          name: domFile.name,
          filePath: resolvedPath || domFile.name,
          streamUrl,
          durationMs: 0,
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
                logger.info('MediaLibrary', `Uploaded source video to server disk cache: ${data.filePath}`);
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
              logger.warn('MediaLibrary', 'Background dev media upload error', uploadErr);
            });
        }

        if (resolvedPath) {
          void useAppStore.getState().startVideoUpload(resolvedPath);
        }
      } else {
        setMediaError('Could not determine file path. Please use the Browse Local Files button.');
      }
    } catch (err) {
      logger.error('MediaLibrary', 'Failed to inspect media', err);
      setMediaError(err instanceof Error ? err.message : 'Failed to inspect media');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleBrowseFiles = async () => {
    setIsOpeningDialog(true);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.openFileDialog({
          title: 'Select Video File',
          filters: [
            { name: 'Video & Audio Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'm4a'] },
            { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'mkv'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (!result.canceled && result.filePath) {
          await processFile(result.filePath);
          return;
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      logger.error('MediaLibrary', 'Failed to open file picker, triggering fallback input', err);
      fileInputRef.current?.click();
    } finally {
      setIsOpeningDialog(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const media = currentProject.mediaAsset;

  return (
    <div className="flex h-full flex-col p-3 text-xs text-neutral-300 overflow-y-auto">
      {/* Hidden File Picker Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/*,audio/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-neutral-200 tracking-wider uppercase text-[10px]">
          Media Assets
        </span>
        <span className="text-[10px] text-neutral-400">Direct Local Stream</span>
      </div>

      {media ? (
        // Active Media Card with Real Video Specs
        <div className="flex flex-col gap-2 rounded-lg border border-[#262f3f] bg-[#141822] p-3 shadow-inner">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FileVideo className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <div className="font-medium text-neutral-100 truncate max-w-[150px]" title={media.name}>
                  {media.name}
                </div>
                <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5 font-mono">
                  <span>{formatFileSize(media.sizeBytes)}</span>
                  <span>•</span>
                  <span>{formatTimecode(media.durationMs)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleBrowseFiles}
                className="rounded p-1 text-neutral-400 hover:bg-[#1d2535] hover:text-neutral-200 transition-colors"
                title="Replace with another video"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={removeMedia}
                className="rounded p-1 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                title="Remove video"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Technical Specs Breakdown */}
          <div className="mt-1 grid grid-cols-2 gap-1.5 rounded border border-[#212836] bg-[#0d0f14] p-2 text-[10px] font-mono text-neutral-400">
            <div>
              <span className="text-neutral-500">Resolution: </span>
              <span className="text-neutral-200">{media.width}×{media.height}</span>
            </div>
            <div>
              <span className="text-neutral-500">Aspect: </span>
              <span className="text-emerald-400">{media.aspectRatio}</span>
            </div>
            <div>
              <span className="text-neutral-500">Codec: </span>
              <span className="text-neutral-200 uppercase">{media.videoCodec || 'N/A'}</span>
            </div>
            <div>
              <span className="text-neutral-500">Frame Rate: </span>
              <span className="text-neutral-200">{media.fps} fps</span>
            </div>
          </div>

          {/* Disk path display */}
          <div className="rounded border border-[#1b212c] bg-[#090b10] p-1.5 text-[9px] font-mono text-neutral-500 truncate" title={media.filePath}>
            {media.filePath}
          </div>

          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Ready for playback & subtitle sync</span>
          </div>

          <button
            type="button"
            onClick={() => setTranscriptionModalOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Transcribe Audio with Groq</span>
          </button>
        </div>
      ) : (
        // Empty State Dropzone
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsHoveringDropzone(true);
          }}
          onDragLeave={() => setIsHoveringDropzone(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsHoveringDropzone(false);
            const file = e.dataTransfer.files[0];
            if (file) {
              void processFile(file);
            }
          }}
          className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all ${
            isHoveringDropzone
              ? 'border-emerald-500 bg-emerald-500/5'
              : 'border-[#273042] bg-[#12161f]/60 hover:border-[#38445d] hover:bg-[#141924]'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1b212d] text-emerald-400 border border-[#293345] mb-3">
            <UploadCloud className="h-5 w-5" />
          </div>
          <span className="font-medium text-neutral-200">Import Video / Audio</span>
          <p className="mt-1 text-[11px] text-neutral-400 max-w-[190px] leading-relaxed">
            Drag & drop raw footage or select a file from local storage.
          </p>

          <button
            type="button"
            disabled={isOpeningDialog}
            onClick={handleBrowseFiles}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>{isOpeningDialog ? 'Selecting...' : 'Browse Local Files'}</span>
          </button>

          <div className="mt-4 flex flex-wrap justify-center gap-1">
            {['MP4', 'MOV', 'MKV', 'WEBM', 'MP3', 'WAV'].map((fmt) => (
              <span
                key={fmt}
                className="rounded bg-[#171c26] px-1.5 py-0.5 text-[9px] font-mono text-neutral-400 border border-[#232a39]"
              >
                .{fmt.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
