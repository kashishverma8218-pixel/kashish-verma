import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Music,
  CheckCircle2,
  X,
  Send,
  Sparkles,
  UserPlus,
  UserCheck,
  Disc,
  ArrowLeft,
  Plus,
  Layers,
  ListVideo,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ReelItem, ReelComment, Channel } from '../types/video';
import { DEFAULT_PLAYABLE_REEL_URL, sanitizePlayableVideoUrl } from '../services/streamingService';

export interface ShortsSeries {
  id: string;
  title: string;
  description: string;
  creator: string;
  avatar: string;
  reelIds: string[];
}

export const SHORTS_SERIES: ShortsSeries[] = [
  {
    id: 'series-cgi',
    title: 'Cinematic 3D VFX Showcase',
    description: 'High-impact micro short films and CGI visual breakdowns in 4K.',
    creator: 'Blender Animation Studios',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
    reelIds: ['reel-1', 'reel-3', 'reel-5'],
  },
  {
    id: 'series-cyberpunk',
    title: 'Neon Dystopia 2099',
    description: 'Episodic sci-fi narrative told in fast-paced vertical format.',
    creator: 'CyberSphere Lab',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    reelIds: ['reel-2', 'reel-4', 'reel-1'],
  },
  {
    id: 'series-tips',
    title: '60s Filmmaking Secrets',
    description: 'Lighting, pacing, and Unreal Engine rendering masterclasses.',
    creator: 'FilmCraft Master',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    reelIds: ['reel-3', 'reel-2', 'reel-5'],
  },
];

interface ReelsViewProps {
  reels: ReelItem[];
  channels: Record<string, Channel>;
  commentsMap: Record<string, ReelComment[]>;
  onToggleFollow: (channelId: string) => void;
  onSelectChannel: (channelId: string) => void;
  onAddComment: (reelId: string, text: string) => void;
  onLikeComment: (reelId: string, commentId: string) => void;
  onToggleLikeReel: (reelId: string) => void;
  onToggleSaveReel: (reelId: string) => void;
  onNavigateHome: () => void;
  onOpenUpload?: () => void;
  initialReelId?: string;
}

