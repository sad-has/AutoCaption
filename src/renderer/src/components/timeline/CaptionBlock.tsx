import React, { useRef, useState, useCallback } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import type { CaptionSegment, CaptionWord } from '../../../../shared/types';
import { calculateSnapping } from '../../../../shared/captionEditor';
import { formatTimecode } from '../../utils/timecode';
import { cn } from '../../utils/cn';

interface CaptionBlockProps {
  segment: CaptionSegment;
  totalDurationMs: number;
  timelineWidthPx: number;
  isSelected: boolean;
  isOverlapping: boolean;
  showWordBlocks: boolean;
  isSnappingEnabled: boolean;
  snapTargets: number[];
  onSelect: () => void;
  onSeek: (ms: number) => void;
  onAdjustTimes: (id: string, startMs: number, endMs: number) => void;
  onWordClick?: (word: CaptionWord) => void;
}

export const CaptionBlock: React.FC<CaptionBlockProps> = ({
  segment,
  totalDurationMs,
  timelineWidthPx,
  isSelected,
  isOverlapping,
  showWordBlocks,
  isSnappingEnabled,
  snapTargets,
  onSelect,
  onSeek,
  onAdjustTimes,
  onWordClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [_dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);

  // Temporary drag positions for instant 60fps rendering without store lag
  const [tempTimes, setTempTimes] = useState<{ startMs: number; endMs: number } | null>(null);

  const activeStart = tempTimes ? tempTimes.startMs : segment.startMs;
  const activeEnd = tempTimes ? tempTimes.endMs : segment.endMs;
  const duration = Math.max(100, activeEnd - activeStart);

  const leftPct = (activeStart / totalDurationMs) * 100;
  const widthPct = Math.max(0.8, (duration / totalDurationMs) * 100);

  const dragStartRef = useRef<{
    startX: number;
    initialStartMs: number;
    initialEndMs: number;
  }>({ startX: 0, initialStartMs: 0, initialEndMs: 0 });

  const startDrag = useCallback(
    (e: React.MouseEvent, mode: 'move' | 'resize-left' | 'resize-right') => {
      e.preventDefault();
      e.stopPropagation();

      onSelect();
      setIsDragging(true);
      setDragMode(mode);

      dragStartRef.current = {
        startX: e.clientX,
        initialStartMs: segment.startMs,
        initialEndMs: segment.endMs,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - dragStartRef.current.startX;
        const width = timelineWidthPx > 0 ? timelineWidthPx : 1000;
        const deltaMs = Math.round((deltaX / width) * totalDurationMs);

        const initStart = dragStartRef.current.initialStartMs;
        const initEnd = dragStartRef.current.initialEndMs;
        const segDuration = initEnd - initStart;

        if (mode === 'move') {
          let targetStart = initStart + deltaMs;
          let targetEnd = targetStart + segDuration;

          // Snapping
          if (isSnappingEnabled) {
            const snapStart = calculateSnapping(targetStart, snapTargets);
            if (snapStart.snapped) {
              targetStart = snapStart.timeMs;
              targetEnd = targetStart + segDuration;
            } else {
              const snapEnd = calculateSnapping(targetEnd, snapTargets);
              if (snapEnd.snapped) {
                targetEnd = snapEnd.timeMs;
                targetStart = targetEnd - segDuration;
              }
            }
          }

          // Bounds check
          if (targetStart < 0) {
            targetStart = 0;
            targetEnd = segDuration;
          }
          if (targetEnd > totalDurationMs) {
            targetEnd = totalDurationMs;
            targetStart = Math.max(0, targetEnd - segDuration);
          }

          setTempTimes({ startMs: targetStart, endMs: targetEnd });
        } else if (mode === 'resize-left') {
          let targetStart = initStart + deltaMs;
          if (isSnappingEnabled) {
            const snap = calculateSnapping(targetStart, snapTargets);
            if (snap.snapped) targetStart = snap.timeMs;
          }
          targetStart = Math.max(0, Math.min(initEnd - 100, targetStart));
          setTempTimes({ startMs: targetStart, endMs: initEnd });
        } else if (mode === 'resize-right') {
          let targetEnd = initEnd + deltaMs;
          if (isSnappingEnabled) {
            const snap = calculateSnapping(targetEnd, snapTargets);
            if (snap.snapped) targetEnd = snap.timeMs;
          }
          targetEnd = Math.max(initStart + 100, Math.min(totalDurationMs, targetEnd));
          setTempTimes({ startMs: initStart, endMs: targetEnd });
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        setIsDragging(false);
        setDragMode(null);

        setTempTimes((finalTimes) => {
          if (finalTimes) {
            onAdjustTimes(segment.id, finalTimes.startMs, finalTimes.endMs);
          }
          return null;
        });
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [
      segment.id,
      segment.startMs,
      segment.endMs,
      timelineWidthPx,
      totalDurationMs,
      isSnappingEnabled,
      snapTargets,
      onSelect,
      onAdjustTimes,
    ]
  );

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        onSeek(segment.startMs);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
      }}
      className={cn(
        'group absolute top-1 bottom-1 flex items-center overflow-hidden rounded select-none cursor-pointer transition-all',
        isSelected
          ? 'border-2 border-amber-400 bg-amber-500/30 z-20 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
          : isOverlapping
          ? 'border border-red-500/70 bg-red-950/40 hover:bg-red-950/60 z-10'
          : 'border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 z-10'
      )}
    >
      {/* Left Resize Handle */}
      <div
        onMouseDown={(e) => startDrag(e, 'resize-left')}
        title="Drag to trim start time"
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-400/80 transition-colors z-30"
      >
        <div className="h-full w-[1.5px] bg-amber-400/40 group-hover:bg-amber-400 mx-auto" />
      </div>

      {/* Center Draggable Body */}
      <div
        onMouseDown={(e) => startDrag(e, 'move')}
        className="flex-1 h-full flex flex-col justify-center px-2 min-w-0 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1 min-w-0">
          {isOverlapping && (
            <span title="Unintended overlap with neighboring subtitle" className="shrink-0">
              <AlertCircle className="h-3 w-3 text-red-400" />
            </span>
          )}
          <span className="truncate font-semibold text-[10px] text-amber-200">
            {segment.text}
          </span>
        </div>

        {/* Word-level micro blocks (if enabled and present) */}
        {showWordBlocks && segment.words && segment.words.length > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5 overflow-hidden">
            {segment.words.slice(0, 8).map((w) => (
              <span
                key={w.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(w.startMs);
                  onWordClick?.(w);
                }}
                className="shrink-0 rounded bg-black/40 px-1 text-[8px] font-mono text-amber-300 hover:bg-amber-400 hover:text-black transition-colors"
                title={`${w.text} (${formatTimecode(w.startMs)})`}
              >
                {w.text}
              </span>
            ))}
            {segment.words.length > 8 && (
              <span className="text-[8px] font-mono text-neutral-400 shrink-0">
                +{segment.words.length - 8}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Resize Handle */}
      <div
        onMouseDown={(e) => startDrag(e, 'resize-right')}
        title="Drag to extend end time"
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-400/80 transition-colors z-30"
      >
        <div className="h-full w-[1.5px] bg-amber-400/40 group-hover:bg-amber-400 mx-auto" />
      </div>

      {/* Hover Timecode Tooltip */}
      {(isHovered || isDragging) && (
        <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded bg-[#0a0c10] px-2 py-0.5 text-[9px] font-mono text-amber-300 border border-amber-500/30 shadow-lg whitespace-nowrap">
          <Clock className="h-2.5 w-2.5" />
          <span>
            {formatTimecode(activeStart)} → {formatTimecode(activeEnd)}
          </span>
          <span className="text-neutral-400">({(duration / 1000).toFixed(2)}s)</span>
        </div>
      )}
    </div>
  );
};
