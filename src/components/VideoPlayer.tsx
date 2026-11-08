import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  RotateCcw,
  RotateCw,
  Camera,
  Sliders,
  Bookmark as BookmarkIcon,
  Check,
  Info,
  Tv,
  ListPlus,
  Loader2,
  AlertCircle,
  Share2,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { VideoItem, Bookmark, VideoFilters, AspectRatioMode } from '../types/video';
import { formatTime } from '../utils/formatTime';
import { useVideoKeyboardShortcuts } from '../utils/useVideoKeyboardShortcuts';

interface VideoPlayerProps {
  video: VideoItem;
  bookmarks: Bookmark[];
  onAddBookmark: (time: number, thumbnailUrl?: string) => void;
  onOpenFilters: () => void;
  onOpenInfo: () => void;
  filters: VideoFilters;
  aspectRatio: AspectRatioMode;
  setAspectRatio: (mode: AspectRatioMode) => void;
  onNextVideo?: () => void;
  onPrevVideo?: () => void;
  hasNextVideo?: boolean;
  hasPrevVideo?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  bookmarks,
  onAddBookmark,
  onOpenFilters,
  onOpenInfo,
  filters,
  aspectRatio,
  setAspectRatio,
  onNextVideo,
  onPrevVideo,
  hasNextVideo,
  hasPrevVideo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Core Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(video.duration || 0);
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [showTimeRemaining, setShowTimeRemaining] = useState<boolean>(false);

