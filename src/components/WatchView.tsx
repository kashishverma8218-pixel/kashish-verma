import React, { useState } from 'react';
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
  onAddReply: (commentId: string, content: string) => void;
  bookmarks: Bookmark[];
  onAddBookmark: (time: number, thumbnailUrl?: string) => void;
  onOpenFilters: () => void;
  onOpenInfo: () => void;
  filters: VideoFilters;
  aspectRatio: AspectRatioMode;
  setAspectRatio: (mode: AspectRatioMode) => void;
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
  onAddReply,
  bookmarks,
  onAddBookmark,
  onOpenFilters,
  onOpenInfo,
  filters,
  aspectRatio,
  setAspectRatio,
}) => {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);

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
          <div className="overflow-hidden rounded-2xl bg-black shadow-2xl">
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
            />
          </div>

          {/* Video Title */}
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
            {video.title}
          </h1>

          {/* Channel Row & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            {/* Channel Lockup */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => channel && onSelectChannel(channel.id)}
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden shrink-0 ring-1 ring-slate-200 dark:ring-slate-700 hover:opacity-90 transition-opacity"
              >
                {channel?.avatar ? (
                  <img
                    src={channel.avatar}
                    alt={channel.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-sky-600 text-sm font-bold text-white">
                    {video.title.charAt(0)}
                  </div>
                )}
              </button>

              <div className="min-w-0">
                <button
                  onClick={() => channel && onSelectChannel(channel.id)}
                  className="flex items-center gap-1 text-sm font-bold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400 transition-colors"
                >
                  <span className="truncate">{channel?.name || 'Creator'}</span>
                  {channel?.verified && (
                    <CheckCircle2 className="h-4 w-4 text-slate-400 fill-slate-400/20 shrink-0" />
                  )}
                </button>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {channel ? formatSubscribers(channel.subscribersCount) : '100K followers'}
                </div>
              </div>

              {/* Follow Button & Bell Dropdown */}
              <div className="relative ml-2 sm:ml-4 flex items-center">
                {isSubscribed ? (
                  <div className="flex items-center rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
                    <button
                      onClick={() => channel && onToggleSubscribe(channel.id)}
                      className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Following
                    </button>
                    <button
                      onClick={() => setBellDropdownOpen(!bellDropdownOpen)}
                      className="p-1.5 rounded-full text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                      {bellSetting === 'all' ? (
                        <BellRing className="h-4 w-4 text-sky-500" />
                      ) : bellSetting === 'personalized' ? (
                        <Bell className="h-4 w-4" />
                      ) : (
                        <BellOff className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => channel && onToggleSubscribe(channel.id)}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 active:scale-95 transition-all dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    Follow
                  </button>
                )}

                {/* Bell Menu */}
                {bellDropdownOpen && isSubscribed && (
                  <div className="absolute left-0 top-11 z-40 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 text-xs">
                    <button
                      onClick={() => {
                        channel && onUpdateNotificationBell(channel.id, 'all');
                        setBellDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <BellRing className="h-4 w-4 text-sky-500" />
                        <span>All</span>
                      </div>
                      {bellSetting === 'all' && <Check className="h-3.5 w-3.5 text-sky-500" />}
                    </button>
                    <button
                      onClick={() => {
                        channel && onUpdateNotificationBell(channel.id, 'personalized');
                        setBellDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        <span>Personalized</span>
                      </div>
                      {bellSetting === 'personalized' && <Check className="h-3.5 w-3.5 text-sky-500" />}
                    </button>
                    <button
                      onClick={() => {
                        channel && onUpdateNotificationBell(channel.id, 'none');
                        setBellDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <BellOff className="h-4 w-4 text-slate-400" />
                        <span>None</span>
                      </div>
                      {bellSetting === 'none' && <Check className="h-3.5 w-3.5 text-sky-500" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Video Action Bar */}
            <div className="flex items-center gap-2">
              {/* Like / Dislike Split Pill */}
              <div className="flex items-center rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5">
                <button
                  onClick={() => onToggleLike(video.id)}
                  className={`flex items-center gap-1.5 rounded-l-full px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
                    video.userLiked ? 'text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <ThumbsUp className={`h-4 w-4 ${video.userLiked ? 'fill-current' : ''}`} />
                  <span>
                    {video.hideLikes
                      ? (video.userLiked ? 'Liked' : 'Like')
                      : (video.likes + (video.userLiked ? 1 : 0)).toLocaleString()}
                  </span>
                </button>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                <button
                  onClick={() => onToggleDislike(video.id)}
                  className={`rounded-r-full px-3 py-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors ${
                    video.userDisliked ? 'text-rose-500' : ''
                  }`}
                >
                  <ThumbsDown className={`h-4 w-4 ${video.userDisliked ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                <span>Share & Copy</span>
              </button>

              {/* Save to Watch Later */}
              <button
                onClick={() => onToggleWatchLater(video.id)}
                title="Save to Watch Later"
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  isWatchLater
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">{isWatchLater ? 'Saved' : 'Save'}</span>
              </button>

              {/* Color Adjustments */}
              <button
                onClick={onOpenFilters}
                title="Color Grading"
                className="flex items-center gap-1.5 rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Sliders className="h-4 w-4" />
              </button>

              {/* Technical Video Info */}
              <button
                onClick={onOpenInfo}
                title="Video Technical Specs & Codecs"
                className="flex items-center gap-1.5 rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Description Card (Expandable) */}
          <div
            onClick={() => setDescriptionExpanded(!descriptionExpanded)}
            className="cursor-pointer rounded-2xl bg-slate-100/80 p-4 transition-colors hover:bg-slate-200/60 dark:bg-slate-900/80 dark:hover:bg-slate-900"
          >
            {/* Clean Unboxed Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>{formatViews(video.views)}</span>
              <span aria-hidden="true">·</span>
              <span>Published {video.publishedAt}</span>
              {video.category && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-sky-600 dark:text-sky-400">#{video.category}</span>
                </>
              )}
            </div>

            <p className={`mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed ${
              descriptionExpanded ? '' : 'line-clamp-2'
            }`}>
              {video.description}
            </p>

            {video.tags && video.tags.length > 0 && descriptionExpanded && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-sky-600 dark:text-sky-400">
                {video.tags.map((tag) => (
                  <span key={tag}>#{tag.replace(/\s+/g, '')}</span>
                ))}
              </div>
            )}

            <button className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
              {descriptionExpanded ? 'Show less' : '...more'}
            </button>
          </div>

          {/* Interactive Working Comments Section */}
          <CommentSection
            videoId={video.id}
            comments={comments}
            onAddComment={onAddComment}
            onLikeComment={onLikeComment}
            onAddReply={onAddReply}
            disabled={video.commentsControl === 'disabled'}
          />
        </div>

        {/* Right Column: Up Next / Recommended Videos */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Up Next
            </h3>
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <span>Autoplay</span>
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={(e) => setAutoplayNext(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-sky-500"
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
                  className="group flex gap-3 rounded-xl p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900/80 cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-xl bg-black">
                    <img
                      src={rec.poster}
                      alt={rec.title}
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
                    <h4 className="line-clamp-2 text-xs font-bold text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400 transition-colors leading-snug">
                      {rec.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {recChannel?.name || 'Creator'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
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
      />
    </div>
  );
};
