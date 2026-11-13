import React, { useState, useRef, useEffect } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Clock,
  Sliders,
  CheckCircle2,
  Bell,
  BellRing,
  BellOff,
  Sparkles,
  Download,
  Check,
  Maximize2,
  Info
} from 'lucide-react';
import { VideoItem, Channel, Comment, VideoFilters, AspectRatioMode, Bookmark } from '../types/video';
import { VideoPlayer } from './VideoPlayer';
import { CommentSection } from './CommentSection';
import { BookmarksPanel } from './BookmarksPanel';
import { ShareModal } from './ShareModal';
import { formatTime } from '../utils/formatTime';
import { formatViews, formatSubscribers } from '../data/mockData';

interface WatchViewProps {
  video: VideoItem;
  channel?: Channel;
  recommendedVideos: VideoItem[];
  channels: Record<string, Channel>;
  comments: Comment[];
  onPlayVideo: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onToggleSubscribe: (channelId: string) => void;
  onUpdateNotificationBell: (channelId: string, bell: 'all' | 'personalized' | 'none') => void;
  onToggleLike: (videoId: string) => void;
  onToggleDislike: (videoId: string) => void;
  onToggleWatchLater: (videoId: string) => void;
  isWatchLater: boolean;
  onAddComment: (videoId: string, content: string) => void;
  onLikeComment: (commentId: string) => void;
  onDislikeComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onAddReply: (commentId: string, content: string) => void;
  userAvatar?: string;
  currentUserHandle?: string;
  bookmarks: Bookmark[];
  onAddBookmark: (time: number, thumbnailUrl?: string) => void;
  onDeleteBookmark?: (id: string) => void;
  onUpdateBookmarkLabel?: (id: string, label: string) => void;
  onClearAllBookmarks?: () => void;
  onOpenFilters: () => void;
  onOpenInfo: () => void;
  filters: VideoFilters;
  aspectRatio: AspectRatioMode;
  setAspectRatio: (mode: AspectRatioMode) => void;
  initialSeekTime?: number | null;
  ambientMode?: boolean;
}

