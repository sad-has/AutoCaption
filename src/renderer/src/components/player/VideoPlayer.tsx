import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { logger } from '../../utils/logger';
import type { MediaAsset } from '@shared/types';
import { computeCaptionAnimation, isReducedMotionPreferred } from '@shared/animations/engine';
import { resolveNormalizedCaptionRendering } from '@shared/rendering/captionRenderer';

interface VideoPlayerProps {
  mediaAsset: MediaAsset;
  onReplaceVideo?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ mediaAsset, onReplaceVideo }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const {
    currentTimeMs,
    setCurrentTimeMs,
    setDurationMs,
    isPlaying,
    setIsPlaying,
    playbackRate,
    volume,
    isMuted,
    isScrubbing,
    aspectRatio,
    showSafeMargins,
    currentProject,
    setMediaLoading,
    setMediaError,
    mediaError,
  } = useAppStore();

  const [isBuffering, setIsBuffering] = useState(false);
  const isSeekingRef = useRef(false);

  // 1. Play / Pause Synchronization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          logger.warn('VideoPlayer', 'Playback play() was prevented or interrupted', err);
          setIsPlaying(false);
        });
      }
    } else {
      video.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // 2. Playback Rate & Volume Synchronization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
    video.volume = volume;
    video.muted = isMuted;
  }, [playbackRate, volume, isMuted]);

  // 3. External Seeking (from Timeline scrubber or frame stepping)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isSeekingRef.current) return;

    const targetSec = currentTimeMs / 1000;
    // Only seek if video is out of sync by more than 80ms to avoid audio feedback stutter
    if (Math.abs(video.currentTime - targetSec) > 0.08) {
      isSeekingRef.current = true;
      video.currentTime = targetSec;
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 50);
    }
  }, [currentTimeMs]);

  // Handle metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const durationSec = video.duration;
    if (!isNaN(durationSec) && durationSec > 0) {
      const durMs = Math.round(durationSec * 1000);
      setDurationMs(durMs);
      logger.info('VideoPlayer', `Loaded metadata: duration=${durMs}ms, size=${video.videoWidth}x${video.videoHeight}`);
    }
    setMediaLoading(false);
    setIsBuffering(false);
  }, [setDurationMs, setMediaLoading]);

  // Handle time update during video playback
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || isScrubbing || isSeekingRef.current) return;

    const ms = Math.round(video.currentTime * 1000);
    setCurrentTimeMs(ms);
  }, [isScrubbing, setCurrentTimeMs]);

  // Handle media error
  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.error) return;

    const err = video.error;
    let message = 'An error occurred while loading or playing the video file.';

    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        message = 'Video playback was aborted.';
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        message = 'A network/streaming error occurred reading the media file.';
        break;
      case MediaError.MEDIA_ERR_DECODE:
        message = 'Video decoding failed. The file may be corrupt or encoded in an unsupported profile.';
        break;
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        message = `The video format or codec is not supported for hardware-accelerated playback. (${mediaAsset.videoCodec || 'Unknown codec'})`;
        break;
    }

    logger.error('VideoPlayer', `Media element error [code ${err.code}]: ${message}`);
    setMediaError(message);
    setIsPlaying(false);
    setIsBuffering(false);
  }, [mediaAsset.videoCodec, setMediaError, setIsPlaying]);

  // Video aspect ratio styling
  const aspectClass = {
    '9:16': 'aspect-[9/16] max-h-[82%] max-w-[340px]',
    '16:9': 'aspect-[16/9] max-h-[75%] max-w-[620px]',
    '1:1': 'aspect-square max-h-[75%] max-w-[420px]',
    '4:5': 'aspect-[4/5] max-h-[80%] max-w-[380px]',
  }[aspectRatio];

  // Active caption segment
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(isReducedMotionPreferred());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const activeSegment = currentProject.captionSegments.find(
    (seg) => currentTimeMs >= seg.startMs && currentTimeMs <= seg.endMs
  );
  const baseStyle = currentProject.captionStyle;
  const style = activeSegment?.styleOverrides
    ? { ...baseStyle, ...activeSegment.styleOverrides }
    : baseStyle;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [aspectRatio]);

  // Normalized styling resolved against current video preview container
  const normalizedRendering = useMemo(() => {
    const fallbackW = aspectRatio === '9:16' ? 340 : aspectRatio === '16:9' ? 620 : aspectRatio === '4:5' ? 380 : 420;
    const fallbackH = aspectRatio === '9:16' ? 604 : aspectRatio === '16:9' ? 349 : aspectRatio === '4:5' ? 475 : 420;
    const cWidth = containerSize.width || fallbackW;
    const cHeight = containerSize.height || fallbackH;

    return resolveNormalizedCaptionRendering({
      style,
      segment: activeSegment,
      currentTimeMs,
      canvasWidth: cWidth,
      canvasHeight: cHeight,
      prefersReducedMotion,
    });
  }, [style, activeSegment, currentTimeMs, containerSize, aspectRatio, prefersReducedMotion]);

  // Real-time pure animation computation: supports pause, scrubbing, and reverse seeking
  const computedAnimation = useMemo(() => {
    if (!activeSegment) return null;
    return computeCaptionAnimation({
      currentTimeMs,
      segment: activeSegment,
      style,
      configOverride: activeSegment.animation,
      prefersReducedMotion,
    });
  }, [currentTimeMs, activeSegment, style, prefersReducedMotion]);

  if (mediaError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/30 bg-[#141217] p-8 text-center max-w-md shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20 mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-semibold text-red-200">Video Playback Failed</h4>
        <p className="mt-1 text-xs text-neutral-400 leading-relaxed">{mediaError}</p>
        <div className="mt-2 text-[10px] font-mono text-neutral-500 truncate max-w-xs">
          {mediaAsset.name}
        </div>

        {onReplaceVideo && (
          <button
            type="button"
            onClick={onReplaceVideo}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Select Another Video</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center rounded-lg border border-[#222a38] bg-black shadow-2xl overflow-hidden transition-all ${aspectClass}`}
    >
      {/* HTML5 Native Video Element */}
      <video
        ref={videoRef}
        src={mediaAsset.streamUrl}
        preload="auto"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onError={handleVideoError}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onEnded={() => setIsPlaying(false)}
        className="w-full h-full object-contain select-none"
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-lg bg-neutral-900/90 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-[#273245] shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Buffering...</span>
          </div>
        </div>
      )}

      {/* TikTok / Reels Safe Margins Overlay */}
      {showSafeMargins && aspectRatio === '9:16' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 border border-dashed border-amber-500/25">
          <div className="rounded bg-amber-500/5 border-b border-amber-500/20 p-1 text-[9px] font-mono text-amber-400/80 uppercase">
            Top Safe Zone (Header & Search)
          </div>

          <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3 opacity-60">
            <div className="h-7 w-7 rounded-full bg-neutral-800/80 border border-neutral-700/50" />
            <div className="h-7 w-7 rounded-full bg-neutral-800/80 border border-neutral-700/50" />
            <div className="h-7 w-7 rounded-full bg-neutral-800/80 border border-neutral-700/50" />
          </div>

          <div className="rounded bg-amber-500/5 border-t border-amber-500/20 p-1 text-[9px] font-mono text-amber-400/80 uppercase">
            Bottom Safe Zone (Title & Sound)
          </div>
        </div>
      )}

      {/* Synchronized Caption Rendering Overlay with Unified Shared Typography Engine */}
      {activeSegment && computedAnimation && computedAnimation.isVisible && (
        <div
          className="pointer-events-none absolute z-20 flex w-full"
          style={{
            bottom: `${normalizedRendering.positionYPercent}%`,
            left: `${normalizedRendering.positionXPercent}%`,
            transform: 'translateX(-50%)',
            justifyContent:
              normalizedRendering.textAlign === 'left'
                ? 'flex-start'
                : normalizedRendering.textAlign === 'right'
                ? 'flex-end'
                : 'center',
            paddingLeft: '1rem',
            paddingRight: '1rem',
          }}
        >
          <div
            className="inline-block transition-transform duration-75"
            style={{
              maxWidth: `${normalizedRendering.maxWidthPercent}%`,
              opacity: computedAnimation.opacity,
              transform: computedAnimation.transform,
              filter: computedAnimation.blurPx ? `blur(${computedAnimation.blurPx.toFixed(1)}px)` : undefined,
              backgroundColor: normalizedRendering.hasBox
                ? normalizedRendering.boxColor.startsWith('#')
                  ? `${normalizedRendering.boxColor}${Math.round(normalizedRendering.boxOpacity * 255)
                      .toString(16)
                      .padStart(2, '0')}`
                  : normalizedRendering.boxColor
                : 'transparent',
              padding: normalizedRendering.hasBox
                ? `${normalizedRendering.boxPaddingYPx}px ${normalizedRendering.boxPaddingXPx}px`
                : undefined,
              borderRadius: normalizedRendering.hasBox ? `${normalizedRendering.boxCornerRadiusPx}px` : undefined,
              textAlign: normalizedRendering.textAlign,
            }}
          >
            <p
              style={{
                fontFamily: `${normalizedRendering.fontFamily}, 'Noto Sans Devanagari', 'Poppins', sans-serif`,
                fontSize: `${normalizedRendering.fontSizePx}px`,
                fontWeight: normalizedRendering.fontWeight,
                textTransform: normalizedRendering.textTransform,
                letterSpacing: `${computedAnimation.letterSpacingPx ?? normalizedRendering.letterSpacingPx}px`,
                lineHeight: normalizedRendering.lineHeight,
                textAlign: normalizedRendering.textAlign,
                WebkitTextStroke:
                  normalizedRendering.hasStroke && normalizedRendering.strokeWidthPx > 0
                    ? `${normalizedRendering.strokeWidthPx}px ${normalizedRendering.strokeColor}`
                    : undefined,
                textShadow: normalizedRendering.hasShadow
                  ? `${normalizedRendering.shadowOffsetX}px ${normalizedRendering.shadowOffsetY}px ${normalizedRendering.shadowBlur}px ${normalizedRendering.shadowColor}`
                  : undefined,
              }}
              className="select-none font-bold tracking-tight"
            >
              {computedAnimation.wordStates && computedAnimation.wordStates.length > 0 ? (
                computedAnimation.wordStates.map((word) => {
                  const isPill = word.isHighlighted && normalizedRendering.highlightStyle === 'pill';
                  const isBox = word.isHighlighted && normalizedRendering.highlightStyle === 'box';
                  const wordColor = word.isHighlighted
                    ? normalizedRendering.activeWordColor
                    : (word.color || normalizedRendering.textColor);

                  const wordFontFamily = word.fontFamily
                    ? `${word.fontFamily}, 'Noto Sans Devanagari', 'Poppins', sans-serif`
                    : `${normalizedRendering.fontFamily}, 'Noto Sans Devanagari', 'Poppins', sans-serif`;
                  const wordFontWeight = word.fontWeight || normalizedRendering.fontWeight;

                  return (
                    <span
                      key={word.id}
                      style={{
                        fontFamily: wordFontFamily,
                        fontWeight: wordFontWeight,
                        color: wordColor,
                        opacity: word.opacity,
                        transform: word.transform,
                        backgroundColor:
                          word.backgroundColor ||
                          (isPill
                            ? normalizedRendering.activeWordBgColor || 'rgba(52, 211, 153, 0.22)'
                            : isBox
                            ? normalizedRendering.activeWordBgColor || 'rgba(15, 23, 42, 0.75)'
                            : undefined),
                        padding: isPill ? '2px 8px' : isBox ? '2px 6px' : undefined,
                        borderRadius: isPill ? '9999px' : isBox ? '4px' : undefined,
                        display: word.isVisible ? 'inline-block' : 'none',
                        margin: '0 3px',
                        transition: prefersReducedMotion ? 'none' : 'color 0.05s ease-out, transform 0.08s ease-out',
                      }}
                    >
                      {word.text}
                    </span>
                  );
                })
              ) : (
                <span style={{ color: normalizedRendering.textColor }}>
                  {computedAnimation.renderedText ?? activeSegment.text}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