export const ReelsView: React.FC<ReelsViewProps> = ({
  reels,
  channels,
  commentsMap,
  onToggleFollow,
  onSelectChannel,
  onAddComment,
  onLikeComment,
  onToggleLikeReel,
  onToggleSaveReel,
  onNavigateHome,
  onOpenUpload,
  initialReelId,
}) => {
  const [activeIndex, setActiveIndex] = useState(() => {
    if (initialReelId) {
      const idx = reels.findIndex((r) => r.id === initialReelId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [playIndicator, setPlayIndicator] = useState<'play' | 'pause' | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [fitToast, setFitToast] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [viewMode, setViewMode] = useState<'feed' | 'series'>('feed');
  const [touchOffsetY, setTouchOffsetY] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const lastWheelRef = useRef<number>(0);

  const FALLBACK_REEL_SRC = DEFAULT_PLAYABLE_REEL_URL;
  const activeReel = reels[activeIndex] || reels[0];
  const activeVideoSrc = sanitizePlayableVideoUrl(
    activeReel?.videoUrl,
    activeReel?.id,
    'reel',
    false
  );
  const activeChannel = activeReel ? channels[activeReel.channelId] : null;
  const isFollowing = activeChannel?.isSubscribed ?? false;
  const activeComments = activeReel ? (commentsMap[activeReel.id] || []) : [];

  // Sync activeIndex when initialReelId changes (e.g. deep link or post-publish)
  useEffect(() => {
    if (!initialReelId) return;
    const idx = reels.findIndex((r) => r.id === initialReelId);
    if (idx >= 0) {
      setActiveIndex(idx);
    }
  }, [initialReelId, reels]);

  // Reset video playback on index change
  useEffect(() => {
    if (videoRef.current && activeVideoSrc) {
      videoRef.current.dataset.fallbackApplied = 'false';
      videoRef.current.currentTime = 0;
      setProgress(0);
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [activeIndex, activeVideoSrc]);

  // Handle video progress updates
  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(pct);
    }
  };

  const handleNextReel = useCallback(() => {
    if (activeIndex < reels.length - 1) {
      setActiveIndex((prev) => prev + 1);
    } else {
      setActiveIndex(0); // loop back
    }
  }, [activeIndex, reels.length]);

  const handlePrevReel = useCallback(() => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    } else {
      setActiveIndex(reels.length - 1); // loop to end
    }
  }, [activeIndex, reels.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (commentsOpen) {
          e.preventDefault();
          setCommentsOpen(false);
          return;
        }
        if (viewMode === 'series') {
          e.preventDefault();
          setViewMode('feed');
          return;
        }
      }

      if (commentsOpen || viewMode === 'series') return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNextReel();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevReel();
      } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextReel, handlePrevReel, commentsOpen, viewMode]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      setPlayIndicator('play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setPlayIndicator('pause');
    }
    setTimeout(() => setPlayIndicator(null), 600);
  };

  // Touch swipe up/down for next & previous reel on mobile
  const handleReelTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (commentsOpen || viewMode === 'series') return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    touchStartYRef.current = touch.clientY;
    touchMovedRef.current = false;
  };

  const handleReelTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || commentsOpen || viewMode === 'series') return;
    const touch = e.touches[0];
    if (!touch) return;
    const delta = touch.clientY - touchStartYRef.current;
    if (Math.abs(delta) > 8) {
      touchMovedRef.current = true;
      setTouchOffsetY(Math.max(-120, Math.min(120, delta * 0.45)));
    }
  };

  const handleReelTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null) return;
    const touch = e.changedTouches[0];
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;
    setTouchOffsetY(0);

    if (!touch) return;
    const deltaY = touch.clientY - startY;
    if (deltaY < -55) {
      handleNextReel();
    } else if (deltaY > 55) {
      handlePrevReel();
    }
  };

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (commentsOpen || viewMode === 'series') return;
    const now = Date.now();
    if (now - lastWheelRef.current < 480) return;
    if (Math.abs(e.deltaY) > 35) {
      lastWheelRef.current = now;
      if (e.deltaY > 0) handleNextReel();
      else handlePrevReel();
    }
  };

  const handleVideoClick = () => {
    if (touchMovedRef.current) {
      touchMovedRef.current = false;
      return;
    }
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (!activeReel.userLiked) {
        onToggleLikeReel(activeReel.id);
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 900);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current !== 0) {
          togglePlayPause();
          lastTapRef.current = 0;
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?reel=${activeReel.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: activeReel.title,
          text: activeReel.description,
          url,
        });
        return;
      } catch {
        // User cancelled or share unsupported in iframe; fall back to copy
      }
    }
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
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeReel) return;
    onAddComment(activeReel.id, newCommentText.trim());
    setNewCommentText('');
  };

  const formatReelLikes = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return `${num}`;
  };

  if (!activeReel) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-base font-bold text-slate-700 dark:text-slate-200">No reels found</p>
        <button
          onClick={onNavigateHome}
          className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white font-semibold text-xs"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheelScroll}
      className="relative flex items-center justify-center min-h-[calc(100dvh-8.5rem)] sm:min-h-[calc(100vh-4.75rem)] py-2 sm:py-4 px-2 sm:px-6 bg-[var(--surface)] text-[var(--ink)] overflow-hidden select-none transition-colors"
    >
      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed top-16 z-50 rounded-xl bg-slate-900/95 text-white px-4 py-2 text-xs font-semibold shadow-xl border border-white/10 backdrop-blur-md animate-in fade-in duration-200">
          Reel link copied to clipboard!
        </div>
      )}

      {fitToast && (
        <div className="fixed top-16 z-50 rounded-xl bg-[#212121]/95 text-white px-4 py-2 text-xs font-semibold shadow-xl border border-[#FF0000]/40 backdrop-blur-md animate-in fade-in duration-200 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#FF0000]" />
          <span>{fitToast}</span>
        </div>
      )}

      {/* Main Reels Center Column */}
      <div className="relative flex items-center justify-center sm:gap-7 max-w-full w-full sm:w-auto">
        {/* Vertical Reel Container (strict 9:16 aspect ratio bounded inside viewport on every screen) */}
        <div
          onTouchStart={handleReelTouchStart}
          onTouchMove={handleReelTouchMove}
          onTouchEnd={handleReelTouchEnd}
          style={{
            transform: touchOffsetY !== 0 ? `translateY(${touchOffsetY}px)` : undefined,
          }}
          className="relative w-[min(calc(100vw-1rem),calc((100dvh-9.25rem)*9/16))] sm:w-[min(420px,calc((100dvh-6.75rem)*9/16))] max-h-[800px] aspect-[9/16] rounded-2xl sm:rounded-3xl overflow-hidden bg-black shadow-2xl border border-black/15 dark:border-white/10 flex items-center justify-center transition-transform duration-150 touch-pan-x"
        >
          {/* Ambient Glow Backdrop for seamless non-clipped framing */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img
              src={activeReel.poster}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover blur-2xl opacity-45 scale-125 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          </div>

          {/* Main Foreground Video Element */}
          <video
            ref={videoRef}
            src={activeVideoSrc}
            poster={activeReel.poster}
            loop
            muted={isMuted}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onClick={handleVideoClick}
            onError={(e) => {
              const target = e.currentTarget;
              if (target.dataset.fallbackApplied === 'true') return;
              if (target.src !== FALLBACK_REEL_SRC) {
                target.dataset.fallbackApplied = 'true';
                target.src = FALLBACK_REEL_SRC;
                target.load();
                target.play().catch(() => {});
              }
            }}
            className={`relative z-10 w-full h-full cursor-pointer transition-all duration-300 ${
              fitMode === 'contain' ? 'object-contain' : 'object-cover'
            }`}
          />

          {/* Top Scrim & Controls */}
          <div className="absolute top-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between gap-2 pointer-events-auto z-20">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-white drop-shadow-sm flex items-center gap-1.5 shrink-0">
                <Sparkles className="h-4 w-4 text-red-500 fill-red-500" />
                Reels
              </span>
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode('feed');
                  }}
                  className={`min-h-[30px] px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    viewMode === 'feed'
                      ? 'bg-[#FF0000] text-white shadow-xs'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  Feed
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode('series');
                  }}
                  className={`flex items-center gap-1 min-h-[30px] px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    viewMode === 'series'
                      ? 'bg-[#FF0000] text-white shadow-xs'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <Layers className="h-2.5 w-2.5" />
                  <span>Series</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {onOpenUpload && (
                <button
                  onClick={onOpenUpload}
                  title="Upload Reel"
                  aria-label="Upload Reel"
                  className="flex items-center justify-center gap-1 min-h-[36px] min-w-[36px] bg-white/20 hover:bg-white/30 text-white rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-md transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Create</span>
                </button>
              )}
              {/* Aspect Ratio Fit / Fill Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const next = fitMode === 'contain' ? 'cover' : 'contain';
                  setFitMode(next);
                  setFitToast(
                    next === 'contain'
                      ? 'Fit Screen: full frame, zero clipping'
                      : 'Fill Screen: immersive full bleed'
                  );
                  setTimeout(() => setFitToast(null), 2500);
                }}
                title={fitMode === 'contain' ? 'Current: Fit Screen (No clipping) • Click to Fill' : 'Current: Fill Screen • Click to Fit'}
                aria-label="Toggle video aspect fit"
                className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-95 ${
                  fitMode === 'contain'
                    ? 'bg-[#FF0000]/90 text-white shadow-md shadow-red-600/30 ring-1 ring-white/20'
                    : 'bg-black/40 text-white/90 hover:bg-black/60'
                }`}
              >
                {fitMode === 'contain' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all active:scale-95"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Center Play/Pause indicator flash */}
          {playIndicator && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in zoom-in-50 fade-out duration-500">
              <div className="h-16 w-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                {playIndicator === 'play' ? (
                  <Play className="h-8 w-8 fill-white ml-1" />
                ) : (
                  <Pause className="h-8 w-8 fill-white" />
                )}
              </div>
            </div>
          )}

          {/* Heart burst animation on double tap */}
          {showHeartAnimation && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in zoom-in-75 fade-out duration-700">
              <Heart className="h-24 w-24 text-red-500 fill-red-500 drop-shadow-2xl scale-125 transition-transform" />
            </div>
          )}

          {/* Bottom Scrim & Info Overlay (Right-padded on mobile so right action rail never overlaps text or Follow button) */}
          <div className="absolute bottom-0 inset-x-0 p-3.5 sm:p-4 pb-3.5 sm:pb-4 pr-[4.75rem] sm:pr-4 bg-gradient-to-t from-black/95 via-black/65 to-transparent pointer-events-auto z-20 space-y-1.5 sm:space-y-2">
            {/* Channel info with Follow / Following button */}
            <div className="flex items-center justify-between gap-2">
              <div
                onClick={() => activeChannel && onSelectChannel(activeChannel.id)}
                className="flex items-center gap-2.5 cursor-pointer min-w-0 group"
              >
                <div className="relative shrink-0">
                  <img
                    src={activeChannel?.avatar || activeReel.poster}
                    alt={activeChannel?.name || 'Creator'}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      const fallback = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
                      if (target.src !== fallback) target.src = fallback;
                    }}
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white/60 group-hover:ring-[#FF0000] transition-all shrink-0"
                  />
                  {!isFollowing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeChannel) onToggleFollow(activeChannel.id);
                      }}
                      title="Follow channel"
                      aria-label="Quick follow channel"
                      className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-sm ring-1 ring-black"
                    >
                      <Plus className="h-3 w-3 stroke-[3]" />
                    </button>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white truncate drop-shadow-sm group-hover:underline">
                      {activeChannel?.name || 'Creator'}
                    </span>
                    {activeChannel?.verified && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-sky-400 fill-sky-400/20 shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-white/75 block truncate">
                    {activeChannel?.handle || '@creator'}
                  </span>
                </div>
              </div>

              {/* Prominent Follow / Following Button */}
              {activeChannel && (
                <button
                  onClick={() => onToggleFollow(activeChannel.id)}
                  className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shrink-0 active:scale-95 ${
                    isFollowing
                      ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30 backdrop-blur-md'
                      : 'bg-[#FF0000] text-white hover:bg-[#CC0000] shadow-md'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Reel Title & Caption */}
            <div className="text-white text-xs leading-relaxed drop-shadow-sm">
              <p className="font-semibold text-white/95 line-clamp-2">
                {activeReel.title}
              </p>
              <p className="text-white/80 text-[11px] mt-0.5 line-clamp-2">
                {activeReel.description}
              </p>
            </div>

            {/* Audio Track Tag with Spinning Vinyl */}
            <div className="flex items-center justify-between pt-0.5 gap-2">
              <div className="flex items-center gap-2 text-white/80 text-[11px] font-medium min-w-0 truncate">
                <Music className="h-3.5 w-3.5 text-white/90 shrink-0 animate-pulse" />
                <span className="truncate">
                  {activeReel.audioTrack}
                </span>
              </div>

              {/* Spinning Disc */}
              <div className={`h-7 w-7 rounded-full bg-slate-900 border border-white/30 flex items-center justify-center shrink-0 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }}>
                <Disc className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          {/* Thin Progress Bar at bottom */}
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-30">
            <div
              className="h-full bg-[#FF0000] transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Mobile Inside-Right Action Rail (Keeps Like, Comment, Save, Share strictly inside 9:16 bounds on mobile) */}
          <div className="sm:hidden absolute right-2 bottom-14 z-30 flex flex-col items-center gap-2.5">
            {/* Like Button */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLikeReel(activeReel.id);
                }}
                aria-label={activeReel.userLiked ? 'Unlike' : 'Like'}
                className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 shadow-lg ${
                  activeReel.userLiked
                    ? 'bg-[#FF0000] text-white scale-105'
                    : 'bg-black/45 text-white border border-white/20'
                }`}
              >
                <Heart className={`h-5 w-5 ${activeReel.userLiked ? 'fill-white' : ''}`} />
              </button>
              <span className="text-[10px] font-mono font-bold text-white tabular-nums drop-shadow">
                {formatReelLikes(activeReel.likes)}
              </span>
            </div>

            {/* Comments Button */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentsOpen(true);
                }}
                aria-label="Comments"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 shadow-lg"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-white tabular-nums drop-shadow">
                {activeComments.length || activeReel.commentsCount}
              </span>
            </div>

            {/* Save Button */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSaveReel(activeReel.id);
                }}
                aria-label={activeReel.userSaved ? 'Saved' : 'Save'}
                className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 shadow-lg ${
                  activeReel.userSaved
                    ? 'bg-amber-400 text-[#0c0c0e]'
                    : 'bg-black/45 text-white border border-white/20'
                }`}
              >
                <Bookmark className={`h-5 w-5 ${activeReel.userSaved ? 'fill-[#0c0c0e]' : ''}`} />
              </button>
              <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                {activeReel.userSaved ? 'Saved' : 'Save'}
              </span>
            </div>

            {/* Share Button */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                aria-label="Share reel"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 shadow-lg"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                Share
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Side Action Rail (Design Variation 2 Architectural Buttons) */}
        <div className="hidden sm:flex flex-col items-center gap-5 pb-4 z-30">
          {/* Like Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => onToggleLikeReel(activeReel.id)}
              aria-label={activeReel.userLiked ? 'Unlike' : 'Like'}
              className={`flex h-12 w-12 items-center justify-center rounded-[4px] border transition-all active:scale-90 ${
                activeReel.userLiked
                  ? 'bg-[#FF0000] text-white border-[#FF0000] scale-105 shadow-[0_0_20px_rgba(255,0,0,0.3)]'
                  : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--ink-faint)] hover:border-[var(--ink)] hover:scale-105'
              }`}
            >
              <Heart
                className={`h-5 w-5 transition-transform ${
                  activeReel.userLiked ? 'fill-white scale-110' : ''
                }`}
              />
            </button>
            <span className="font-mono text-[11px] font-medium text-[var(--ink)]/80 tabular-nums">
              {formatReelLikes(activeReel.likes)}
            </span>
          </div>

          {/* Comments Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => setCommentsOpen(true)}
              aria-label="Comments"
              className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-[var(--bg)] text-[var(--ink)] border border-[var(--ink-faint)] hover:border-[var(--ink)] hover:scale-105 transition-all active:scale-90"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <span className="font-mono text-[11px] font-medium text-[var(--ink)]/80 tabular-nums">
              {activeComments.length || activeReel.commentsCount}
            </span>
          </div>

          {/* Bookmark / Save Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => onToggleSaveReel(activeReel.id)}
              aria-label={activeReel.userSaved ? 'Saved' : 'Save'}
              className={`flex h-12 w-12 items-center justify-center rounded-[4px] border transition-all active:scale-90 ${
                activeReel.userSaved
                  ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent scale-105'
                  : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--ink-faint)] hover:border-[var(--ink)] hover:scale-105'
              }`}
            >
              <Bookmark
                className={`h-5 w-5 ${
                  activeReel.userSaved ? 'fill-current' : ''
                }`}
              />
            </button>
            <span className="font-mono text-[11px] font-medium text-[var(--ink)]/80">
              {activeReel.userSaved ? 'Saved' : 'Save'}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleShare}
              aria-label="Share reel"
              className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-[var(--bg)] text-[var(--ink)] border border-[var(--ink-faint)] hover:border-[var(--ink)] hover:scale-105 transition-all active:scale-90"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <span className="font-mono text-[11px] font-medium text-[var(--ink)]/80">
              Share
            </span>
          </div>

          {/* Desktop Navigation Up / Down Arrows */}
          <div className="flex flex-col gap-2 mt-1 pt-3 border-t border-[var(--ink-faint)]">
            <button
              onClick={handlePrevReel}
              title="Previous Reel (Up Arrow)"
              className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[var(--bg)] text-[var(--ink)] border border-[var(--ink-faint)] hover:border-[var(--ink)] transition-all"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              onClick={handleNextReel}
              title="Next Reel (Down Arrow)"
              className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[var(--bg)] text-[var(--ink)] border border-[var(--ink-faint)] hover:border-[var(--ink)] transition-all"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* COMMENTS MODAL / DRAWER */}
      {commentsOpen && (
        <div
          onClick={() => setCommentsOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className="w-full sm:max-w-md h-[70vh] sm:h-[580px] bg-[var(--surface)] text-[var(--ink)] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[var(--ink-faint)] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--ink-faint)]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[var(--ink)] text-sm">
                  Comments
                </h3>
                <span className="text-xs text-[var(--ink-medium)] tabular-nums">
                  ({activeComments.length})
                </span>
              </div>
              <button
                onClick={() => setCommentsOpen(false)}
                aria-label="Close comments"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeComments.length === 0 ? (
                <div className="py-12 text-center text-[var(--ink-medium)]">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold text-[var(--ink)]">No comments yet</p>
                  <p className="text-[11px] mt-0.5">Be the first to share your thoughts!</p>
                </div>
              ) : (
                activeComments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 text-xs">
                    <img
                      src={comment.authorAvatar}
                      alt={comment.authorName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const fallback = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
                        if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                      }}
                      className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-[var(--ink-faint)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--ink)]">
                          {comment.authorName}
                        </span>
                        <span className="text-[10px] text-[var(--ink-medium)]">
                          {comment.timestamp}
                        </span>
                      </div>
                      <p className="text-[var(--ink)]/85 mt-0.5 leading-relaxed">
                        {comment.content}
                      </p>

                      <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--ink-medium)]">
                        <button
                          onClick={() => onLikeComment(activeReel.id, comment.id)}
                          className={`flex items-center gap-1 min-h-[28px] hover:text-[#FF0000] transition-colors ${
                            comment.userLiked ? 'text-[#FF0000] font-bold' : ''
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${comment.userLiked ? 'fill-[#FF0000]' : ''}`} />
                          <span className="tabular-nums">{comment.likes}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Post Comment Input Bar */}
            <form
              onSubmit={handlePostComment}
              className="p-3 border-t border-[var(--ink-faint)] bg-[var(--bg)]/70 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Add a comment on this reel..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 min-h-[40px] rounded-full border border-[var(--ink-faint)] bg-[var(--surface)] px-4 py-2 text-base sm:text-xs text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:outline-none focus:border-[var(--accent-ink)]"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                aria-label="Send comment"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF0000] text-white disabled:opacity-40 hover:bg-[#CC0000] transition-colors shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SHORTS SERIES PLAYLIST GROUPING MODAL (Grid thumbnail size 150x150 pixels) */}
      {viewMode === 'series' && (
        <div
          onClick={() => setViewMode('feed')}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[85vh] rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] text-[var(--ink)] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--ink-faint)] bg-[var(--bg)]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#FF0000] flex items-center justify-center shadow-lg shadow-[#FF0000]/20">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold flex items-center gap-2 text-[var(--ink)]">
                    Shorts Series Playlists
                    <span className="rounded-full bg-[#FF0000]/15 text-[#FF0000] text-[10px] px-2 py-0.5 font-bold">
                      Binge Mode
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--ink-medium)]">
                    Episodic vertical playlists curated by top creators on Vio streaming.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('feed')}
                aria-label="Close Shorts Series"
                className="p-1.5 rounded-full text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Playlists Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {SHORTS_SERIES.map((series) => {
                const seriesReels = reels.filter((r) => series.reelIds.includes(r.id));
                return (
                  <div
                    key={series.id}
                    className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--bg)] p-4 space-y-3.5 hover:border-[#FF0000]/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={series.avatar}
                          alt={series.creator}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const fallback = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
                            if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                          }}
                          className="h-9 w-9 rounded-full object-cover ring-2 ring-[#FF0000]/30"
                        />
                        <div>
                          <h4 className="font-bold text-sm text-[var(--ink)] flex flex-wrap items-center gap-2">
                            {series.title}
                            <span className="text-[10px] rounded-md bg-[var(--surface)] border border-[var(--ink-faint)] text-[var(--ink-medium)] px-1.5 py-0.5 font-mono">
                              {seriesReels.length} Episodes
                            </span>
                          </h4>
                          <p className="text-[11px] text-[var(--ink-medium)]">{series.description}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const firstIdx = reels.findIndex((r) => series.reelIds.includes(r.id));
                          if (firstIdx !== -1) setActiveIndex(firstIdx);
                          setViewMode('feed');
                        }}
                        className="flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white text-xs font-bold transition-all shadow-md shadow-[#FF0000]/25 shrink-0 self-start sm:self-auto cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        <span>Play All</span>
                      </button>
                    </div>

                    {/* Responsive Playlist Grouping Grid */}
                    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none pt-1">
                      {seriesReels.map((reel, epIndex) => (
                        <div
                          key={reel.id}
                          onClick={() => {
                            const idx = reels.findIndex((r) => r.id === reel.id);
                            if (idx !== -1) setActiveIndex(idx);
                            setViewMode('feed');
                          }}
                          className="group relative cursor-pointer shrink-0 transition-transform hover:scale-105"
                        >
                          <div className="relative w-[132px] h-[132px] sm:w-[150px] sm:h-[150px] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 group-hover:ring-purple-500 transition-all shadow-md">
                            <img
                              src={reel.poster}
                              alt={reel.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const fallback = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80';
                                if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                              }}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                            <div className="absolute top-2 left-2 rounded-md bg-black/70 backdrop-blur-xs px-2 py-0.5 text-[10px] font-mono font-bold text-white">
                              Ep. {epIndex + 1}
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                                <Play className="h-4 w-4 fill-white ml-0.5" />
                              </div>
                            </div>

                            <div className="absolute bottom-2 inset-x-2 text-[11px] font-bold text-white line-clamp-1 drop-shadow-md">
                              {reel.title}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
