import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  List,
  Clock,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Volume2,
  Video,
  Subtitles,
  Scissors,
  Merge,
  Magnet,
  Type,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatTimecode, formatShortTime } from '../../utils/timecode';
import { cn } from '../../utils/cn';
import { findSnapTargets } from '../../../../shared/captionEditor';
import { TimelineRuler } from '../timeline/TimelineRuler';
import { CaptionBlock } from '../timeline/CaptionBlock';
import { CaptionListEditor } from '../timeline/CaptionListEditor';

export const BottomTimeline: React.FC = () => {
  const {
    bottomPanelTab,
    setBottomPanelTab,
    currentProject,
    currentTimeMs,
    setCurrentTimeMs,
    durationMs,
    selectedSegmentId,
    setSelectedSegmentId,
    adjustSegmentTimes,
    splitSegment,
    mergeWithNext,
    deleteSegment,
    addSegment,
    zoomLevel,
    setZoomLevel,
    setIsScrubbing,
    isSnappingEnabled,
    setIsSnappingEnabled,
    showWordBlocks,
    setShowWordBlocks,
    getOverlappingSegmentIds,
  } = useAppStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(1000);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Measure timeline track container width
  useEffect(() => {
    const updateWidth = () => {
      if (trackContainerRef.current) {
        setContainerWidthPx(trackContainerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [zoomLevel]);

  const totalDurationMs = durationMs > 0 ? durationMs : 18000;
  const overlappingIds = getOverlappingSegmentIds();

  // Calculate snap targets for drag operations (playhead + edges of all other segments)
  const snapTargets = useMemo(() => {
    return findSnapTargets(
      currentProject.captionSegments,
      selectedSegmentId,
      currentTimeMs
    );
  }, [currentProject.captionSegments, selectedSegmentId, currentTimeMs]);

  // Compute effective timeline content width based on zoom level
  const timelineContentWidthPct = Math.max(100, Math.round(zoomLevel * 100));

  // Time conversion from clientX
  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackContainerRef.current) return 0;
      const rect = trackContainerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, clickX / rect.width));
      return Math.round(percent * totalDurationMs);
    },
    [totalDurationMs]
  );

  // Playhead dragging & scrubbing
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);
    setIsScrubbing(true);
    const newTime = getTimeFromEvent(e.clientX);
    setCurrentTimeMs(newTime);
  };

  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newTime = getTimeFromEvent(e.clientX);
      setCurrentTimeMs(newTime);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setIsScrubbing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, getTimeFromEvent, setCurrentTimeMs, setIsScrubbing]);

  const playheadPercent = Math.min(100, Math.max(0, (currentTimeMs / totalDurationMs) * 100));

  // Split selected caption at current playhead
  const handleSplitAtPlayhead = () => {
    if (!selectedSegmentId) return;
    splitSegment(selectedSegmentId, { splitTimeMs: currentTimeMs });
  };

  // Merge selected with next
  const handleMergeNext = () => {
    if (!selectedSegmentId) return;
    mergeWithNext(selectedSegmentId);
  };

  return (
    <section className="flex h-full flex-col border-t border-[#1f2633] bg-[#0c0f14] text-xs text-neutral-300 overflow-hidden select-none">
      {/* Top Controls Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#1b212c] bg-[#090b10] px-3">
        {/* Left: View Switcher (Timeline vs Caption List) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBottomPanelTab('timeline')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors',
              bottomPanelTab === 'timeline'
                ? 'bg-[#181d28] text-emerald-400 border border-[#273245]'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Interactive Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => setBottomPanelTab('segments')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors',
              bottomPanelTab === 'segments'
                ? 'bg-[#181d28] text-emerald-400 border border-[#273245]'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            <List className="h-3.5 w-3.5" />
            <span>Caption Editor ({currentProject.captionSegments.length})</span>
          </button>
        </div>

        {/* Center: Selected Segment Quick Editing Actions */}
        <div className="flex items-center gap-1">
          {/* Add Subtitle at playhead */}
          <button
            type="button"
            onClick={() => addSegment(currentTimeMs)}
            className="flex items-center gap-1 rounded bg-[#131b26] border border-emerald-500/30 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-[#182333] transition-colors"
            title="Add new subtitle at current playhead position"
          >
            <Plus className="h-3 w-3" />
            <span>Add Subtitle</span>
          </button>

          {/* Split at Playhead */}
          <button
            type="button"
            onClick={handleSplitAtPlayhead}
            disabled={!selectedSegmentId}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-neutral-300 hover:bg-[#171c26] hover:text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Split selected caption at playhead (S)"
          >
            <Scissors className="h-3 w-3 text-amber-400" />
            <span>Split</span>
          </button>

          {/* Merge with Next */}
          <button
            type="button"
            onClick={handleMergeNext}
            disabled={!selectedSegmentId}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-neutral-300 hover:bg-[#171c26] hover:text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Merge selected caption with next"
          >
            <Merge className="h-3 w-3 text-emerald-400" />
            <span>Merge</span>
          </button>

          {/* Delete Segment */}
          {selectedSegmentId && (
            <button
              type="button"
              onClick={() => deleteSegment(selectedSegmentId)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              title="Delete selected caption (Del)"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          {/* Magnet Snapping Toggle */}
          <button
            type="button"
            onClick={() => setIsSnappingEnabled(!isSnappingEnabled)}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ml-1',
              isSnappingEnabled
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
            title={isSnappingEnabled ? 'Snapping to playhead and adjacent captions active' : 'Snapping disabled'}
          >
            <Magnet className="h-3 w-3" />
            <span className="hidden sm:inline">Snap</span>
          </button>

          {/* Word Blocks Toggle */}
          <button
            type="button"
            onClick={() => setShowWordBlocks(!showWordBlocks)}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
              showWordBlocks
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
            title="Show micro word blocks within captions"
          >
            <Type className="h-3 w-3" />
            <span className="hidden sm:inline">Words</span>
          </button>
        </div>

        {/* Right: Zoom & Timecode Display */}
        <div className="flex items-center gap-2">
          {/* Current Playhead Timecode */}
          <div className="font-mono text-[11px] text-emerald-400 font-semibold px-1 hidden sm:block">
            {formatTimecode(currentTimeMs)}
          </div>

          <div className="flex items-center gap-1 border-l border-[#1b212c] pl-2">
            <button
              type="button"
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="rounded p-1 text-neutral-400 hover:bg-[#161a23] hover:text-neutral-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[10px] text-neutral-400 w-9 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
              className="rounded p-1 text-neutral-400 hover:bg-[#161a23] hover:text-neutral-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="rounded p-1 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono ml-0.5"
              title="Reset Zoom to 100%"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {bottomPanelTab === 'timeline' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Track Headers (V1, C1, A1) */}
          <div className="flex w-24 shrink-0 flex-col border-r border-[#1b212c] bg-[#0e1219] text-[10px] font-semibold text-neutral-400 select-none z-30">
            {/* Header ruler placeholder */}
            <div className="h-6 border-b border-[#1b212c] bg-[#0b0e14] px-2 flex items-center justify-between">
              <span>TRACKS</span>
              <span className="font-mono text-[9px] text-neutral-500">{zoomLevel}x</span>
            </div>

            {/* V1 Video Track Header */}
            <div className="flex h-11 items-center justify-between border-b border-[#1b212c] px-2 bg-[#12161f]">
              <div className="flex items-center gap-1 text-neutral-300">
                <Video className="h-3.5 w-3.5 text-emerald-400" />
                <span>V1</span>
              </div>
              <span className="text-[9px] text-neutral-500">Video</span>
            </div>

            {/* C1 Caption Track Header */}
            <div className="flex h-14 items-center justify-between border-b border-[#1b212c] px-2 bg-[#12161f]">
              <div className="flex items-center gap-1 text-neutral-300">
                <Subtitles className="h-3.5 w-3.5 text-amber-400" />
                <span>C1</span>
              </div>
              <span className="text-[9px] font-mono text-amber-400/90 font-bold">
                {currentProject.captionSegments.length}
              </span>
            </div>

            {/* A1 Audio Track Header */}
            <div className="flex h-11 items-center justify-between px-2 bg-[#12161f]">
              <div className="flex items-center gap-1 text-neutral-300">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>A1</span>
              </div>
              <span className="text-[9px] text-neutral-500">Audio</span>
            </div>
          </div>

          {/* Right: Scrollable Timeline Canvas */}
          <div
            ref={scrollContainerRef}
            className="relative flex-1 overflow-x-auto overflow-y-hidden bg-[#090b10]"
          >
            {/* Inner Content that scales with zoom */}
            <div
              ref={trackContainerRef}
              style={{ width: `${timelineContentWidthPct}%` }}
              className="relative min-w-full h-full flex flex-col"
            >
              {/* Interactive Draggable Playhead */}
              <div
                style={{ left: `${playheadPercent}%` }}
                className="pointer-events-none absolute bottom-0 top-0 z-40 flex flex-col items-center -translate-x-1/2"
              >
                {/* Playhead Handle */}
                <div
                  onMouseDown={handlePlayheadMouseDown}
                  className="pointer-events-auto flex flex-col items-center cursor-ew-resize group"
                >
                  <div className="h-3.5 w-3.5 rotate-45 bg-amber-400 border border-black shadow-[0_0_8px_#f59e0b] -translate-y-1 group-hover:scale-110 transition-transform" />
                </div>
                {/* Needle Line */}
                <div className="w-[1.5px] flex-1 bg-amber-400 shadow-[0_0_4px_#f59e0b]" />
              </div>

              {/* Time Ruler */}
              <TimelineRuler
                totalDurationMs={totalDurationMs}
                zoomLevel={zoomLevel}
                timelineWidthPx={containerWidthPx}
                currentTimeMs={currentTimeMs}
                onSeek={setCurrentTimeMs}
                onScrubStart={() => setIsScrubbing(true)}
                onScrubEnd={() => setIsScrubbing(false)}
              />

              {/* Track V1: Video Clip Area */}
              <div className="relative h-11 border-b border-[#181e2b] bg-[#0c0f15] p-1">
                <div className="h-full w-full rounded bg-emerald-950/40 border border-emerald-600/30 px-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-mono font-medium text-emerald-300 truncate">
                      {currentProject.mediaAsset?.name || 'Local Video Clip'}
                    </span>
                    {currentProject.mediaAsset && (
                      <span className="rounded bg-emerald-500/20 px-1 text-[8px] font-mono text-emerald-400">
                        {currentProject.mediaAsset.width}x{currentProject.mediaAsset.height}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-emerald-400/80 font-mono shrink-0">
                    {formatShortTime(totalDurationMs)}
                  </span>
                </div>
              </div>

              {/* Track C1: Interactive Caption Blocks */}
              <div
                onClick={() => setSelectedSegmentId(null)}
                className="relative h-14 border-b border-[#181e2b] bg-[#0b0e14] p-1"
              >
                {currentProject.captionSegments.map((seg) => {
                  const isSelected = selectedSegmentId === seg.id;
                  const isOverlapping = overlappingIds.has(seg.id);

                  return (
                    <CaptionBlock
                      key={seg.id}
                      segment={seg}
                      totalDurationMs={totalDurationMs}
                      timelineWidthPx={containerWidthPx}
                      isSelected={isSelected}
                      isOverlapping={isOverlapping}
                      showWordBlocks={showWordBlocks}
                      isSnappingEnabled={isSnappingEnabled}
                      snapTargets={snapTargets}
                      onSelect={() => setSelectedSegmentId(seg.id)}
                      onSeek={setCurrentTimeMs}
                      onAdjustTimes={adjustSegmentTimes}
                    />
                  );
                })}
              </div>

              {/* Track A1: Audio Waveform Simulation */}
              <div className="relative h-11 bg-[#090b10] p-1 flex items-center">
                <div className="flex h-full w-full items-center gap-0.5 px-2 rounded bg-emerald-950/20 border border-emerald-900/20 overflow-hidden">
                  {Array.from({ length: 120 }).map((_, i) => {
                    const h = 18 + Math.sin(i * 0.35) * 14 + Math.cos(i * 0.8) * 10;
                    return (
                      <div
                        key={i}
                        style={{ height: `${Math.max(5, Math.min(h, 30))}px` }}
                        className="w-[2px] shrink-0 rounded-full bg-emerald-500/40"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Caption List Editor */
        <CaptionListEditor />
      )}
    </section>
  );
};