export const WatchView: React.FC<WatchViewProps> = ({
  video,
  channel,
  recommendedVideos,
  channels,
  comments,
  onPlayVideo,
  onSelectChannel,
  onToggleSubscribe,
  onUpdateNotificationBell,
  onToggleLike,
  onToggleDislike,
  onToggleWatchLater,
  isWatchLater,
  onAddComment,
  onLikeComment,
  onDislikeComment,
  onDeleteComment,
  onAddReply,
  userAvatar,
  currentUserHandle,
  bookmarks,
  onAddBookmark,
  onDeleteBookmark,
  onUpdateBookmarkLabel,
  onClearAllBookmarks,
  onOpenFilters,
  onOpenInfo,
  filters,
  aspectRatio,
  setAspectRatio,
  initialSeekTime = null,
  ambientMode = false,
}) => {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(() => {
    const saved = localStorage.getItem('vio_pref_autoplay');
    return saved === null ? true : saved === 'true';
  });
  const [liveTime, setLiveTime] = useState<number>(0);
  const [seekTime, setSeekTime] = useState<number | null>(initialSeekTime);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarFailed(false);
  }, [channel?.avatar]);

  useEffect(() => {
    setSeekTime(initialSeekTime);
    setLiveTime(0);
  }, [video.id, initialSeekTime]);

  useEffect(() => {
    if (!bellDropdownOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [bellDropdownOpen]);

  const isSubscribed = channel?.isSubscribed ?? false;
  const bellSetting = channel?.notificationBell ?? 'none';

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const nextVideo = recommendedVideos[0];

  return (
    <div className="mx-auto max-w-[1720px] px-3 sm:px-6 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Column: Player, Info, Channel, Actions, Comments */}
        <div className="lg:col-span-8 space-y-4">
          {/* Custom Cinema Player */}
          <div className="relative overflow-visible rounded-xl sm:rounded-2xl bg-black shadow-2xl">
            <VideoPlayer
              video={video}
              bookmarks={bookmarks}
              onAddBookmark={onAddBookmark}
              onOpenFilters={onOpenFilters}
              onOpenInfo={onOpenInfo}
              filters={filters}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              onNextVideo={() => nextVideo && onPlayVideo(nextVideo)}
              hasNextVideo={autoplayNext && !!nextVideo}
              externalSeekTime={seekTime}
              onExternalSeekConsumed={() => setSeekTime(null)}
              onTimeUpdate={setLiveTime}
              ambientMode={ambientMode}
            />
          </div>

          {/* Video Title */}
          <h1 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)] leading-snug">
            {video.title}
          </h1>

          {/* Channel Row & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            {/* Channel Lockup */}
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <button
                onClick={() => channel && onSelectChannel(channel.id)}
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden shrink-0 ring-1 ring-[var(--ink-faint)] hover:opacity-90 transition-opacity bg-[var(--surface)]"
              >
                {channel?.avatar && !avatarFailed ? (
                  <img
                    src={channel.avatar}
                    alt={channel.name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#FF0000] text-sm font-bold text-white uppercase">
                    {(channel?.name || video.title).charAt(0)}
                  </div>
                )}
              </button>

              <div className="min-w-0">
                <button
                  onClick={() => channel && onSelectChannel(channel.id)}
                  className="flex items-center gap-1 text-sm font-bold text-[var(--ink)] hover:text-[var(--accent-ink)] transition-colors"
                >
                  <span className="truncate">{channel?.name || 'Creator'}</span>
                  {channel?.verified && (
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent-ink)] shrink-0" />
                  )}
                </button>
                <div className="text-xs text-[var(--ink-medium)]">
                  {channel ? formatSubscribers(channel.subscribersCount) : '100K followers'}
                </div>
              </div>

              {/* Follow Button & Bell Dropdown */}
              <div ref={bellRef} className="relative ml-1 sm:ml-3 flex items-center">
                {isSubscribed ? (
                  <div className="flex items-center rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-0.5">
                    <button
                      onClick={() => channel && onToggleSubscribe(channel.id)}
                      className="min-h-[38px] rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
                    >
                      Following
                    </button>
                    <button
                      onClick={() => setBellDropdownOpen(!bellDropdownOpen)}
                      aria-label="Notification preferences"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] transition-colors"
                    >
                      {bellSetting === 'all' ? (
                        <BellRing className="h-4 w-4 text-[var(--accent-ink)]" />
                      ) : bellSetting === 'personalized' ? (
                        <Bell className="h-4 w-4" />
                      ) : (
                        <BellOff className="h-4 w-4 text-[var(--ink-medium)]" />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => channel && onToggleSubscribe(channel.id)}
                    className="min-h-[40px] rounded-full bg-[#FF0000] px-4 py-2 text-xs font-bold text-white hover:bg-[#CC0000] active:scale-95 transition-all"
                  >
                    Follow
                  </button>
                )}

                {/* Bell Menu */}
                {bellDropdownOpen && isSubscribed && (
                  <div className="absolute left-0 top-12 z-40 w-44 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] p-1.5 shadow-2xl transition-all text-xs text-[var(--ink)]">
                    <button
                      onClick={() => {
                        channel && onUpdateNotificationBell(channel.id, 'all');
                        setBellDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between min-h-[36px] px-3 py-2 rounded-xl hover:bg-[var(--card-hover)]"
                    >
                      <div className="flex items-center gap-2">
                        <BellRing className="h-4 w-4 text-[var(--accent-ink)]" />
                        <span>All</span>
                      </div>
                      {bellSetting === 'all' && <Check className="h-3.5 w-3.5 text-[var(--accent-ink)]" />}
                    </button>
                    <button
                      onClick={() => {
                        channel && onUpdateNotificationBell(channel.id, 'personalized');
                        setBellDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between min-h-[36px] px-3 py-2 rounded-xl hover:bg-[var(--card-hover)]"
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        <span>Personalized</span>
                      </div>
                      {bellSetting === 'personalized' && <Check className="h-3.5 w-3.5 text-[var(--accent-ink)]" />}
                    </button>
                    <button
                      onClick={() => {
                        channel && onUpdateNotificationBell(channel.id, 'none');
                        setBellDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between min-h-[36px] px-3 py-2 rounded-xl hover:bg-[var(--card-hover)]"
                    >
                      <div className="flex items-center gap-2">
                        <BellOff className="h-4 w-4 text-[var(--ink-medium)]" />
                        <span>None</span>
                      </div>
                      {bellSetting === 'none' && <Check className="h-3.5 w-3.5 text-[var(--accent-ink)]" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Video Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Like / Dislike Split Pill */}
              <div className="flex items-center rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-0.5">
                <button
                  onClick={() => onToggleLike(video.id)}
                  className={`flex items-center gap-1.5 min-h-[38px] rounded-l-full px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--card-hover)] transition-colors ${
                    video.userLiked ? 'text-[var(--accent-ink)] font-bold' : 'text-[var(--ink)]'
                  }`}
                >
                  <ThumbsUp className={`h-4 w-4 ${video.userLiked ? 'fill-current' : ''}`} />
                  <span className="tabular-nums">
                    {video.hideLikes
                      ? (video.userLiked ? 'Liked' : 'Like')
                      : (video.likes + (video.userLiked ? 1 : 0)).toLocaleString()}
                  </span>
                </button>
                <div className="h-4 w-px bg-[var(--ink-faint)]" />
                <button
                  onClick={() => onToggleDislike(video.id)}
                  aria-label="Dislike"
                  className={`min-h-[38px] min-w-[40px] flex items-center justify-center rounded-r-full px-3 py-1.5 text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors ${
                    video.userDisliked ? 'text-rose-500' : ''
                  }`}
                >
                  <ThumbsDown className={`h-4 w-4 ${video.userDisliked ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 min-h-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>

              {/* Save to Watch Later */}
              <button
                onClick={() => onToggleWatchLater(video.id)}
                title="Save to Watch Later"
                className={`flex items-center gap-1.5 min-h-[40px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors border ${
                  isWatchLater
                    ? 'bg-[#FF0000] text-white border-[#FF0000] font-bold'
                    : 'bg-[var(--surface)] border-[var(--ink-faint)] text-[var(--ink)] hover:bg-[var(--card-hover)]'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>{isWatchLater ? 'Saved' : 'Save'}</span>
              </button>

              {/* Color Adjustments */}
              <button
                onClick={onOpenFilters}
                title="Color Grading"
                aria-label="Color Grading"
                className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-2 text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
              >
                <Sliders className="h-4 w-4" />
              </button>

              {/* Technical Video Info */}
              <button
                onClick={onOpenInfo}
                title="Video Technical Specs & Codecs"
                aria-label="Video Technical Specs"
                className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-2 text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Description Card (Expandable) */}
          <div
            onClick={() => setDescriptionExpanded(!descriptionExpanded)}
            className="cursor-pointer rounded-2xl bg-[var(--surface)] border border-[var(--ink-faint)] p-4 transition-colors hover:border-[var(--ink-medium)]/30"
          >
            {/* Clean Unboxed Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--ink)]">
              <span>{formatViews(video.views)}</span>
              <span aria-hidden="true">·</span>
              <span>Published {video.publishedAt}</span>
              {video.category && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--accent-ink)]">#{video.category}</span>
                </>
              )}
            </div>

            <p className={`mt-2 text-sm text-[var(--ink)]/85 leading-relaxed ${
              descriptionExpanded ? '' : 'line-clamp-2'
            }`}>
              {video.description}
            </p>

            {video.tags && video.tags.length > 0 && descriptionExpanded && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--accent-ink)]">
                {video.tags.map((tag) => (
                  <span key={tag}>#{tag.replace(/\s+/g, '')}</span>
                ))}
              </div>
            )}

            <button className="mt-2 text-xs font-bold text-[var(--ink)]">
              {descriptionExpanded ? 'Show less' : '...more'}
            </button>
          </div>

          {/* Interactive Working Comments Section */}
          <CommentSection
            videoId={video.id}
            comments={comments}
            onAddComment={onAddComment}
            onLikeComment={onLikeComment}
            onDislikeComment={onDislikeComment}
            onDeleteComment={onDeleteComment}
            onAddReply={onAddReply}
            userAvatar={userAvatar}
            currentUserHandle={currentUserHandle}
            disabled={video.commentsControl === 'disabled'}
          />
        </div>

        {/* Right Column: Bookmarks & Up Next / Recommended Videos */}
        <div className="lg:col-span-4 space-y-4">
          <BookmarksPanel
            bookmarks={bookmarks}
            currentVideoId={video.id}
            onJumpToTime={(time) => setSeekTime(time)}
            onDeleteBookmark={(id) => onDeleteBookmark?.(id)}
            onUpdateBookmarkLabel={(id, label) => onUpdateBookmarkLabel?.(id, label)}
            onClearAllBookmarks={() => onClearAllBookmarks?.()}
          />

          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-bold text-[var(--ink)] uppercase tracking-wider font-mono">
              Up Next
            </h3>
            <label className="flex items-center gap-2 text-xs text-[var(--ink-medium)] cursor-pointer">
              <span>Autoplay</span>
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAutoplayNext(next);
                  localStorage.setItem('vio_pref_autoplay', String(next));
                }}
                className="h-3.5 w-3.5 rounded accent-[#FF0000]"
              />
            </label>
          </div>

          <div className="space-y-3">
            {recommendedVideos.map((rec) => {
              const recChannel = channels[rec.channelId];
              return (
                <div
                  key={rec.id}
                  onClick={() => onPlayVideo(rec)}
                  className="group flex gap-3 rounded-xl p-1.5 transition-colors hover:bg-[var(--surface)] cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-36 sm:w-40 shrink-0 overflow-hidden rounded-xl bg-black border border-[var(--ink-faint)]">
                    <img
                      src={rec.poster}
                      alt={rec.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        const fallback = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80';
                        if (target.src !== fallback) target.src = fallback;
                      }}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-1 right-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-white">
                      {formatTime(rec.duration)}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <h4 className="line-clamp-2 text-xs font-bold text-[var(--ink)] group-hover:text-[var(--accent-ink)] transition-colors leading-snug">
                      {rec.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-[var(--ink-medium)] truncate">
                      {recChannel?.name || 'Creator'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--ink-medium)]">
                      <span>{formatViews(rec.views)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{rec.publishedAt}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Share & Copy Link Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        video={video}
        currentTime={liveTime}
      />
    </div>
  );
};
