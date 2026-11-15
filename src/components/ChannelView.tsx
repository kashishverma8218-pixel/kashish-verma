import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Bell,
  BellRing,
  BellOff,
  Check,
  Play,
  Film,
  Calendar,
  Eye,
  Sparkles,
  ListVideo,
  Search,
  X
} from 'lucide-react';
import { Channel, VideoItem, ReelItem, PlaylistItem } from '../types/video';
import { VideoCard } from './VideoCard';
import { formatSubscribers, formatViews } from '../data/mockData';

interface ChannelViewProps {
  channel: Channel;
  channelVideos: VideoItem[];
  channelReels?: ReelItem[];
  playlists?: PlaylistItem[];
  onPlayVideo: (video: VideoItem) => void;
  onToggleSubscribe: (channelId: string) => void;
  onUpdateNotificationBell: (channelId: string, bell: 'all' | 'personalized' | 'none') => void;
  onToggleWatchLater: (videoId: string) => void;
  watchLaterIds: string[];
  onAddToPlaylist?: (playlistId: string, videoId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onPlayQueue?: (title: string, videoIds: string[]) => void;
}

export const ChannelView: React.FC<ChannelViewProps> = ({
  channel,
  channelVideos,
  channelReels = [],
  playlists = [],
  onPlayVideo,
  onToggleSubscribe,
  onUpdateNotificationBell,
  onToggleWatchLater,
  watchLaterIds,
  onAddToPlaylist,
  onOpenReel,
  onPlayQueue,
}) => {
  const [activeTab, setActiveTab] = useState<'videos' | 'reels' | 'playlists' | 'about'>('videos');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'oldest'>('latest');
  const [channelSearch, setChannelSearch] = useState('');
  const [bellOpen, setBellOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarFailed(false);
    setBannerFailed(false);
    setChannelSearch('');
    setSortBy('latest');
  }, [channel.id, channel.avatar, channel.banner]);

