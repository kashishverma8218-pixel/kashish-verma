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
  Info,
  ListPlus,
  Flag,
  RotateCcw,
  Plus
} from 'lucide-react';
import { VideoItem, Channel, Comment, VideoFilters, AspectRatioMode, Bookmark, PlaylistItem } from '../types/video';
import { VideoPlayer } from './VideoPlayer';
import { CommentSection } from './CommentSection';
import { BookmarksPanel } from './BookmarksPanel';
import { ShareModal } from './ShareModal';
import { ReportModal } from './ReportModal';
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
  currentUserId?: string;
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
  savedProgressSeconds?: number;
  onWatchProgress?: (video: VideoItem, seconds: number) => void;
  playlists?: PlaylistItem[];
  onToggleVideoInPlaylist?: (playlistId: string, videoId: string) => void;
  onCreatePlaylist?: (title: string, initialVideoId?: string) => void;
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
  currentUserId,
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
  savedProgressSeconds = 0,
  onWatchProgress,
  playlists = [],
  onToggleVideoInPlaylist,
  onCreatePlaylist,
  ambientMode = false,
}) => {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPlaylistPopoverOpen, setIsPlaylistPopoverOpen] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [autoplayNext, setAutoplayNext] = useState<boolean>(() => {
    const saved = localStorage.getItem('vio_pref_autoplay');
    return saved === null ? true : saved === 'true';
  });
  const [liveTime, setLiveTime] = useState<number>(0);

  // Resume from saved watch history (>10s and <92% duration) if no explicit deep-link seek
  const shouldAutoResume =
    initialSeekTime === null &&
    savedProgressSeconds > 10 &&
    savedProgressSeconds < Math.max(20, (video.duration || 120) * 0.92);

  const [resumedFromSec, setResumedFromSec] = useState<number | null>(() =>
    shouldAutoResume ? Math.floor(savedProgressSeconds) : null
  );
  const [seekTime, setSeekTime] = useState<number | null>(() =>
    initialSeekTime !== null
      ? initialSeekTime
      : shouldAutoResume
      ? Math.floor(savedProgressSeconds)
      : null
  );
  const [avatarFailed, setAvatarFailed] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const lastSavedTimeRef = useRef<number>(0);

  useEffect(() => {
    setAvatarFailed(false);
  }, [channel?.avatar]);

  useEffect(() => {
    const autoResume =
      initialSeekTime === null &&
      savedProgressSeconds > 10 &&
      savedProgressSeconds < Math.max(20, (video.duration || 120) * 0.92);

    setResumedFromSec(autoResume ? Math.floor(savedProgressSeconds) : null);
    setSeekTime(
      initialSeekTime !== null
        ? initialSeekTime
        : autoResume
        ? Math.floor(savedProgressSeconds)
        : null
    );
    setLiveTime(0);
    lastSavedTimeRef.current = 0;
  }, [video.id, initialSeekTime]);

  const handlePlayerTimeUpdate = (seconds: number) => {
    setLiveTime(seconds);
    if (onWatchProgress && Math.abs(seconds - lastSavedTimeRef.current) >= 5) {
      lastSavedTimeRef.current = seconds;
      onWatchProgress(video, Math.floor(seconds));
    }
  };

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
              onTimeUpdate={handlePlayerTimeUpdate}
              ambientMode={ambientMode}
            />
          </div>

          {resumedFromSec !== null && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] px-3.5 py-2 text-xs">
              <span className="text-[var(--ink-medium)] tabular-nums">
                Resumed where you left off at <strong className="text-[var(--ink)]">{formatTime(resumedFromSec)}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSeekTime(0);
                  setResumedFromSec(null);
                }}
                className="inline-flex items-center gap-1 font-semibold text-[var(--link)] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Start over</span>
              </button>
            </div>
          )}

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
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5 w-full lg:w-auto">
              {/* Like / Dislike Split Pill */}
              <div className="flex items-center shrink-0 rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-0.5">
                <button
                  onClick={() => onToggleLike(video.id)}
                  className={`flex items-center gap-1.5 min-h-[38px] rounded-l-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap hover:bg-[var(--card-hover)] transition-colors ${
                    video.userLiked ? 'text-[var(--accent-ink)] font-bold' : 'text-[var(--ink)]'
                  }`}
                >
                  <ThumbsUp className={`h-4 w-4 ${video.userLiked ? 'fill-current' : ''}`} />
                  <span className="tabular-nums">
                    {video.hideLikes
                      ? (video.userLiked ? 'Liked' : 'Like')
                      : video.likes.toLocaleString()}
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
                className="flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>

              {/* Save to Watch Later */}
              <button
                onClick={() => onToggleWatchLater(video.id)}
                title="Save to Watch Later"
                className={`flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[40px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors border ${
                  isWatchLater
                    ? 'bg-[#FF0000] text-white border-[#FF0000] font-bold'
                    : 'bg-[var(--surface)] border-[var(--ink-faint)] text-[var(--ink)] hover:bg-[var(--card-hover)]'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>{isWatchLater ? 'Saved' : 'Save'}</span>
              </button>

              {/* Save to Playlist */}
              {onToggleVideoInPlaylist && (
                <button
                  type="button"
                  onClick={() => setIsPlaylistPopoverOpen(true)}
                  title="Add to playlist"
                  className="flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                >
                  <ListPlus className="h-4 w-4" />
                  <span>Playlist</span>
                </button>
              )}

              {/* Color Adjustments */}
              <button
                type="button"
                onClick={onOpenFilters}
                title="Color Grading"
                aria-label="Color Grading"
                className="flex items-center justify-center shrink-0 min-h-[40px] min-w-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-2 text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
              >
                <Sliders className="h-4 w-4" />
              </button>

              {/* Technical Video Info */}
              <button
                type="button"
                onClick={onOpenInfo}
                title="Video Technical Specs & Codecs"
                aria-label="Video Technical Specs"
                className="flex items-center justify-center shrink-0 min-h-[40px] min-w-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-2 text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
              >
                <Info className="h-4 w-4" />
              </button>

              {/* Report Video */}
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                title="Report video"
                aria-label="Report video"
                className="flex items-center justify-center shrink-0 min-h-[40px] min-w-[40px] rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-2 text-[var(--ink)] hover:bg-[var(--card-hover)] hover:text-rose-500 transition-colors cursor-pointer"
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Description Card (Expandable without nested interactive button inside div[onClick]) */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--ink-faint)] p-4 transition-colors">
            {/* Clean Unboxed Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--ink)] tabular-nums">
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
              descriptionExpanded ? 'whitespace-pre-line' : 'line-clamp-2'
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

            <button
              type="button"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              className="mt-2 min-h-[32px] text-xs font-bold text-[var(--ink)] hover:underline cursor-pointer"
            >
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
            currentUserId={currentUserId}
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

      {/* Save to Playlist Dialog */}
      {isPlaylistPopoverOpen && (
        <div
          onClick={() => setIsPlaylistPopoverOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] p-5 shadow-2xl text-[var(--ink)] space-y-4"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--ink-faint)]">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ListPlus className="h-4 w-4 text-[var(--accent-ink)]" />
                <span>Save video to playlist</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPlaylistPopoverOpen(false)}
                className="text-xs font-semibold text-[var(--ink-medium)] hover:text-[var(--ink)] px-2 py-1 rounded-lg hover:bg-[var(--card-hover)] cursor-pointer"
              >
                Done
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-xs text-[var(--ink-medium)] py-2">
                  No playlists yet. Create one below to organize your favorite streams.
                </p>
              ) : (
                playlists.map((pl) => {
                  const checked = pl.videoIds.includes(video.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => onToggleVideoInPlaylist?.(pl.id, video.id)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                    >
                      <span className="truncate">{pl.title}</span>
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          checked
                            ? 'bg-[#FF0000] border-[#FF0000] text-white'
                            : 'border-[var(--ink-medium)]'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {onCreatePlaylist && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPlaylistTitle.trim()) return;
                  onCreatePlaylist(newPlaylistTitle.trim(), video.id);
                  setNewPlaylistTitle('');
                }}
                className="flex items-center gap-2 pt-2 border-t border-[var(--ink-faint)]"
              >
                <input
                  type="text"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="New playlist name..."
                  className="flex-1 min-h-[38px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newPlaylistTitle.trim()}
                  className="min-h-[38px] inline-flex items-center gap-1 rounded-xl bg-[#FF0000] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#CC0000] disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Report Video Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        targetId={video.id}
        targetType="video"
        targetTitle={video.title}
      />
    </div>
  );
};
