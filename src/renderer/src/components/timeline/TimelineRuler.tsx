import React, { useCallback, useRef } from 'react';
import { formatShortTime } from '../../utils/timecode';

interface TimelineRulerProps {
  totalDurationMs: number;
  zoomLevel: number;
  timelineWidthPx: number;
  currentTimeMs: number;
  onSeek: (ms: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  totalDurationMs,
  timelineWidthPx,
  onSeek,
  onScrubStart,
  onScrubEnd,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);

  const calculateTimeFromClientX = useCallback(
    (clientX: number): number => {
      if (!rulerRef.current) return 0;
      const rect = rulerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, clickX / rect.width));
      return Math.round(percent * totalDurationMs);
    },
    [totalDurationMs]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onScrubStart?.();
    const newTime = calculateTimeFromClientX(e.clientX);
    onSeek(newTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const time = calculateTimeFromClientX(moveEvent.clientX);
      onSeek(time);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onScrubEnd?.();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Determine tick density based on width in pixels
  const totalSeconds = Math.ceil(totalDurationMs / 1000);
  const pxPerSecond = timelineWidthPx > 0 ? timelineWidthPx / totalSeconds : 20;

  let tickStepSec = 1;
  if (pxPerSecond < 15) tickStepSec = 10;
  else if (pxPerSecond < 35) tickStepSec = 5;
  else if (pxPerSecond < 70) tickStepSec = 2;
  else tickStepSec = 1;

  const tickCount = Math.floor(totalSeconds / tickStepSec) + 1;

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      className="relative flex h-6 w-full cursor-pointer select-none border-b border-[#1b212c] bg-[#0d1017] overflow-hidden"
    >
      {Array.from({ length: tickCount }).map((_, i) => {
        const sec = i * tickStepSec;
        const leftPct = ((sec * 1000) / totalDurationMs) * 100;
        if (leftPct > 100) return null;

        return (
          <div
            key={sec}
            style={{ left: `${leftPct}%` }}
            className="absolute top-0 bottom-0 flex flex-col justify-between pl-1 border-l border-[#222a3a]"
          >
            <span className="font-mono text-[9px] text-neutral-400 leading-none pt-1">
              {formatShortTime(sec * 1000)}
            </span>
            <div className="h-1.5 w-[1px] bg-neutral-600" />
          </div>
        );
      })}
    </div>
  );
};
