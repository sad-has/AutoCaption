import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const TranscriptionBanner: React.FC = () => {
  const {
    activeTranscriptionJob,
    cancelTranscription,
    isTranscribing,
    transcriptionError,
    clearTranscriptionError,
  } = useAppStore();

  if (!activeTranscriptionJob && !transcriptionError && !isTranscribing) {
    return null;
  }

  const job = activeTranscriptionJob;
  const isFailed = job?.status === 'failed' || Boolean(transcriptionError);
  const isCompleted = job?.status === 'completed';
  const isRunning = job?.status === 'processing' || job?.status === 'queued' || isTranscribing;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 rounded-xl border border-[#273245] bg-[#10141d]/95 p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              isCompleted
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : isFailed
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : isFailed ? (
              <AlertCircle className="h-4 w-4" />
            ) : isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>

          <div className="overflow-hidden">
            <h4 className="text-xs font-semibold text-neutral-100 flex items-center gap-1.5">
              <span>{isCompleted ? 'Transcription Complete' : isFailed ? 'Transcription Failed' : 'Transcribing Speech'}</span>
            </h4>
            <p className="mt-0.5 truncate text-[11px] text-neutral-400">
              {job?.stage || transcriptionError || 'Processing speech...'}
            </p>
          </div>
        </div>

        {isRunning && (
          <button
            type="button"
            onClick={() => void cancelTranscription()}
            className="rounded px-2 py-1 text-[10px] font-medium text-neutral-400 hover:bg-[#1a212e] hover:text-red-400 transition-colors"
            title="Cancel transcription"
          >
            Cancel
          </button>
        )}

        {isFailed && (
          <button
            type="button"
            onClick={clearTranscriptionError}
            className="rounded p-1 text-neutral-400 hover:bg-[#1a212e] hover:text-neutral-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1c2331]">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${job?.percentage ?? job?.progress ?? 5}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
            <span>{job?.status === 'queued' ? 'Queued' : 'Processing audio'}</span>
            <span>{job?.percentage ?? job?.progress ?? 0}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