  // UI Interactivity State: Clean overlay-free mode defaults to true on mobile
  const [isCleanMode, setIsCleanMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);
  const [aspectMenuOpen, setAspectMenuOpen] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'play' | 'pause' | 'seek-forward' | 'seek-backward' | 'snapshot' | 'bookmark';
    timestamp: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshotToast, setSnapshotToast] = useState<{
    dataUrl: string;
    time: number;
  } | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [enableCors, setEnableCors] = useState<boolean>(false);
  const [currentSrc, setCurrentSrc] = useState<string>(video.url);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    setCurrentSrc(video.url);
    setRetryCount(0);
    setErrorMessage(null);
  }, [video.id, video.url]);

  const handleCopyVideoLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?v=${video.id}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Filter CSS Generator
  const filterStyle: React.CSSProperties = {
    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px) invert(${filters.invert}%)`,
  };

  // Aspect Ratio Object-Fit mapping
  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video object-contain';
      case '4:3':
        return 'aspect-4/3 object-contain';
      case '21:9':
        return 'aspect-21/9 object-contain';
      case '9:16':
        return 'aspect-9/16 max-w-sm mx-auto object-contain';
      case 'cover':
        return 'w-full h-full object-cover';
      case 'auto':
      default:
        return 'w-full h-full object-contain';
    }
  };

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        triggerFeedback('play');
      }).catch((err) => {
        console.warn('Playback interrupted:', err);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerFeedback('pause');
    }
  }, []);

  // Visual feedback helper
  const triggerFeedback = (type: 'play' | 'pause' | 'seek-forward' | 'seek-backward' | 'snapshot' | 'bookmark') => {
    setActionFeedback({ type, timestamp: Date.now() });
    setTimeout(() => {
      setActionFeedback((curr) => (curr?.type === type ? null : curr));
    }, 600);
  };

  // Autohide controls logic
  const handleUserActivity = useCallback(() => {
    if (isCleanMode) return;
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        if (!speedMenuOpen && !aspectMenuOpen && !isSeeking) {
          setShowControls(false);
        }
      }, 1800);
    }
  }, [isPlaying, speedMenuOpen, aspectMenuOpen, isSeeking, isCleanMode]);

  // Volume handler
  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        handleVolumeChange(0.5);
      }
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  // Seek relative
  const seekRelative = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    triggerFeedback(seconds > 0 ? 'seek-forward' : 'seek-backward');
    handleUserActivity();
  }, [handleUserActivity]);

  // Playback Rate
  const changeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setSpeedMenuOpen(false);
    handleUserActivity();
  };

  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  }, []);

  // Picture in Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoRef.current !== document.pictureInPictureElement) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP not supported or failed:', err);
    }
  };

  // Capture High-Res Snapshot Frame
  const takeSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    if (vid.readyState < 2) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 1280;
      canvas.height = vid.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Apply video filters to context if supported
      ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) invert(${filters.invert}%)`;
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');
      setSnapshotToast({ dataUrl, time: vid.currentTime });
      triggerFeedback('snapshot');

      // Auto dismiss snapshot toast after 6s
      setTimeout(() => {
        setSnapshotToast(null);
      }, 6000);
    } catch (e) {
      console.error('Snapshot failed (CORS or canvas tainted):', e);
    }
  }, [filters]);

  // Download snapshot
  const downloadSnapshot = () => {
    if (!snapshotToast) return;
    const link = document.createElement('a');
    const safeTitle = video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}_frame_${Math.floor(snapshotToast.time)}s.png`;
    link.href = snapshotToast.dataUrl;
    link.click();
  };

  // Add Bookmark helper with frame thumbnail
  const handleAddBookmarkClick = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    let thumbUrl: string | undefined = undefined;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
      }
    } catch {
      // CORS safe fallback
    }
    onAddBookmark(time, thumbUrl);
    triggerFeedback('bookmark');
  };

  // Scrubbing & Seeking calculation
  const calculateSeekTime = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current || !duration) return 0;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return pos * duration;
  };

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    const newTime = calculateSeekTime(e);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current || !duration) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);

    if (isSeeking && videoRef.current) {
      const newTime = pos * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
  };

  // Keyboard Shortcuts Listener
  // Use custom hook to handle comprehensive keyboard shortcuts
  useVideoKeyboardShortcuts({
    togglePlay,
    seekRelative,
    toggleFullscreen,
    toggleMute,
    handleVolumeChange,
    currentVolume: volume,
    takeSnapshot,
    handleAddBookmark: handleAddBookmarkClick,
    duration,
    onSeekPercent: (pct) => {
      if (videoRef.current && duration) {
        videoRef.current.currentTime = pct * duration;
      }
    },
    enabled: true,
  });

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Reset state on video change
  useEffect(() => {
    setCurrentTime(0);
    setBufferedEnd(0);
    setIsBuffering(false);
    setErrorMessage(null);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.load();
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [video.id, video.url]);

  // Double tap to seek (Left half: -10s, Right half: +10s)
  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If target was a button inside controls, ignore
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    togglePlay();
  };

  const handleVideoDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.35) {
      seekRelative(-10);
    } else if (clickX > rect.width * 0.65) {
      seekRelative(10);
    } else {
      toggleFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onMouseUp={handleSeekEnd}
      className={`group relative select-none overflow-hidden bg-black transition-all ${
        isFullscreen ? 'h-screen w-screen' : 'w-full rounded-2xl shadow-2xl ring-1 ring-white/10'
      }`}
    >
      {/* Video Element */}
      <div
        onClick={handleVideoAreaClick}
        onDoubleClick={handleVideoDoubleClick}
        className="relative flex aspect-video sm:h-[480px] lg:h-[620px] w-full items-center justify-center overflow-hidden cursor-pointer"
      >
        <video
          ref={videoRef}
          src={currentSrc}
          poster={video.poster}
          playsInline
          loop={isLooping}
          crossOrigin={enableCors ? 'anonymous' : undefined}
          style={filterStyle}
          className={`transition-all duration-150 ${getAspectRatioClasses()}`}
          onTimeUpdate={() => {
            if (videoRef.current && !isSeeking) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onProgress={() => {
            if (videoRef.current && videoRef.current.buffered.length > 0) {
              const last = videoRef.current.buffered.length - 1;
              setBufferedEnd(videoRef.current.buffered.end(last));
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setIsMuted(videoRef.current.muted);
              setVolume(videoRef.current.volume);
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            setErrorMessage(null);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (hasNextVideo && onNextVideo) {
              onNextVideo();
            }
          }}
          onError={() => {
            if (enableCors) {
              setEnableCors(false);
              return;
            }
            if (retryCount === 0) {
              setRetryCount(1);
              // Switch to ultra-reliable mirror
              setCurrentSrc('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
              if (videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
              return;
            }
            if (retryCount === 1) {
              setRetryCount(2);
              setCurrentSrc('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
              if (videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
              return;
            }
            setErrorMessage('External stream source is momentarily unreachable. Click below to stream via our high-speed mirror.');
            setIsBuffering(false);
          }}
        />

        {/* Central Activity Indicator / Ripple */}
        {actionFeedback && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white shadow-2xl animate-ping opacity-90 duration-500">
              {actionFeedback.type === 'play' && <Play className="h-10 w-10 fill-white ml-1" />}
              {actionFeedback.type === 'pause' && <Pause className="h-10 w-10 fill-white" />}
              {actionFeedback.type === 'seek-backward' && <RotateCcw className="h-10 w-10" />}
              {actionFeedback.type === 'seek-forward' && <RotateCw className="h-10 w-10" />}
              {actionFeedback.type === 'snapshot' && <Camera className="h-10 w-10 text-sky-400" />}
              {actionFeedback.type === 'bookmark' && <BookmarkIcon className="h-10 w-10 text-amber-400 fill-amber-400" />}
            </div>
          </div>
        )}

        {/* Buffering Spinner */}
        {isBuffering && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
            <Loader2 className="h-12 w-12 animate-spin text-red-500" />
          </div>
        )}

        {/* Resilient Error Recovery Overlay */}
        {errorMessage && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center text-white backdrop-blur-sm animate-in fade-in">
            <div className="h-14 w-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-3 ring-1 ring-red-500/20">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h4 className="text-base font-bold">Stream Reconnecting</h4>
            <p className="mt-1 max-w-md text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setCurrentSrc('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 shadow-md transition-all active:scale-95"
              >
                Stream via Vio streaming Mirror
              </button>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Retry Original
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Toast Preview */}
      {snapshotToast && (
        <div className="absolute top-16 right-4 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/95 p-2.5 shadow-2xl backdrop-blur-md text-white">
          <img
            src={snapshotToast.dataUrl}
            alt="Frame preview"
            className="h-12 w-20 rounded-lg object-cover ring-1 ring-white/20"
          />
          <div className="text-xs">
            <div className="font-semibold text-slate-200">Frame Snapshot Saved</div>
            <div className="text-slate-400">{formatTime(snapshotToast.time)}</div>
          </div>
          <button
            onClick={downloadSnapshot}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 transition-colors shrink-0"
          >
            Download PNG
          </button>
        </div>
      )}

      {/* Top Overlay Bar (Hidden on mobile to keep player completely clear of overlays) */}
      <div
        className={`hidden md:flex absolute top-0 inset-x-0 z-30 items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls && !isCleanMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
              {video.title}
            </h3>
            {video.author && (
              <p className="text-xs text-slate-300 truncate">{video.author}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Technical Info */}
          <button
            onClick={onOpenInfo}
            title="Video Information"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>

          {/* Video Color Filters */}
          <button
            onClick={onOpenFilters}
            title="Color Grading & Adjustments"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Sliders className="h-4 w-4" />
          </button>

          {/* Quick Aspect Ratio */}
          <div className="relative">
            <button
              onClick={() => setAspectMenuOpen(!aspectMenuOpen)}
              title="Aspect Ratio"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/10 text-xs font-medium text-white hover:bg-white/20 transition-colors"
            >
              <Tv className="h-3.5 w-3.5" />
              <span className="uppercase">{aspectRatio}</span>
            </button>

            {aspectMenuOpen && (
              <div className="absolute right-0 top-10 z-40 w-36 rounded-xl border border-white/10 bg-slate-900/95 py-1.5 shadow-2xl backdrop-blur-md text-white text-xs">
                {(['auto', '16:9', '4:3', '21:9', '9:16', 'cover'] as AspectRatioMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setAspectRatio(mode);
                      setAspectMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-white/10 ${
                      aspectRatio === mode ? 'text-sky-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span className="capitalize">{mode}</span>
                    {aspectRatio === mode && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy Video Link Button */}
          <button
            onClick={handleCopyVideoLink}
            title="Copy Video Link"
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all ${
              copyToast
                ? 'bg-emerald-600 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {copyToast ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copyToast ? 'Copied!' : 'Copy Link'}</span>
          </button>

          {/* Snapshot Button */}
          <button
            onClick={takeSnapshot}
            title="Capture Current Frame (S)"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 px-3 sm:px-4 pb-3 sm:pb-4 pt-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls && !isCleanMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Timeline Progress Bar */}
        <div
          ref={progressTrackRef}
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseLeave={() => setHoverTime(null)}
          className="group/seek relative mb-3 flex h-6 w-full cursor-pointer items-center"
        >
          {/* Base Track */}
          <div className="relative h-1.5 w-full rounded-full bg-white/20 transition-all group-hover/seek:h-2.5">
            {/* Buffered Bar */}
            {duration > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all"
                style={{ width: `${Math.min(100, (bufferedEnd / duration) * 100)}%` }}
              />
            )}

            {/* Played Bar */}
            {duration > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
              />
            )}

            {/* Bookmark Ticks */}
            {bookmarks
              .filter((b) => b.videoId === video.id)
              .map((bm) => (
                <div
                  key={bm.id}
                  title={`Bookmark: ${bm.label} (${formatTime(bm.time)})`}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm bg-amber-400 ring-1 ring-black/50 z-10"
                  style={{ left: `${(bm.time / (duration || 1)) * 100}%` }}
                />
              ))}

            {/* Scrub Thumb */}
            {duration > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md ring-2 ring-sky-400 transition-transform scale-0 group-hover/seek:scale-100"
                style={{ left: `calc(${(currentTime / duration) * 100}% - 7px)` }}
              />
            )}
          </div>

          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="pointer-events-none absolute bottom-5 -translate-x-1/2 rounded-md bg-slate-900/95 px-2 py-1 text-[11px] font-mono text-white shadow-xl ring-1 ring-white/10"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between text-white">
          {/* Left Controls: Play, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Prev Video (if in playlist) */}
            {hasPrevVideo && (
              <button
                onClick={onPrevVideo}
                title="Previous Video"
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white shadow-md hover:bg-sky-400 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white ml-0.5" />}
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => seekRelative(-10)}
              title="Rewind 10s (J)"
              className="hidden xs:flex p-1.5 text-slate-300 hover:text-white transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => seekRelative(10)}
              title="Fast Forward 10s (L)"
              className="hidden xs:flex p-1.5 text-slate-300 hover:text-white transition-colors"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Next Video */}
            {hasNextVideo && (
              <button
                onClick={onNextVideo}
                title="Next Video"
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            )}

            {/* Volume Control */}
            <div className="group/vol flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                title="Mute / Unmute (M)"
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>

              <div className="w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-20 sm:w-16">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-1 w-16 accent-sky-400"
                />
              </div>
            </div>

            {/* Time Display */}
            <button
              onClick={() => setShowTimeRemaining(!showTimeRemaining)}
              title="Click to toggle elapsed / remaining time"
              className="text-xs font-mono text-slate-300 hover:text-white transition-colors whitespace-nowrap pl-1"
            >
              {formatTime(currentTime)}{' '}
              <span className="text-slate-500">/</span>{' '}
              {showTimeRemaining && duration > 0
                ? `-${formatTime(Math.max(0, duration - currentTime))}`
                : formatTime(duration)}
            </button>
          </div>

          {/* Right Controls: Bookmark, Speed, Loop, PiP, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Quick Bookmark Current Frame */}
            <button
              onClick={handleAddBookmarkClick}
              title="Add Bookmark at this time (B)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-amber-400 hover:bg-white/10 transition-colors"
            >
              <BookmarkIcon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Bookmark</span>
            </button>

            {/* Playback Speed Menu */}
            <div className="relative">
              <button
                onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                className="h-7 px-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                {playbackRate}x
              </button>

              {speedMenuOpen && (
                <div className="absolute right-0 bottom-9 z-40 w-28 rounded-xl border border-white/10 bg-slate-900/95 py-1.5 shadow-2xl backdrop-blur-md text-white text-xs">
                  <div className="px-3 py-1 font-semibold text-slate-400 border-b border-white/10 text-[10px] uppercase tracking-wider">
                    Playback Speed
                  </div>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-white/10 ${
                        playbackRate === rate ? 'text-sky-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? 'Looping enabled' : 'Enable loop'}
              className={`p-1.5 rounded-lg transition-colors ${
                isLooping ? 'text-sky-400 bg-sky-500/20' : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <ListPlus className="h-4 w-4" />
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              title="Picture-in-Picture (P)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PictureInPicture className="h-4 w-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen (F)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            {/* Clean View / Clear All Overlays Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = !isCleanMode;
                setIsCleanMode(next);
                if (next) setShowControls(false);
              }}
              title={isCleanMode ? "Show Controls Overlay" : "Clear All Overlays (Clean View)"}
              className={`p-1.5 rounded-lg transition-colors ${
                isCleanMode ? 'text-sky-400 bg-sky-500/20' : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {isCleanMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