  useEffect(() => {
    if (!bellOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [bellOpen]);

  const totalViews =
    channelVideos.reduce((acc, v) => acc + v.views, 0) +
    channelReels.reduce((acc, r) => acc + (r.views || 0), 0);

  const channelVideoIdSet = useMemo(
    () => new Set(channelVideos.map((v) => v.id)),
    [channelVideos]
  );

  const channelPlaylists = useMemo(
    () => playlists.filter((pl) => pl.videoIds.some((id) => channelVideoIdSet.has(id))),
    [playlists, channelVideoIdSet]
  );

  const displayedVideos = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    const filtered = q
      ? channelVideos.filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            v.description.toLowerCase().includes(q) ||
            v.tags.some((t) => t.toLowerCase().includes(q))
        )
      : [...channelVideos];

    if (sortBy === 'popular') {
      return [...filtered].sort((a, b) => b.views - a.views);
    }
    if (sortBy === 'oldest') {
      return [...filtered].reverse();
    }
    return filtered;
  }, [channelVideos, channelSearch, sortBy]);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4">
      {/* Channel Banner */}
      <div className="relative h-36 sm:h-56 md:h-64 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1f1f24] via-[#141416] to-[#261111] shadow-md border border-[var(--ink-faint)]">
        {!bannerFailed && channel.banner && (
          <img
            src={channel.banner}
            alt={channel.name}
            referrerPolicy="no-referrer"
            onError={() => setBannerFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Channel Header Profile */}
      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--ink-faint)]">
        <div className="flex items-center gap-4">
          <div className="relative -mt-10 sm:-mt-12 h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden ring-4 ring-[var(--bg)] shadow-xl shrink-0 bg-[#FF0000]/15 flex items-center justify-center">
            {avatarFailed || !channel.avatar ? (
              <span className="text-2xl font-bold text-[var(--accent-ink)]">
                {channel.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <img
                src={channel.avatar}
                alt={channel.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] truncate">
                {channel.name}
              </h1>
              {channel.verified && (
                <CheckCircle2 className="h-5 w-5 text-[var(--accent-ink)] fill-[#FF0000]/15 shrink-0" />
              )}
            </div>

            {/* Clean unboxed metadata */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-medium)] tabular-nums">
              <span className="font-semibold text-[var(--ink)]">{channel.handle}</span>
              <span aria-hidden="true">·</span>
              <span>{formatSubscribers(channel.subscribersCount)}</span>
              <span aria-hidden="true">·</span>
              <span>{channelVideos.length} videos</span>
              {channelReels.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{channelReels.length} reels</span>
                </>
              )}
            </div>

            <p className="mt-1 text-xs text-[var(--ink-medium)] max-w-xl line-clamp-2">
              {channel.bio}
            </p>
          </div>
        </div>

        {/* Follow & Bell Action */}
        <div ref={bellRef} className="relative flex items-center gap-2">
          {onPlayQueue && channelVideos.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onPlayQueue(
                  `${channel.name} Uploads`,
                  channelVideos.map((v) => v.id)
                )
              }
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-faint)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Play all</span>
            </button>
          )}

          {channel.isSubscribed ? (
            <div className="flex items-center rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-0.5">
              <button
                type="button"
                onClick={() => onToggleSubscribe(channel.id)}
                className="min-h-[38px] rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors whitespace-nowrap cursor-pointer"
              >
                Following
              </button>
              <button
                type="button"
                onClick={() => setBellOpen(!bellOpen)}
                aria-label="Notification preferences"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-full text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors cursor-pointer"
              >
                {channel.notificationBell === 'all' ? (
                  <BellRing className="h-4 w-4 text-[var(--accent-ink)]" />
                ) : channel.notificationBell === 'personalized' ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4 text-[var(--ink-medium)]" />
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onToggleSubscribe(channel.id)}
              className="min-h-[42px] rounded-full bg-[#FF0000] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#CC0000] shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              Follow
            </button>
          )}

          {bellOpen && channel.isSubscribed && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-12 z-40 w-48 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-1.5 shadow-2xl transition-all text-xs text-[var(--ink)]">
              <button
                type="button"
                onClick={() => {
                  onUpdateNotificationBell(channel.id, 'all');
                  setBellOpen(false);
                }}
                className="flex w-full min-h-[38px] items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--ink-faint)] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-[var(--accent-ink)]" />
                  <span>All</span>
                </div>
                {channel.notificationBell === 'all' && <Check className="h-3.5 w-3.5 text-[var(--accent-ink)]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateNotificationBell(channel.id, 'personalized');
                  setBellOpen(false);
                }}
                className="flex w-full min-h-[38px] items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--ink-faint)] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span>Personalized</span>
                </div>
                {channel.notificationBell === 'personalized' && <Check className="h-3.5 w-3.5 text-[var(--accent-ink)]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateNotificationBell(channel.id, 'none');
                  setBellOpen(false);
                }}
                className="flex w-full min-h-[38px] items-center justify-between px-3 py-2 rounded-xl hover:bg-[var(--ink-faint)] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BellOff className="h-4 w-4 text-[var(--ink-medium)]" />
                  <span>None</span>
                </div>
                {channel.notificationBell === 'none' && <Check className="h-3.5 w-3.5 text-[var(--accent-ink)]" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-[var(--ink-faint)] text-sm font-semibold overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('videos')}
          className={`min-h-[44px] py-3 transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'videos'
              ? 'border-[var(--ink)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-medium)] hover:text-[var(--ink)]'
          }`}
        >
          Videos ({channelVideos.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className={`min-h-[44px] py-3 transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'reels'
              ? 'border-[var(--ink)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-medium)] hover:text-[var(--ink)]'
          }`}
        >
          Shorts & Reels ({channelReels.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('playlists')}
          className={`min-h-[44px] py-3 transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'playlists'
              ? 'border-[var(--ink)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-medium)] hover:text-[var(--ink)]'
          }`}
        >
          Playlists ({channelPlaylists.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`min-h-[44px] py-3 transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'about'
              ? 'border-[var(--ink)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-medium)] hover:text-[var(--ink)]'
          }`}
        >
          About
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'videos' && (
          <div className="space-y-5">
            {channelVideos.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Sort Pills */}
                <div className="flex items-center gap-2">
                  {(['latest', 'popular', 'oldest'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSortBy(mode)}
                      className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                        sortBy === mode
                          ? 'bg-[var(--ink)] text-[var(--bg)]'
                          : 'bg-[var(--surface)] text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] border border-[var(--ink-faint)]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* In-Channel Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ink-medium)]" />
                  <input
                    type="text"
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="Search channel videos..."
                    aria-label="Search channel videos"
                    className="w-full min-h-[38px] rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] pl-9 pr-8 py-1.5 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                  />
                  {channelSearch && (
                    <button
                      type="button"
                      onClick={() => setChannelSearch('')}
                      aria-label="Clear channel search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--ink-medium)] hover:text-[var(--ink)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {displayedVideos.length === 0 ? (
              <div className="py-12 text-center text-[var(--ink-medium)]">
                <Film className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>
                  {channelSearch
                    ? `No videos matching "${channelSearch}" on this channel.`
                    : 'This channel has not uploaded any public videos yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {displayedVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    channel={channel}
                    onPlay={onPlayVideo}
                    onSelectChannel={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    onToggleWatchLater={onToggleWatchLater}
                    isWatchLater={watchLaterIds.includes(video.id)}
                    playlists={playlists}
                    onAddToPlaylist={onAddToPlaylist}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reels' && (
          channelReels.length === 0 ? (
            <div className="py-12 text-center text-[var(--ink-medium)]">
              <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>This channel has not published any Shorts & Reels yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {channelReels.map((reel) => (
                <button
                  key={reel.id}
                  type="button"
                  onClick={() => onOpenReel?.(reel.id)}
                  className="group text-left flex flex-col focus:outline-none cursor-pointer"
                >
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-[var(--thumb-bg)] border border-[var(--ink-faint)]">
                    <img
                      src={reel.poster}
                      alt={reel.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 inset-x-2.5 text-white">
                      <p className="text-xs font-bold line-clamp-2 leading-snug">{reel.title}</p>
                      <p className="text-[10px] text-white/80 tabular-nums mt-0.5">
                        {formatViews(reel.views)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {activeTab === 'playlists' && (
          channelPlaylists.length === 0 ? (
            <div className="py-12 text-center text-[var(--ink-medium)]">
              <ListVideo className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No playlists featuring videos from this channel yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {channelPlaylists.map((pl) => {
                const matchingVids = pl.videoIds
                  .map((id) => channelVideos.find((v) => v.id === id))
                  .filter(Boolean) as VideoItem[];
                const cover = matchingVids[0];
                return (
                  <div
                    key={pl.id}
                    className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] overflow-hidden flex flex-col justify-between"
                  >
                    <div className="relative aspect-video w-full bg-[var(--thumb-bg)]">
                      {cover?.poster && (
                        <img
                          src={cover.poster}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                          <ListVideo className="h-4 w-4 text-[#FF0000]" />
                          <span className="tabular-nums">{pl.videoIds.length} videos</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--ink)] truncate">{pl.title}</h3>
                        <p className="text-xs text-[var(--ink-medium)] truncate mt-0.5">
                          {matchingVids.length} from {channel.name}
                        </p>
                      </div>
                      {onPlayQueue && (
                        <button
                          type="button"
                          onClick={() => onPlayQueue(pl.title, pl.videoIds)}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#FF0000] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#CC0000] transition-colors shrink-0 cursor-pointer"
                        >
                          <Play className="h-3.5 w-3.5 fill-white" />
                          <span>Play all</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'about' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)] uppercase tracking-wider mb-2">
                Description
              </h3>
              <p className="text-sm text-[var(--ink)]/85 leading-relaxed whitespace-pre-line">
                {channel.bio}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--surface)] p-4 border border-[var(--ink-faint)] space-y-3 text-xs">
              <h4 className="font-bold text-[var(--ink)] uppercase tracking-wider">
                Stats & Channel Details
              </h4>
              <div className="flex items-center gap-2 text-[var(--ink-medium)]">
                <Calendar className="h-4 w-4" />
                <span>{channel.joinedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--ink-medium)]">
                <Eye className="h-4 w-4" />
                <span className="tabular-nums">{formatViews(totalViews)} on this platform</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
