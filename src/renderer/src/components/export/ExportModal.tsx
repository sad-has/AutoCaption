import React, { useState } from 'react';
import {
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  FileText,
  Video,
  Film,
  Sparkles,
  Sliders,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getAnimationExportSupport } from '../../../../shared/export/subtitles';
import type { ExportQuality, ExportResolution } from '../../../../shared/types';
import { exportToSrt, exportToWebVtt } from '../../../../shared/export/subtitles';

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    setExportModalOpen,
    currentProject,
    globalAnimation,
    isExporting,
    activeExportJob,
    exportError,
    clearExportError,
    startVideoExport,
    cancelVideoExport,
    downloadSubtitles,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'video' | 'subtitles'>('video');
  const [resolution, setResolution] = useState<ExportResolution>('original');
  const [quality, setQuality] = useState<ExportQuality>('standard');
  const [burnInCaptions, setBurnInCaptions] = useState(true);
  const [subtitlesCopied, setSubtitlesCopied] = useState<'srt' | 'vtt' | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isExportModalOpen) return null;

  const media = currentProject.mediaAsset;
  const segments = currentProject.captionSegments || [];
  const animSupport = getAnimationExportSupport(globalAnimation.preset);

  const handleStartVideoExport = async () => {
    clearExportError();
    setSavedPath(null);
    await startVideoExport({
      resolution,
      quality,
      burnInCaptions,
    });
  };

  const handleCancelExport = () => {
    if (activeExportJob?.jobId) {
      cancelVideoExport(activeExportJob.jobId);
    }
  };

  const handleSaveVideo = async () => {
    if (!activeExportJob?.outputPath) return;
    const suggestedName = `${currentProject.name || 'exported_video'}.mp4`;
    setIsSaving(true);
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveExportedVideo) {
        const res = await window.electronAPI.saveExportedVideo(activeExportJob.outputPath, suggestedName);
        if (res.success && !res.canceled && res.savedPath) {
          setSavedPath(res.savedPath);
        }
      } else {
        const a = document.createElement('a');
        a.href = activeExportJob.downloadUrl || `/api/dev/export/download?jobId=${activeExportJob.jobId}`;
        a.download = suggestedName;
        a.click();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowInFolder = () => {
    const target = savedPath || activeExportJob?.outputPath;
    if (target && typeof window !== 'undefined' && window.electronAPI?.showItemInFolder) {
      window.electronAPI.showItemInFolder(target);
    }
  };

  const handleCopySubtitles = async (format: 'srt' | 'vtt') => {
    const text = format === 'srt'
      ? exportToSrt(segments)
      : exportToWebVtt(segments, currentProject.name);
    await navigator.clipboard.writeText(text);
    setSubtitlesCopied(format);
    setTimeout(() => setSubtitlesCopied(null), 2000);
  };

  // Preview snippet for Subtitle Tab
  const sampleSrt = segments.length > 0
    ? exportToSrt(segments.slice(0, 2)).trim()
    : '1\n00:00:00,000 --> 00:00:02,000\nNo captions created yet.';

  const isCompleted = activeExportJob?.status === 'completed';
  const isFailed = activeExportJob?.status === 'failed';
  const progressPercent = activeExportJob?.progress ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-xl border border-[#262d3d] bg-[#0f1218] text-neutral-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2633] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">Export Project</h2>
              <p className="text-xs text-neutral-400">
                Render burned-in MP4 video or export production subtitle tracks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExportModalOpen(false)}
            disabled={isExporting}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-[#1a202c] hover:text-white transition-colors disabled:opacity-40"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1f2633] px-6 bg-[#0b0e14]">
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'video'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Video className="h-4 w-4" />
            <span>Render Video (MP4)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('subtitles')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'subtitles'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Subtitles (SRT / WebVTT)</span>
            <span className="ml-1 rounded-full bg-[#1b2230] px-1.5 py-0.5 text-[10px] text-neutral-400 font-mono">
              {segments.length}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(exportError || isFailed) && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3.5 flex items-start gap-3 text-red-300 text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block text-red-200">Export Encountered an Error</span>
                <span>{exportError || activeExportJob?.error || 'Video rendering failed. Please try again.'}</span>
              </div>
            </div>
          )}

          {activeTab === 'video' ? (
            <>
              {/* Media Status Overview */}
              <div className="flex items-center justify-between rounded-lg border border-[#1f2633] bg-[#141822] p-3 text-xs">
                <div className="flex items-center gap-2 text-neutral-300">
                  <Film className="h-4 w-4 text-amber-400" />
                  <span className="font-medium text-white">{media?.name || currentProject.name || 'Untitled Video'}</span>
                  {media && (
                    <span className="text-neutral-500">
                      ({media.width}x{media.height} • {(media.durationMs / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                <div className="text-neutral-400 font-mono text-[11px]">
                  {segments.length} Captions
                </div>
              </div>

              {!media && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 flex items-center gap-2.5 text-xs text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>No video asset imported. Please import a video file into your project to render MP4.</span>
                </div>
              )}

              {/* In-Progress Progress Card */}
              {isExporting && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-5 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {activeExportJob?.stage || 'Rendering in Progress...'}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          FFmpeg media worker running in background
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-amber-400">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#1b2230]">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(5, progressPercent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-400">
                      Status: <span className="text-neutral-200 capitalize">{activeExportJob?.status || 'Rendering'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelExport}
                      className="rounded border border-red-500/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40 hover:text-red-200 transition-colors"
                    >
                      Cancel Export
                    </button>
                  </div>
                </div>
              )}

              {/* Completed Success Card */}
              {isCompleted && activeExportJob && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-5 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Video Rendered Successfully!</div>
                      <div className="text-xs text-neutral-300">
                        {activeExportJob.fileSizeBytes
                          ? `Size: ${(activeExportJob.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
                          : 'MP4 ready'}
                        {activeExportJob.durationMs
                          ? ` • Duration: ${(activeExportJob.durationMs / 1000).toFixed(1)}s`
                          : ''}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveVideo}
                      disabled={isSaving}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-emerald-400 transition-colors shadow disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      <span>{isSaving ? 'Saving...' : 'Save Video to Computer'}</span>
                    </button>
                    {(activeExportJob.outputPath || savedPath) && (
                      <button
                        type="button"
                        onClick={handleShowInFolder}
                        className="flex items-center gap-1.5 rounded-lg border border-[#2b3547] bg-[#141822] px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-[#1a202c] hover:text-white transition-colors"
                      >
                        <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                        <span>Show in Folder</span>
                      </button>
                    )}
                    {activeExportJob.downloadUrl && !activeExportJob.downloadUrl.startsWith('local-video:') && (
                      <a
                        href={activeExportJob.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-[#2b3547] bg-[#141822] px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-[#1a202c] hover:text-white transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Stream</span>
                      </a>
                    )}
                  </div>
                  {savedPath && (
                    <div className="pt-1 text-[11px] text-emerald-400 font-mono break-all">
                      Saved to: {savedPath}
                    </div>
                  )}
                </div>
              )}

              {/* Rendering Settings Form (Available when not exporting) */}
              {!isExporting && (
                <div className="space-y-5">
                  {/* Resolution Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-amber-400" />
                      <span>Output Resolution</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'original', label: 'Match Source', desc: 'Preserves native resolution' },
                        { id: '1080p', label: '1080p Full HD', desc: 'Optimal for TikTok & Reels' },
                        { id: '720p', label: '720p HD', desc: 'Smaller file & faster share' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setResolution(item.id as ExportResolution)}
                          className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                            resolution === item.id
                              ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                              : 'border-[#1f2633] bg-[#141822] text-neutral-400 hover:border-[#2f394d] hover:text-neutral-200'
                          }`}
                        >
                          <span className="text-xs font-medium text-neutral-200">{item.label}</span>
                          <span className="text-[10px] text-neutral-500 mt-0.5">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Encoding Quality & Speed</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'draft', label: 'Draft', desc: 'CRF 28 • Ultrafast render' },
                        { id: 'standard', label: 'Standard (Rec.)', desc: 'CRF 22 • 192k audio • Balanced' },
                        { id: 'high', label: 'High Quality', desc: 'CRF 18 • 256k audio • Crisp' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setQuality(item.id as ExportQuality)}
                          className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                            quality === item.id
                              ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                              : 'border-[#1f2633] bg-[#141822] text-neutral-400 hover:border-[#2f394d] hover:text-neutral-200'
                          }`}
                        >
                          <span className="text-xs font-medium text-neutral-200">{item.label}</span>
                          <span className="text-[10px] text-neutral-500 mt-0.5">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Burn-in Option */}
                  <div className="flex items-center justify-between rounded-lg border border-[#1f2633] bg-[#141822] p-3.5">
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-white">Burn-in Captions</div>
                      <div className="text-[11px] text-neutral-400">
                        Hardcode styled typography and animations directly into the MP4 video stream.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={burnInCaptions}
                        onChange={(e) => setBurnInCaptions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#252d3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>

                  {/* Animation Compatibility Notice */}
                  <div className="rounded-lg border border-[#1f2633] bg-[#121620] p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Current Animation Preset:</span>
                      <span className="font-semibold text-neutral-200 capitalize">
                        {globalAnimation.preset}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[11px]">
                      {animSupport.isFullySupported ? (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span>{animSupport.description}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{animSupport.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Subtitle Export Tab */
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-2 gap-4">
                {/* SRT Card */}
                <div className="flex flex-col justify-between rounded-xl border border-[#1f2633] bg-[#141822] p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-xs">
                        SRT
                      </div>
                      <span className="rounded bg-[#1b2230] px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                        Universal
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">SubRip Subtitle (.srt)</h3>
                    <p className="text-xs text-neutral-400">
                      Standard industry timestamped subtitle format. Supported by Premiere Pro, DaVinci Resolve, Final Cut Pro, and VLC.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => void downloadSubtitles('srt')}
                      disabled={segments.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download .SRT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopySubtitles('srt')}
                      className="rounded-lg border border-[#273245] bg-[#10131a] px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#19202c] transition-colors"
                      title="Copy SRT Content"
                    >
                      {subtitlesCopied === 'srt' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* WebVTT Card */}
                <div className="flex flex-col justify-between rounded-xl border border-[#1f2633] bg-[#141822] p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold text-xs">
                        VTT
                      </div>
                      <span className="rounded bg-[#1b2230] px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                        HTML5 Web
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">WebVTT Subtitle (.vtt)</h3>
                    <p className="text-xs text-neutral-400">
                      Standard format for web video players, HTML5 video tracks, YouTube, Vimeo, and modern browser streaming.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => void downloadSubtitles('vtt')}
                      disabled={segments.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download .VTT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopySubtitles('vtt')}
                      className="rounded-lg border border-[#273245] bg-[#10131a] px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#19202c] transition-colors"
                      title="Copy WebVTT Content"
                    >
                      {subtitlesCopied === 'vtt' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subtitle Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-300">Edited Subtitle Preview</span>
                  <span className="text-[11px] text-neutral-500">Reflects current edited text & timings</span>
                </div>
                <div className="rounded-lg border border-[#1f2633] bg-[#0c0f15] p-3.5 font-mono text-xs text-neutral-300 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap select-all">
                  {sampleSrt}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#1f2633] px-6 py-4 bg-[#0c0f14]">
          <div className="text-xs text-neutral-500">
            {activeTab === 'video'
              ? 'Output files are safely stored in temporary cache and Supabase private storage.'
              : `${segments.length} segments will be exported with zero loss.`}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setExportModalOpen(false)}
              disabled={isExporting}
              className="rounded-lg border border-[#242b3b] bg-[#141822] px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-[#1a202c] hover:text-white transition-colors disabled:opacity-40"
            >
              Close
            </button>

            {activeTab === 'video' && !isExporting && (
              <button
                type="button"
                onClick={handleStartVideoExport}
                disabled={!media}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-amber-400 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Start Video Render</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
