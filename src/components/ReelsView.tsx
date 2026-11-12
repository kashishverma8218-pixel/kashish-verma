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
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const activeReel = reels[activeIndex] || reels[0];
  const activeChannel = activeReel ? channels[activeReel.channelId] : null;
  const isFollowing = activeChannel?.isSubscribed ?? false;
  const activeComments = activeReel ? (commentsMap[activeReel.id] || []) : [];

  // Reset video playback on index change
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setProgress(0);
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        // Autoplay policy might mute or require interaction
        setIsPlaying(false);
      });
    }
  }, [activeIndex]);

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
      // Don't trigger shortcuts if typing inside comments input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNextReel();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrevReel();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextReel, handlePrevReel]);

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

  const handleVideoClick = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap triggered: Like reel
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

  const handleShare = () => {
    const url = `${window.location.origin}?reel=${activeReel.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
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
      className="relative flex items-center justify-center min-h-[calc(100vh-3.5rem)] py-3 px-2 sm:px-4 bg-slate-950/95 overflow-hidden select-none"
    >
      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed top-16 z-50 rounded-xl bg-slate-900/90 text-white px-4 py-2 text-xs font-semibold shadow-xl border border-white/10 backdrop-blur-md animate-in fade-in duration-200">
          Reel link copied to clipboard!
        </div>
      )}

      {fitToast && (
        <div className="fixed top-16 z-50 rounded-xl bg-slate-900/95 text-white px-4 py-2 text-xs font-semibold shadow-xl border border-red-500/30 backdrop-blur-md animate-in fade-in duration-200 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-red-500" />
          <span>{fitToast}</span>
        </div>
      )}

      {/* Main Reels Center Column */}
      <div className="relative flex items-center gap-4 sm:gap-6 max-w-full">
        {/* Vertical Reel Container (strict 9:16 aspect ratio, zero clipping) */}
        <div className="relative aspect-[9/16] h-[calc(100dvh-5.5rem)] max-h-[820px] w-auto max-w-[calc(100vw-5.5rem)] sm:max-w-[460px] rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10 flex items-center justify-center">
          {/* Ambient Glow Backdrop for seamless non-clipped framing */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <video
              src={activeReel.videoUrl}
              poster={activeReel.poster}
              loop
              muted
              playsInline
              className="w-full h-full object-cover blur-2xl opacity-45 scale-125 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          </div>

          {/* Main Foreground Video Element */}
          <video
            ref={videoRef}
            src={activeReel.videoUrl}
            poster={activeReel.poster}
            loop
            muted={isMuted}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onClick={handleVideoClick}
            className={`relative z-10 w-full h-full cursor-pointer transition-all duration-300 ${
              fitMode === 'contain' ? 'object-contain' : 'object-cover'
            }`}
          />

          {/* Top Scrim & Controls */}
          <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto z-20">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-white drop-shadow-sm flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-red-500 fill-red-500" />
                Reels
              </span>
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode('feed');
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    viewMode === 'feed'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Feed
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode('series');
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    viewMode === 'series'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Layers className="h-2.5 w-2.5" />
                  <span>Series</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenUpload && (
                <button
                  onClick={onOpenUpload}
                  title="Upload Reel"
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-md transition-colors"
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
                className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-95 ${
                  fitMode === 'contain'
                    ? 'bg-red-600/90 text-white shadow-md shadow-red-600/30 ring-1 ring-white/20'
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
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all active:scale-95"
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

          {/* Bottom Scrim & Info Overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 pb-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto z-20 space-y-2.5">
            {/* Channel info with Follow / Following button */}
            <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => activeChannel && onSelectChannel(activeChannel.id)}
                className="flex items-center gap-2.5 cursor-pointer min-w-0 group"
              >
                <div className="relative">
                  <img
                    src={activeChannel?.avatar || activeReel.poster}
                    alt={activeChannel?.name || 'Creator'}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      const fallback = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
                      if (target.src !== fallback) target.src = fallback;
                    }}
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white/60 group-hover:ring-red-500 transition-all shrink-0"
                  />
                  {!isFollowing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeChannel) onToggleFollow(activeChannel.id);
                      }}
                      title="Follow channel"
                      className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow-sm ring-1 ring-black"
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
                  <span className="text-[11px] text-white/70 block truncate">
                    {activeChannel?.handle || '@creator'}
                  </span>
                </div>
              </div>

              {/* Prominent Follow / Following Button */}
              {activeChannel && (
                <button
                  onClick={() => onToggleFollow(activeChannel.id)}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all shrink-0 active:scale-95 ${
                    isFollowing
                      ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30 backdrop-blur-md'
                      : 'bg-red-600 text-white hover:bg-red-500 shadow-md'
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
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-white/80 text-[11px] font-medium max-w-[80%] truncate">
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
              className="h-full bg-red-600 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Right Floating Action Rail */}
        <div className="flex flex-col items-center gap-4 sm:gap-5 pb-8 z-30">
          {/* Like Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onToggleLikeReel(activeReel.id)}
              aria-label={activeReel.userLiked ? 'Unlike' : 'Like'}
              className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 shadow-lg ${
                activeReel.userLiked
                  ? 'bg-red-600 text-white scale-105'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              <Heart
                className={`h-5 w-5 sm:h-6 sm:w-6 transition-transform ${
                  activeReel.userLiked ? 'fill-white scale-110' : ''
                }`}
              />
            </button>
            <span className="text-[11px] font-bold text-white tabular-nums drop-shadow-sm">
              {formatReelLikes(activeReel.likes + (activeReel.userLiked ? 1 : 0))}
            </span>
          </div>

          {/* Comments Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setCommentsOpen(true)}
              aria-label="Comments"
              className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md transition-all active:scale-90 shadow-lg"
            >
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <span className="text-[11px] font-bold text-white tabular-nums drop-shadow-sm">
              {activeComments.length || activeReel.commentsCount}
            </span>
          </div>

          {/* Bookmark / Save Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onToggleSaveReel(activeReel.id)}
              aria-label={activeReel.userSaved ? 'Saved' : 'Save'}
              className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 shadow-lg ${
                activeReel.userSaved
                  ? 'bg-amber-500 text-slate-950 scale-105'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              <Bookmark
                className={`h-5 w-5 sm:h-6 sm:w-6 ${
                  activeReel.userSaved ? 'fill-slate-950' : ''
                }`}
              />
            </button>
            <span className="text-[11px] font-bold text-white/90 drop-shadow-sm">
              {activeReel.userSaved ? 'Saved' : 'Save'}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleShare}
              aria-label="Share reel"
              className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md transition-all active:scale-90 shadow-lg"
            >
              <Share2 className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <span className="text-[11px] font-bold text-white/90 drop-shadow-sm">
              Share
            </span>
          </div>

          {/* Desktop Navigation Up / Down Arrows */}
          <div className="hidden sm:flex flex-col gap-2 mt-2 pt-2 border-t border-white/10">
            <button
              onClick={handlePrevReel}
              title="Previous Reel (Up Arrow)"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              onClick={handleNextReel}
              title="Next Reel (Down Arrow)"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* COMMENTS MODAL / DRAWER */}
      {commentsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full sm:max-w-md h-[70vh] sm:h-[580px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Comments
                </h3>
                <span className="text-xs text-slate-400 tabular-nums">
                  ({activeComments.length})
                </span>
              </div>
              <button
                onClick={() => setCommentsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeComments.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold">No comments yet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Be the first to share your thoughts!</p>
                </div>
              ) : (
                activeComments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 text-xs">
                    <img
                      src={comment.authorAvatar}
                      alt={comment.authorName}
                      className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {comment.authorName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {comment.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {comment.content}
                      </p>

                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <button
                          onClick={() => onLikeComment(activeReel.id, comment.id)}
                          className={`flex items-center gap-1 hover:text-red-500 transition-colors ${
                            comment.userLiked ? 'text-red-500 font-bold' : ''
                          }`}
                        >
                          <Heart className={`h-3 w-3 ${comment.userLiked ? 'fill-red-500' : ''}`} />
                          <span className="tabular-nums">{comment.likes + (comment.userLiked ? 1 : 0)}</span>
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
              className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Add a comment on this reel..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white disabled:opacity-40 hover:bg-red-500 transition-colors shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SHORTS SERIES PLAYLIST GROUPING MODAL (Grid thumbnail size 150x150 pixels) */}
      {viewMode === 'series' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-3xl border border-white/10 bg-slate-900 text-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    Shorts Series Playlists
                    <span className="rounded-full bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 font-bold">
                      Binge Mode
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Episodic vertical playlists curated by top creators on Vio streaming.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewMode('feed')}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
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
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-3.5 hover:border-purple-500/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={series.avatar}
                          alt={series.creator}
                          className="h-9 w-9 rounded-full object-cover ring-2 ring-purple-500/30"
                        />
                        <div>
                          <h4 className="font-bold text-sm text-white flex items-center gap-2">
                            {series.title}
                            <span className="text-[10px] rounded-md bg-white/10 text-slate-300 px-1.5 py-0.5 font-mono">
                              {seriesReels.length} Episodes
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400">{series.description}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const firstIdx = reels.findIndex((r) => series.reelIds.includes(r.id));
                          if (firstIdx !== -1) setActiveIndex(firstIdx);
                          setViewMode('feed');
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 shrink-0 self-start sm:self-auto"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        <span>Play All</span>
                      </button>
                    </div>

                    {/* Playlist Grouping Grid (Exact thumbnail size 150x150 pixels) */}
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
                          {/* Exact 150x150 pixels grid thumbnail */}
                          <div
                            style={{ width: '150px', height: '150px' }}
                            className="relative w-[150px] h-[150px] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 group-hover:ring-purple-500 transition-all shadow-md"
                          >
                            <img
                              src={reel.poster}
                              alt={reel.title}
                              style={{ width: '150px', height: '150px' }}
                              className="w-[150px] h-[150px] object-cover"
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
