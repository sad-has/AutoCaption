import React, { useState } from 'react';
import {
  Trash2,
  Scissors,
  Merge,
  RotateCcw,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatTimecode, parseTimecodeToMs } from '../../utils/timecode';
import { cn } from '../../utils/cn';
import type { CaptionSegment } from '../../../../shared/types';

export const CaptionListEditor: React.FC = () => {
  const {
    currentProject,
    selectedSegmentId,
    setSelectedSegmentId,
    setCurrentTimeMs,
    updateSegmentText,
    adjustSegmentTimes,
    splitSegment,
    mergeWithNext,
    deleteSegment,
    addSegment,
    updateWord,
    revertSegmentToOriginal,
    getOverlappingSegmentIds,
  } = useAppStore();

  const [expandedWordIds, setExpandedWordIds] = useState<Set<string>>(new Set());
  const overlappingIds = getOverlappingSegmentIds();

  const toggleWordsExpanded = (id: string) => {
    setExpandedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTimeBlur = (
    seg: CaptionSegment,
    field: 'start' | 'end',
    val: string
  ) => {
    const parsed = parseTimecodeToMs(val);
    if (field === 'start') {
      adjustSegmentTimes(seg.id, parsed, seg.endMs);
    } else {
      adjustSegmentTimes(seg.id, seg.startMs, parsed);
    }
  };

  const segments = currentProject.captionSegments;

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-400 space-y-3">
        <Clock className="h-8 w-8 text-neutral-500" />
        <h4 className="text-sm font-semibold text-neutral-300">No Captions in Project</h4>
        <p className="text-xs max-w-sm text-neutral-500 leading-relaxed">
          Import a video and click Transcribe to generate AI captions, or manually add your first caption block below.
        </p>
        <button
          type="button"
          onClick={() => addSegment(0, 2000)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add First Caption</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {/* Top Summary Bar */}
      <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 pb-1 border-b border-[#1b2230]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-200">
            {segments.length} Caption{segments.length !== 1 ? 's' : ''}
          </span>
          {overlappingIds.size > 0 && (
            <span className="flex items-center gap-1 rounded bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 text-[10px] text-red-300">
              <AlertCircle className="h-3 w-3 text-red-400" />
              <span>{overlappingIds.size} Overlaps Detected</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => addSegment()}
          className="inline-flex items-center gap-1 rounded bg-[#151c27] border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-400 hover:bg-[#1a2433] transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>New Caption</span>
        </button>
      </div>

      {/* Segments Cards */}
      <div className="space-y-2">
        {segments.map((seg, idx) => {
          const isSelected = selectedSegmentId === seg.id;
          const isOverlapping = overlappingIds.has(seg.id);
          const isWordsExpanded = expandedWordIds.has(seg.id);
          const isEdited = seg.originalText && seg.text !== seg.originalText;
          const hasWords = Boolean(seg.words && seg.words.length > 0);

          return (
            <div
              key={seg.id}
              onClick={() => {
                setSelectedSegmentId(seg.id);
                setCurrentTimeMs(seg.startMs);
              }}
              className={cn(
                'rounded-lg border p-3 transition-all cursor-pointer',
                isSelected
                  ? 'border-amber-400/80 bg-[#161d28] shadow-md ring-1 ring-amber-400/30'
                  : isOverlapping
                  ? 'border-red-500/50 bg-[#140e12] hover:border-red-500/80'
                  : 'border-[#1e2533] bg-[#0f131a] hover:border-[#2b3547]'
              )}
            >
              {/* Card Header: Timecodes, Overlap Alert & Quick Actions */}
              <div className="flex items-center justify-between gap-2 pb-2">
                {/* Timecodes Input */}
                <div
                  className="flex items-center gap-1.5 text-xs font-mono"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-neutral-500">#{idx + 1}</span>
                  <input
                    type="text"
                    defaultValue={formatTimecode(seg.startMs)}
                    key={`${seg.id}-start-${seg.startMs}`}
                    onBlur={(e) => handleTimeBlur(seg, 'start', e.target.value)}
                    className="w-24 rounded border border-[#273245] bg-[#0a0d13] px-1.5 py-0.5 text-center text-[11px] text-emerald-400 focus:border-amber-400 focus:outline-none"
                    title="Start timecode (HH:MM:SS:FF)"
                  />
                  <span className="text-neutral-500">→</span>
                  <input
                    type="text"
                    defaultValue={formatTimecode(seg.endMs)}
                    key={`${seg.id}-end-${seg.endMs}`}
                    onBlur={(e) => handleTimeBlur(seg, 'end', e.target.value)}
                    className="w-24 rounded border border-[#273245] bg-[#0a0d13] px-1.5 py-0.5 text-center text-[11px] text-emerald-400 focus:border-amber-400 focus:outline-none"
                    title="End timecode (HH:MM:SS:FF)"
                  />
                  <span className="text-[10px] text-neutral-500">
                    ({((seg.endMs - seg.startMs) / 1000).toFixed(2)}s)
                  </span>
                </div>

                {/* Badges & Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {seg.animation && (
                    <span className="flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] text-amber-300 font-medium" title="Per-caption animation override">
                      <Zap className="h-2.5 w-2.5 text-amber-400" />
                      <span className="uppercase">{seg.animation.preset || seg.animation.type}</span>
                    </span>
                  )}

                  {isOverlapping && (
                    <span className="flex items-center gap-1 rounded bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 text-[9px] text-red-300 font-medium">
                      <AlertCircle className="h-3 w-3 text-red-400" />
                      <span>Overlap</span>
                    </span>
                  )}

                  {isEdited && (
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] text-sky-300 font-semibold">
                        Edited
                      </span>
                      <button
                        type="button"
                        onClick={() => revertSegmentToOriginal(seg.id)}
                        className="rounded p-1 text-neutral-400 hover:text-sky-300 hover:bg-[#1a2230]"
                        title="Revert to original AI transcription"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Split Button */}
                  <button
                    type="button"
                    onClick={() => splitSegment(seg.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-[#1f2838] hover:text-amber-300 transition-colors"
                    title="Split caption at playhead / midpoint"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                  </button>

                  {/* Merge with Next */}
                  {idx < segments.length - 1 && (
                    <button
                      type="button"
                      onClick={() => mergeWithNext(seg.id)}
                      className="rounded p-1 text-neutral-400 hover:bg-[#1f2838] hover:text-emerald-300 transition-colors"
                      title="Merge with next caption"
                    >
                      <Merge className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deleteSegment(seg.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="Delete caption segment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Subtitle Text Input */}
              <div onClick={(e) => e.stopPropagation()}>
                <textarea
                  rows={2}
                  value={seg.text}
                  onChange={(e) => updateSegmentText(seg.id, e.target.value)}
                  className="w-full resize-none rounded-md border border-[#232c3d] bg-[#0c0f16] p-2 text-xs text-neutral-100 focus:border-amber-400 focus:outline-none leading-relaxed"
                  placeholder="Enter caption text..."
                />
              </div>

              {/* Word-Level Timings Section */}
              {hasWords && (
                <div className="mt-2 pt-2 border-t border-[#18202d]" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleWordsExpanded(seg.id)}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 hover:text-amber-300 transition-colors"
                  >
                    {isWordsExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                    <span>Word-Level Timings ({seg.words.length} words)</span>
                  </button>

                  {isWordsExpanded && (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 rounded-lg border border-[#1a2230] bg-[#090b10] p-2 max-h-48 overflow-y-auto">
                      {seg.words.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center gap-1 rounded border border-[#202838] bg-[#0f131a] px-1.5 py-1 text-[10px]"
                        >
                          <input
                            type="text"
                            value={w.text}
                            onChange={(e) =>
                              updateWord(seg.id, w.id, { text: e.target.value })
                            }
                            className="w-16 rounded border border-transparent bg-transparent px-1 font-medium text-amber-200 focus:border-amber-400 focus:bg-black focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setCurrentTimeMs(w.startMs)}
                            className="font-mono text-[9px] text-emerald-400 hover:underline"
                            title="Seek to word"
                          >
                            {(w.startMs / 1000).toFixed(1)}s
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
