import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const UploadProgressBanner: React.FC = () => {
  const { activeUpload, retryActiveUpload, cancelActiveUpload, dismissUpload } = useAppStore();

  if (!activeUpload) return null;

  const { fileName, percentage, bytesUploaded, totalBytes, status, error } = activeUpload;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const isUploading = status === 'uploading' || status === 'validating' || status === 'processing';
  const isCompleted = status === 'completed';
  const isError = status === 'error';
  const isCancelled = status === 'cancelled';

  return (
    <aside
      aria-label="Upload status notification"
      className="fixed bottom-4 right-4 z-50 flex w-96 flex-col gap-2 rounded-xl border border-[#232b3a] bg-[#0e1219]/95 p-3.5 shadow-2xl backdrop-blur-md transition-all text-xs text-neutral-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isUploading && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          )}
          {isCompleted && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          )}
          {isError && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
          )}
          {isCancelled && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-700/50 text-neutral-400">
              <X className="h-3.5 w-3.5" />
            </div>
          )}

          <div className="flex flex-col">
            <span className="font-semibold text-neutral-100 truncate max-w-[200px]" title={fileName}>
              {fileName}
            </span>
            <span className="text-[10px] text-neutral-400">
              {status === 'validating' && 'Verifying magic bytes & container...'}
              {status === 'uploading' && 'Streaming to Supabase Storage (TUS)...'}
              {status === 'processing' && 'Generating signed URL & registering...'}
              {status === 'completed' && 'Saved in private bucket with signed URL'}
              {status === 'error' && (error || 'Upload failed')}
              {status === 'cancelled' && 'Upload cancelled'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {isUploading && (
            <button
              type="button"
              onClick={cancelActiveUpload}
              className="rounded p-1 text-neutral-400 hover:bg-[#1a212e] hover:text-neutral-200"
              title="Cancel Upload"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {isError && (
            <button
              type="button"
              onClick={retryActiveUpload}
              className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/25 border border-amber-500/30"
              title="Retry Upload"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}

          {(isCompleted || isCancelled || isError) && (
            <button
              type="button"
              onClick={dismissUpload}
              className="rounded p-1 text-neutral-400 hover:bg-[#1a212e] hover:text-neutral-200"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1b212c]">
          <div
            className={`h-full transition-all duration-200 ${
              isError
                ? 'bg-red-500'
                : isCompleted
                ? 'bg-emerald-400'
                : isCancelled
                ? 'bg-neutral-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.max(3, percentage)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
          <span>{percentage}%</span>
          {totalBytes > 0 && (
            <span>
              {formatSize(bytesUploaded)} / {formatSize(totalBytes)}
            </span>
          )}
        </div>
      </div>

      {/* Security & RLS badge */}
      <div className="flex items-center gap-1 border-t border-[#1d2330] pt-1.5 text-[9px] text-neutral-400">
        <ShieldCheck className="h-3 w-3 text-emerald-400/80" />
        <span>End-to-end user isolation with Row Level Security & Signed URLs</span>
      </div>
    </aside>
  );
};
