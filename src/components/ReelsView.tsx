import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Disc,
  ArrowLeft,
  Plus,
  Layers,
  Maximize2,
  Minimize2,
  MoreVertical,
  AlignLeft,
  EyeOff,
  Eye,
  Gauge,
  Flag,
  MessageSquarePlus,
  Check
} from 'lucide-react';
import Hls from 'hls.js';
import { auth } from '../firebase';
import { ReelItem, ReelComment, Channel } from '../types/video';
import {
  DEFAULT_PLAYABLE_REEL_URL,
  fetchPlaybackSession,
  sanitizePlayableVideoUrl,
} from '../services/streamingService';
import { formatViews } from '../data/mockData';
import { ReportModal } from './ReportModal';

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
  onReelView?: (reelId: string) => void;
  onNavigateHome: () => void;
  onOpenUpload?: () => void;
  initialReelId?: string;
}

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
const FALLBACK_POSTER =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80';

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
  onReelView,
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [reportModalMode, setReportModalMode] = useState<'report' | 'feedback' | null>(null);
  const [clearScreen, setClearScreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [newCommentText, setNewCommentText] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<'auto' | 'contain' | 'cover'>('auto');
  const [videoRatios, setVideoRatios] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState(0);
  const [viewMode, setViewMode] = useState<'feed' | 'series'>('feed');

  const scrollFeedRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const activeVideoElRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const lastWheelRef = useRef<number>(0);
  const hlsRef = useRef<Hls | null>(null);

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
  const activeComments = activeReel ? commentsMap[activeReel.id] || [] : [];

  const [resolvedReelSrc, setResolvedReelSrc] = useState<string>(activeVideoSrc);
  const [isReelHlsActive, setIsReelHlsActive] = useState<boolean>(false);

  useEffect(() => {
    if (activeReel?.id && onReelView) {
      onReelView(activeReel.id);
    }
  }, [activeReel?.id, onReelView]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 2400);
  }, []);

  const scrollToReel = useCallback(
    (index: number, instant: boolean = false) => {
      if (reels.length === 0) return;
      const clamped = ((index % reels.length) + reels.length) % reels.length;
      setActiveIndex(clamped);
      const slideEl = slideRefs.current[clamped];
      if (slideEl) {
        slideEl.scrollIntoView({
          behavior: instant ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    },
    [reels.length]
  );

  // Sync activeIndex and scroll position when initialReelId changes
  useEffect(() => {
    if (!initialReelId) return;
    const idx = reels.findIndex((r) => r.id === initialReelId);
    if (idx >= 0) {
      setActiveIndex(idx);
      requestAnimationFrame(() => {
        const slideEl = slideRefs.current[idx];
        slideEl?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }, [initialReelId, reels]);

  // Observe visible reel slide during native swipe / scroll snap
  useEffect(() => {
    const feedEl = scrollFeedRef.current;
    if (!feedEl || reels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idxAttr = entry.target.getAttribute('data-reel-index');
            if (idxAttr !== null) {
              const parsed = parseInt(idxAttr, 10);
              if (!Number.isNaN(parsed)) {
                setActiveIndex((prev) => (prev !== parsed ? parsed : prev));
              }
            }
          }
        }
      },
      {
        root: feedEl,
        threshold: [0.6, 0.85],
      }
    );

    Object.values(slideRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels.length]);

  // Attach playback session & HLS stream to the active reel's <video>
  useEffect(() => {
    let cancelled = false;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setIsReelHlsActive(false);

    const videoEl = activeVideoElRef.current;
    if (!videoEl || !activeReel) return;

    videoEl.dataset.fallbackApplied = 'false';
    videoEl.currentTime = 0;
    videoEl.playbackRate = playbackSpeed;
    setProgress(0);

    const attachReelHls = async (hlsManifestUrl: string, fallbackUrl?: string | null) => {
      if (Hls.isSupported()) {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
        if (cancelled) return;
        const hls = new Hls({
          enableWorker: true,
          capLevelToPlayerSize: true,
          xhrSetup: (xhr) => {
            if (idToken) xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
          },
        });
        hlsRef.current = hls;
        setIsReelHlsActive(true);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          hls.destroy();
          hlsRef.current = null;
          setIsReelHlsActive(false);
          if (fallbackUrl) setResolvedReelSrc(fallbackUrl);
        });
        hls.loadSource(hlsManifestUrl);
        hls.attachMedia(videoEl);
        return;
      }

      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        setResolvedReelSrc(hlsManifestUrl);
        videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        return;
      }

      if (fallbackUrl) {
        setResolvedReelSrc(fallbackUrl);
      }
    };

    const usesCloudPlayback =
      Boolean(activeReel.sourceObjectPath) ||
      Boolean(activeReel.hlsManifestUrl && activeReel.hlsManifestUrl.startsWith('/api/stream/hls/')) ||
      Boolean(activeReel.videoUrl && activeReel.videoUrl.startsWith('/api/media/object/')) ||
      activeReel.visibility === 'private';

    if (usesCloudPlayback) {
      fetchPlaybackSession(activeReel.id)
        .then((session) => {
          if (cancelled) return;
          if (session.hlsUrl) {
            return attachReelHls(session.hlsUrl, session.fallbackUrl);
          }
          if (session.fallbackUrl) {
            setResolvedReelSrc(session.fallbackUrl);
            videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          }
        })
        .catch(() => {
          if (!cancelled) setResolvedReelSrc(activeVideoSrc);
        });
    } else {
      setResolvedReelSrc(activeVideoSrc);
      videoEl
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeIndex, activeReel?.id, activeVideoSrc]);

  // Keep playbackRate synchronized when user adjusts speed
  useEffect(() => {
    if (activeVideoElRef.current) {
      activeVideoElRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleTimeUpdate = (reelId: string, e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (reelId !== activeReel?.id) return;
    const vid = e.currentTarget;
    if (vid.duration) {
      setProgress((vid.currentTime / vid.duration) * 100);
    }
  };

  const handleNextReel = useCallback(() => {
    scrollToReel(activeIndex + 1);
  }, [activeIndex, scrollToReel]);

  const handlePrevReel = useCallback(() => {
    scrollToReel(activeIndex - 1);
  }, [activeIndex, scrollToReel]);

  const togglePlayPause = useCallback(() => {
    const vid = activeVideoElRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPlaying(true);
      setPlayIndicator('play');
    } else {
      vid.pause();
      setIsPlaying(false);
      setPlayIndicator('pause');
    }
    setTimeout(() => setPlayIndicator(null), 550);
  }, []);

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
        if (moreMenuOpen) {
          e.preventDefault();
          setMoreMenuOpen(false);
          return;
        }
        if (descriptionOpen) {
          e.preventDefault();
          setDescriptionOpen(false);
          return;
        }
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
        if (clearScreen) {
          e.preventDefault();
          setClearScreen(false);
          return;
        }
      }

      if (commentsOpen || viewMode === 'series' || moreMenuOpen || descriptionOpen) return;

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
  }, [handleNextReel, handlePrevReel, togglePlayPause, commentsOpen, viewMode, moreMenuOpen, descriptionOpen, clearScreen]);

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (commentsOpen || viewMode === 'series' || moreMenuOpen || descriptionOpen) return;
    const now = Date.now();
    if (now - lastWheelRef.current < 420) return;
    if (Math.abs(e.deltaY) > 35) {
      lastWheelRef.current = now;
      if (e.deltaY > 0) handleNextReel();
      else handlePrevReel();
    }
  };

  const handleVideoClick = (reel: ReelItem) => {
    if (clearScreen) {
      setClearScreen(false);
      return;
    }
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 260;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (!reel.userLiked) {
        onToggleLikeReel(reel.id);
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 850);
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

  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const vid = activeVideoElRef.current;
    if (!vid || !vid.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    vid.currentTime = ratio * vid.duration;
    setProgress(ratio * 100);
  };

  const handleShare = async () => {
    if (!activeReel) return;
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
        // Fallback to copy
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
      showToast('Reel link copied to clipboard');
    } catch {
      showToast('Reel link ready to share');
    }
  };

  const handleCycleFitMode = () => {
    const next = fitMode === 'auto' ? 'cover' : fitMode === 'cover' ? 'contain' : 'auto';
    setFitMode(next);
    showToast(
      next === 'auto'
        ? 'Smart Fit: Auto framing enabled'
        : next === 'cover'
        ? 'Fill Screen: Full-bleed view'
        : 'Fit Screen: Full frame, zero crop'
    );
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

  const resolveObjectFitClass = (reelId: string) => {
    if (fitMode === 'cover') return 'object-cover';
    if (fitMode === 'contain') return 'object-contain';
    const ratio = videoRatios[reelId];
    // Portrait / vertical reels fill cleanly edge-to-edge; horizontal clips avoid side clipping
    if (ratio && ratio <= 1.05) return 'object-cover';
    return 'object-contain';
  };

  if (!activeReel) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <p className="text-base font-bold text-[var(--ink)]">No reels found</p>
        <button
          onClick={onNavigateHome}
          className="mt-4 px-5 py-2.5 rounded-full bg-[#FF0000] text-white font-semibold text-xs"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div
      onWheel={handleWheelScroll}
      className="relative flex items-center justify-center w-full h-full md:py-3 md:px-6 bg-black md:bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none transition-colors"
    >
      {/* Floating Toast */}
      {toastMsg && (
        <div className="fixed top-14 md:top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#212121]/95 text-white px-4 py-2 text-xs font-semibold shadow-xl border border-white/15 backdrop-blur-md animate-in fade-in duration-150 whitespace-nowrap">
          {toastMsg}
        </div>
      )}

      {/* Main Center Reels Stage */}
      <div className="relative flex items-center justify-center md:gap-5 w-full h-full md:w-auto">
        {/* Vertical Scroll-Snap Shorts Viewport (Edge-to-edge on mobile, crisp 9:16 card on desktop) */}
        <div className="relative w-full h-full md:w-auto md:h-[calc(100%-0.5rem)] md:max-h-[820px] md:aspect-[9/16] md:max-w-[calc(100vw-11rem)] md:rounded-2xl overflow-hidden bg-black md:shadow-2xl md:border md:border-[var(--ink-faint)]">
          {/* Persistent Top Overlay Header (YouTube Shorts style) */}
          {!clearScreen && (
            <div className="absolute top-0 inset-x-0 z-30 px-3 pt-2.5 pb-6 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
                <button
                  type="button"
                  onClick={onNavigateHome}
                  aria-label="Back to Home"
                  className="flex md:hidden h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/15 active:scale-95 transition-all shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-base tracking-tight text-white shrink-0">
                  <Sparkles className="h-4 w-4 text-[#FF0000] fill-[#FF0000]" />
                  <span>Reels</span>
                </div>

                <div className="flex items-center gap-0.5 bg-white/15 backdrop-blur-md rounded-full p-0.5 ml-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('feed')}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                      viewMode === 'feed'
                        ? 'bg-[#FF0000] text-white'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Feed
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('series')}
                    className={`flex items-center gap-1 min-h-[28px] px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                      viewMode === 'series'
                        ? 'bg-[#FF0000] text-white'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <Layers className="h-3 w-3" />
                    <span>Series</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                {onOpenUpload && (
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    title="Upload Reel"
                    aria-label="Upload Reel"
                    className="flex items-center justify-center gap-1 h-10 min-w-[40px] px-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-md transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Create</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-md transition-all active:scale-95"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setMoreMenuOpen(true)}
                  aria-label="More options"
                  title="More options"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-md transition-all active:scale-95"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Smooth Vertical Snap Feed Track */}
          <div
            ref={scrollFeedRef}
            className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar overscroll-y-contain"
          >
            {reels.map((reel, idx) => {
              const isActive = idx === activeIndex;
              const isNear = Math.abs(idx - activeIndex) <= 1;
              const slideChannel = channels[reel.channelId];
              const slideFollowing = slideChannel?.isSubscribed ?? false;
              const slideComments = commentsMap[reel.id] || [];
              const slideVideoSrc = isActive
                ? isReelHlsActive
                  ? undefined
                  : resolvedReelSrc || sanitizePlayableVideoUrl(reel.videoUrl, reel.id, 'reel', false)
                : sanitizePlayableVideoUrl(reel.videoUrl, reel.id, 'reel', false);

              return (
                <div
                  key={reel.id}
                  data-reel-index={idx}
                  ref={(el) => {
                    slideRefs.current[idx] = el;
                  }}
                  className="relative w-full h-full snap-start snap-always shrink-0 overflow-hidden bg-black flex items-center justify-center"
                >
                  {/* Ambient Soft Glow Layer (eliminates harsh letterbox black bars) */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <img
                      src={reel.poster || FALLBACK_POSTER}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover blur-3xl opacity-60 scale-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/55" />
                  </div>

                  {/* Render active/adjacent <video> for fluid transitions */}
                  {isNear ? (
                    <video
                      ref={isActive ? activeVideoElRef : undefined}
                      src={slideVideoSrc}
                      poster={reel.poster || FALLBACK_POSTER}
                      loop
                      muted={isActive ? isMuted : true}
                      playsInline
                      preload={isActive ? 'auto' : 'metadata'}
                      onLoadedMetadata={(e) => {
                        const vw = e.currentTarget.videoWidth;
                        const vh = e.currentTarget.videoHeight;
                        if (vw > 0 && vh > 0) {
                          setVideoRatios((prev) => ({
                            ...prev,
                            [reel.id]: vw / vh,
                          }));
                        }
                      }}
                      onTimeUpdate={(e) => handleTimeUpdate(reel.id, e)}
                      onClick={() => handleVideoClick(reel)}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.dataset.fallbackApplied === 'true') return;
                        if (target.src !== FALLBACK_REEL_SRC) {
                          target.dataset.fallbackApplied = 'true';
                          target.src = FALLBACK_REEL_SRC;
                          target.load();
                          if (isActive) target.play().catch(() => {});
                        }
                      }}
                      className={`relative z-10 w-full h-full cursor-pointer transition-all duration-200 ${resolveObjectFitClass(
                        reel.id
                      )}`}
                    />
                  ) : (
                    <img
                      src={reel.poster || FALLBACK_POSTER}
                      alt={reel.title}
                      referrerPolicy="no-referrer"
                      className="relative z-10 w-full h-full object-cover"
                    />
                  )}

                  {/* Center Play/Pause Flash */}
                  {isActive && playIndicator && (
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

                  {/* Double-tap Heart Animation */}
                  {isActive && showHeartAnimation && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in zoom-in-75 fade-out duration-700">
                      <Heart className="h-24 w-24 text-[#FF0000] fill-[#FF0000] drop-shadow-2xl scale-125 transition-transform" />
                    </div>
                  )}

                  {/* Clear Screen Restore Pill */}
                  {isActive && clearScreen && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClearScreen(false);
                      }}
                      className="absolute bottom-5 right-4 z-40 flex items-center gap-1.5 rounded-full bg-black/65 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md border border-white/20 hover:bg-black/80"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Show controls</span>
                    </button>
                  )}

                  {/* Bottom-Left Creator & Title Overlay (clean YouTube Shorts spacing, zero collision with right rail) */}
                  {!clearScreen && (
                    <div className="absolute bottom-0 inset-x-0 px-3.5 sm:px-4 pt-16 pb-4 pr-[4.5rem] md:pr-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-20 space-y-2">
                      <div className="flex items-center gap-2 pointer-events-auto min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (slideChannel) onSelectChannel(slideChannel.id);
                          }}
                          className="flex items-center gap-2 min-w-0 group text-left"
                        >
                          <img
                            src={slideChannel?.avatar || reel.poster || FALLBACK_AVATAR}
                            alt={slideChannel?.name || 'Creator'}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              if (e.currentTarget.src !== FALLBACK_AVATAR) {
                                e.currentTarget.src = FALLBACK_AVATAR;
                              }
                            }}
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/50 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-sm text-white truncate drop-shadow-sm group-hover:underline">
                                {slideChannel?.handle || slideChannel?.name || '@creator'}
                              </span>
                              {slideChannel?.verified && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-white/90 shrink-0" />
                              )}
                            </div>
                          </div>
                        </button>

                        {slideChannel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFollow(slideChannel.id);
                            }}
                            className={`min-h-[32px] rounded-full px-3.5 py-1 text-xs font-bold transition-all shrink-0 active:scale-95 ${
                              slideFollowing
                                ? 'bg-white/20 text-white border border-white/25 hover:bg-white/30 backdrop-blur-md'
                                : 'bg-white text-black hover:bg-white/90 shadow-sm'
                            }`}
                          >
                            {slideFollowing ? 'Following' : 'Follow'}
                          </button>
                        )}
                      </div>

                      {/* Tappable Title -> Opens Description Sheet */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDescriptionOpen(true);
                        }}
                        className="pointer-events-auto block w-full text-left text-white drop-shadow-sm"
                      >
                        <p className="font-semibold text-[13px] sm:text-sm text-white/95 line-clamp-2 leading-snug">
                          {reel.title}
                        </p>
                      </button>

                      {/* Audio Track Line */}
                      <div className="flex items-center gap-1.5 text-white/85 text-[11px] font-medium min-w-0">
                        <Music className="h-3 w-3 text-white/90 shrink-0" />
                        <span className="truncate">{reel.audioTrack}</span>
                      </div>
                    </div>
                  )}

                  {/* Mobile Inside-Right Action Rail (YouTube Shorts ergonomic bottom-right stack) */}
                  {!clearScreen && (
                    <div className="md:hidden absolute right-2.5 bottom-4 z-30 flex flex-col items-center gap-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLikeReel(reel.id);
                          }}
                          aria-label={reel.userLiked ? 'Unlike' : 'Like'}
                          className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 ${
                            reel.userLiked
                              ? 'bg-[#FF0000] text-white shadow-lg shadow-red-600/30'
                              : 'bg-black/45 text-white'
                          }`}
                        >
                          <Heart className={`h-5 w-5 ${reel.userLiked ? 'fill-white' : ''}`} />
                        </button>
                        <span className="text-[11px] font-semibold text-white tabular-nums drop-shadow">
                          {formatReelLikes(reel.likes)}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCommentsOpen(true);
                          }}
                          aria-label="Comments"
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-all active:scale-90"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </button>
                        <span className="text-[11px] font-semibold text-white tabular-nums drop-shadow">
                          {formatReelLikes(Math.max(reel.commentsCount || 0, slideComments.length))}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSaveReel(reel.id);
                          }}
                          aria-label={reel.userSaved ? 'Saved' : 'Save'}
                          className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 ${
                            reel.userSaved
                              ? 'bg-amber-400 text-[#0c0c0e]'
                              : 'bg-black/45 text-white'
                          }`}
                        >
                          <Bookmark className={`h-5 w-5 ${reel.userSaved ? 'fill-[#0c0c0e]' : ''}`} />
                        </button>
                        <span className="text-[11px] font-semibold text-white drop-shadow">
                          {reel.userSaved ? 'Saved' : 'Save'}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare();
                          }}
                          aria-label="Share reel"
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-all active:scale-90"
                        >
                          <Share2 className="h-5 w-5" />
                        </button>
                        <span className="text-[11px] font-semibold text-white drop-shadow">
                          Share
                        </span>
                      </div>

                      {/* Spinning Audio Disc */}
                      <div
                        className={`h-9 w-9 rounded-lg bg-[#181818] border border-white/30 flex items-center justify-center overflow-hidden ${
                          isActive && isPlaying ? 'animate-spin' : ''
                        }`}
                        style={{ animationDuration: '5s' }}
                      >
                        <Disc className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Seekable Progress Bar Flush at Bottom */}
          {!clearScreen && (
            <div
              onClick={handleSeekBarClick}
              title="Click to seek"
              className="absolute bottom-0 inset-x-0 h-2.5 flex items-end cursor-pointer z-30 group"
            >
              <div className="w-full h-[3px] group-hover:h-1.5 bg-white/25 transition-all">
                <div
                  className="h-full bg-[#FF0000] transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Side Action Rail (md+ screens) */}
        <div className="hidden md:flex flex-col items-center gap-4 pb-2 z-30">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleLikeReel(activeReel.id)}
              aria-label={activeReel.userLiked ? 'Unlike' : 'Like'}
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all active:scale-90 ${
                activeReel.userLiked
                  ? 'bg-[#FF0000] text-white border-[#FF0000] shadow-lg shadow-red-600/25'
                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--ink-faint)] hover:bg-[var(--card-hover)]'
              }`}
            >
              <Heart className={`h-5 w-5 ${activeReel.userLiked ? 'fill-white' : ''}`} />
            </button>
            <span className="text-xs font-semibold text-[var(--ink-medium)] tabular-nums">
              {formatReelLikes(activeReel.likes)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              aria-label="Comments"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] border border-[var(--ink-faint)] hover:bg-[var(--card-hover)] transition-all active:scale-90"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <span className="text-xs font-semibold text-[var(--ink-medium)] tabular-nums">
              {formatReelLikes(Math.max(activeReel.commentsCount || 0, activeComments.length))}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleSaveReel(activeReel.id)}
              aria-label={activeReel.userSaved ? 'Saved' : 'Save'}
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all active:scale-90 ${
                activeReel.userSaved
                  ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--ink-faint)] hover:bg-[var(--card-hover)]'
              }`}
            >
              <Bookmark className={`h-5 w-5 ${activeReel.userSaved ? 'fill-current' : ''}`} />
            </button>
            <span className="text-xs font-semibold text-[var(--ink-medium)]">
              {activeReel.userSaved ? 'Saved' : 'Save'}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share reel"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] border border-[var(--ink-faint)] hover:bg-[var(--card-hover)] transition-all active:scale-90"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <span className="text-xs font-semibold text-[var(--ink-medium)]">Share</span>
          </div>

          <button
            type="button"
            onClick={() => setMoreMenuOpen(true)}
            aria-label="More options"
            title="More options"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] border border-[var(--ink-faint)] hover:bg-[var(--card-hover)] transition-all"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {/* Desktop Up/Down Navigation */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--ink-faint)]">
            <button
              type="button"
              onClick={handlePrevReel}
              title="Previous Reel (Up Arrow)"
              aria-label="Previous Reel"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] border border-[var(--ink-faint)] hover:bg-[var(--card-hover)] transition-all"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNextReel}
              title="Next Reel (Down Arrow)"
              aria-label="Next Reel"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] border border-[var(--ink-faint)] hover:bg-[var(--card-hover)] transition-all"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* YOUTUBE SHORTS 3-DOT MORE ACTION SHEET */}
      {moreMenuOpen && (
        <div
          onClick={() => setMoreMenuOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[var(--surface-elevated)] text-[var(--ink)] border border-[var(--ink-faint)] p-2 pb-5 sm:pb-3 shadow-2xl animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--ink-medium)]/30 mx-auto my-2 sm:hidden" />

            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setDescriptionOpen(true);
                }}
                className="flex w-full items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] text-sm font-medium transition-colors"
              >
                <AlignLeft className="h-5 w-5 text-[var(--ink)]" />
                <span>Description</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setClearScreen((prev) => !prev);
                }}
                className="flex w-full items-center justify-between px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-4">
                  <EyeOff className="h-5 w-5 text-[var(--ink)]" />
                  <span>Clear screen</span>
                </div>
                {clearScreen && <Check className="h-4 w-4 text-[#FF0000]" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCycleFitMode();
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center justify-between px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-4">
                  {fitMode === 'cover' ? (
                    <Maximize2 className="h-5 w-5 text-[var(--ink)]" />
                  ) : (
                    <Minimize2 className="h-5 w-5 text-[var(--ink)]" />
                  )}
                  <span>Screen framing</span>
                </div>
                <span className="text-xs text-[var(--ink-medium)] capitalize">
                  {fitMode === 'auto' ? 'Auto' : fitMode === 'contain' ? 'Fit (No crop)' : 'Fill'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const speeds = [0.5, 1, 1.25, 1.5, 2];
                  const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                  setPlaybackSpeed(next);
                  showToast(`Playback speed: ${next}x`);
                }}
                className="flex w-full items-center justify-between px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Gauge className="h-5 w-5 text-[var(--ink)]" />
                  <span>Playback speed</span>
                </div>
                <span className="text-xs font-mono text-[var(--ink-medium)]">{playbackSpeed}x</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  handleShare();
                }}
                className="flex w-full items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] text-sm font-medium transition-colors"
              >
                <Share2 className="h-5 w-5 text-[var(--ink)]" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setReportModalMode('report');
                }}
                className="flex w-full items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] text-sm font-medium transition-colors cursor-pointer"
              >
                <Flag className="h-5 w-5 text-[var(--ink)]" />
                <span>Report</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setReportModalMode('feedback');
                }}
                className="flex w-full items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[var(--card-hover)] text-sm font-medium transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="h-5 w-5 text-[var(--ink)]" />
                <span>Send feedback</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YOUTUBE SHORTS DESCRIPTION BOTTOM SHEET */}
      {descriptionOpen && (
        <div
          onClick={() => setDescriptionOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[75vh] rounded-t-3xl sm:rounded-3xl bg-[var(--surface-elevated)] text-[var(--ink)] border border-[var(--ink-faint)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--ink-medium)]/30 mx-auto mt-2.5 sm:hidden" />

            {/* Sheet Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[var(--ink-faint)]">
              <h3 className="text-base sm:text-lg font-bold text-[var(--ink)] leading-snug">
                {activeReel.title}
              </h3>
              <button
                type="button"
                onClick={() => setDescriptionOpen(false)}
                aria-label="Close description"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Creator Info */}
              {activeChannel && (
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionOpen(false);
                      onSelectChannel(activeChannel.id);
                    }}
                    className="flex items-center gap-2.5 min-w-0 text-left"
                  >
                    <img
                      src={activeChannel.avatar || FALLBACK_AVATAR}
                      alt={activeChannel.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_AVATAR) {
                          e.currentTarget.src = FALLBACK_AVATAR;
                        }
                      }}
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm text-[var(--ink)] truncate">
                          {activeChannel.name}
                        </span>
                        {activeChannel.verified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-ink)] shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-[var(--ink-medium)] truncate block">
                        {activeChannel.handle}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleFollow(activeChannel.id)}
                    className={`min-h-[36px] rounded-full px-4 py-1.5 text-xs font-bold shrink-0 transition-all ${
                      isFollowing
                        ? 'bg-[var(--card-hover)] text-[var(--ink)]'
                        : 'bg-[#FF0000] text-white hover:bg-[#CC0000]'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              )}

              {/* 3-Column Metrics Row (YouTube Shorts style) */}
              <div className="grid grid-cols-3 gap-3 text-center py-2">
                <div>
                  <div className="text-lg font-extrabold text-[var(--ink)] tabular-nums">
                    {formatReelLikes(activeReel.likes)}
                  </div>
                  <div className="text-xs text-[var(--ink-medium)]">Likes</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-[var(--ink)] tabular-nums">
                    {formatViews(activeReel.views).replace(' views', '')}
                  </div>
                  <div className="text-xs text-[var(--ink-medium)]">Views</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-[var(--ink)]">
                    {activeReel.createdAt || '2026'}
                  </div>
                  <div className="text-xs text-[var(--ink-medium)]">Published</div>
                </div>
              </div>

              {/* Description Text Card */}
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--ink-faint)] p-4 text-sm text-[var(--ink)] leading-relaxed space-y-3">
                <p>{activeReel.description}</p>
                {activeReel.tags && activeReel.tags.length > 0 && (
                  <p className="text-xs text-[var(--accent-ink)] font-medium">
                    {activeReel.tags.map((t) => `#${t.replace(/\s+/g, '')}`).join(' ')}
                  </p>
                )}
                <div className="pt-2 border-t border-[var(--ink-faint)] flex items-center gap-2 text-xs text-[var(--ink-medium)]">
                  <Music className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{activeReel.audioTrack}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div className="w-10 h-1 rounded-full bg-[var(--ink-medium)]/30 mx-auto mt-2.5 sm:hidden" />
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--ink-faint)]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[var(--ink)] text-sm">Comments</h3>
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
                        if (e.currentTarget.src !== FALLBACK_AVATAR) {
                          e.currentTarget.src = FALLBACK_AVATAR;
                        }
                      }}
                      className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-[var(--ink-faint)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--ink)]">{comment.authorName}</span>
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
                          <Heart
                            className={`h-3.5 w-3.5 ${comment.userLiked ? 'fill-[#FF0000]' : ''}`}
                          />
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

      {/* SHORTS SERIES PLAYLIST GROUPING MODAL */}
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
                            if (e.currentTarget.src !== FALLBACK_AVATAR) {
                              e.currentTarget.src = FALLBACK_AVATAR;
                            }
                          }}
                          className="h-9 w-9 rounded-full object-cover ring-2 ring-[#FF0000]/30"
                        />
                        <div>
                          <h4 className="font-bold text-sm text-[var(--ink)] flex flex-wrap items-center gap-2">
                            {series.title}
                            <span className="text-xs text-[var(--ink-medium)] font-normal">
                              · {seriesReels.length} Episodes
                            </span>
                          </h4>
                          <p className="text-[11px] text-[var(--ink-medium)]">
                            {series.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const firstIdx = reels.findIndex((r) => series.reelIds.includes(r.id));
                          if (firstIdx !== -1) scrollToReel(firstIdx, true);
                          setViewMode('feed');
                        }}
                        className="flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white text-xs font-bold transition-all shadow-md shadow-[#FF0000]/25 shrink-0 self-start sm:self-auto cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        <span>Play All</span>
                      </button>
                    </div>

                    {/* Horizontal Playlist Strip */}
                    <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar pt-1">
                      {seriesReels.map((reel, epIndex) => (
                        <div
                          key={reel.id}
                          onClick={() => {
                            const idx = reels.findIndex((r) => r.id === reel.id);
                            if (idx !== -1) scrollToReel(idx, true);
                            setViewMode('feed');
                          }}
                          className="group relative cursor-pointer shrink-0 transition-transform hover:scale-105"
                        >
                          <div className="relative w-[132px] h-[132px] sm:w-[150px] sm:h-[150px] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 group-hover:ring-[#FF0000] transition-all shadow-md">
                            <img
                              src={reel.poster || FALLBACK_POSTER}
                              alt={reel.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (e.currentTarget.src !== FALLBACK_POSTER) {
                                  e.currentTarget.src = FALLBACK_POSTER;
                                }
                              }}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                            <div className="absolute top-2 left-2 rounded-md bg-black/70 backdrop-blur-xs px-2 py-0.5 text-[10px] font-mono font-bold text-white">
                              Ep. {epIndex + 1}
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="h-10 w-10 rounded-full bg-[#FF0000] text-white flex items-center justify-center shadow-lg">
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

      {/* Reel Report & Feedback Modal */}
      {activeReel && (
        <ReportModal
          isOpen={reportModalMode !== null}
          onClose={() => setReportModalMode(null)}
          targetId={activeReel.id}
          targetType="reel"
          targetTitle={activeReel.title}
          mode={reportModalMode || 'report'}
        />
      )}
    </div>
  );
};
