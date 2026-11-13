import React, { useMemo } from 'react';
import { ArrowUpRight, MessageSquare, TrendingUp } from 'lucide-react';
import { Channel, Comment, NotificationItem, VideoItem } from '../types/video';
import { formatViews } from '../data/mockData';

interface RightActivityRailProps {
  videos: VideoItem[];
  reelsCount: number;
  channels: Record<string, Channel>;
  commentsMap: Record<string, Comment[]>;
  notifications: NotificationItem[];
  creatorName?: string;
  creatorHandle?: string;
  creatorAvatar?: string;
  creatorFollowers?: number;
  onPlayVideo: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onOpenStudio: () => void;
  onOpenCreate?: () => void;
}

export const RightActivityRail: React.FC<RightActivityRailProps> = ({
  videos,
  reelsCount,
  channels,
  commentsMap,
  notifications,
  creatorName,
  creatorHandle,
  creatorAvatar,
  creatorFollowers,
  onPlayVideo,
  onSelectChannel,
  onOpenStudio,
  onOpenCreate,
}) => {
  const recentComments = useMemo(() => {
    const flattened: Array<{ comment: Comment; video?: VideoItem }> = [];
    Object.entries(commentsMap).forEach(([videoId, list]) => {
      const matchedVideo = videos.find((v) => v.id === videoId);
      list.slice(0, 2).forEach((comment) => {
        flattened.push({ comment, video: matchedVideo });
      });
    });
    return flattened.slice(0, 4);
  }, [commentsMap, videos]);

  const totalViews = useMemo(() => {
    return videos.reduce((sum, v) => sum + (v.views || 0), 0);
  }, [videos]);

  const totalLikes = useMemo(() => {
    return videos.reduce((sum, v) => sum + (v.likes || 0), 0);
  }, [videos]);

  const followedCount = useMemo(() => {
    return Object.values(channels).filter((c) => c.isSubscribed).length;
  }, [channels]);

  const featuredChannel = Object.values(channels)[0];
  const displayName = creatorName || featuredChannel?.name || 'VIO Creator';
  const displayHandle = creatorHandle || featuredChannel?.handle || '@viocreator';
  const displayAvatar =
    creatorAvatar ||
    featuredChannel?.avatar ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
  const displayFollowers = creatorFollowers ?? featuredChannel?.subscribersCount ?? 0;

  const recentNotifications = notifications.slice(0, 2);

  return (
    <aside className="sticky top-[76px] hidden xl:flex flex-col w-[340px] shrink-0 h-[calc(100vh-76px)] border-l border-[var(--ink-faint)] bg-[var(--surface)] overflow-y-auto scrollbar-thin">
      {/* Variation 11 Creator Profile Header */}
      <div className="p-8 border-b border-[var(--ink-faint)]">
        <img
          src={displayAvatar}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="h-16 w-16 rounded-full object-cover border border-[var(--accent-ink)] p-1 mb-5 grayscale hover:grayscale-0 transition-all"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--accent-ink)] block mb-1.5">
          Creator Studio Profile
        </span>
        <h2 className="font-display text-2xl font-extrabold leading-tight text-[var(--ink)] truncate">
          {displayName}
        </h2>
        <p className="font-mono text-[11px] text-[var(--ink-medium)] mt-1.5 tabular-nums truncate">
          {displayHandle} · {displayFollowers.toLocaleString()} followers
        </p>
      </div>

      {/* Large Syne KPI Metrics */}
      <div className="p-8 space-y-7 border-b border-[var(--ink-faint)]">
        <div>
          <div className="font-display text-4xl font-extrabold leading-none text-[var(--ink)] tabular-nums">
            {formatViews(totalViews).replace(' views', '')}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-medium)] mt-2">
            Total Views Accumulated
          </div>
        </div>

        <div>
          <div className="font-display text-4xl font-extrabold leading-none text-[var(--accent-ink)] tabular-nums">
            {totalLikes.toLocaleString()}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-medium)] mt-2">
            Catalog Likes & Engagements
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[var(--ink-faint)]">
          <div>
            <div className="font-display text-xl font-extrabold text-[var(--ink)] tabular-nums">
              {videos.length}
            </div>
            <div className="font-mono text-[10px] uppercase text-[var(--ink-medium)]">Videos</div>
          </div>
          <div>
            <div className="font-display text-xl font-extrabold text-[var(--ink)] tabular-nums">
              {reelsCount}
            </div>
            <div className="font-mono text-[10px] uppercase text-[var(--ink-medium)]">Reels</div>
          </div>
          <div>
            <div className="font-display text-xl font-extrabold text-[var(--ink)] tabular-nums">
              {followedCount}
            </div>
            <div className="font-mono text-[10px] uppercase text-[var(--ink-medium)]">Follows</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenStudio}
          className="w-full flex items-center justify-center gap-2 rounded-[2px] border border-[var(--ink-faint)] bg-[var(--bg)] hover:border-[var(--accent-ink)] hover:text-[var(--accent-ink)] py-2.5 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink)] transition-colors"
        >
          <span>Open Creator Studio</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Live Viewer Comments */}
      <div className="p-8 flex-1 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-medium)]">
            Live Activity
          </span>
          <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-ink)]" />
        </div>

        <div className="space-y-3">
          {recentComments.length > 0 ? (
            recentComments.map(({ comment, video }) => (
              <button
                key={comment.id}
                type="button"
                onClick={() => video && onPlayVideo(video)}
                className="w-full text-left group border-b border-[var(--ink-faint)] pb-2.5 last:border-b-0 last:pb-0 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="font-bold text-[var(--accent-ink)] truncate">
                    {comment.authorName}
                  </span>
                  <span className="text-[10px] text-[var(--ink-medium)] shrink-0">
                    {comment.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--ink)]/80 group-hover:text-[var(--ink)] line-clamp-2 leading-relaxed">
                  {comment.content}
                </p>
              </button>
            ))
          ) : (
            <p className="text-xs text-[var(--ink-medium)] py-2">
              Viewer comments and channel updates appear here.
            </p>
          )}
        </div>

        {recentNotifications.length > 0 && (
          <div className="pt-2 border-t border-[var(--ink-faint)] space-y-1.5">
            {recentNotifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  if (notif.videoId) {
                    const matched = videos.find((v) => v.id === notif.videoId);
                    if (matched) onPlayVideo(matched);
                  } else if (notif.channelId) {
                    onSelectChannel(notif.channelId);
                  }
                }}
                className="w-full text-left text-[11px] text-[var(--ink-medium)] hover:text-[var(--accent-ink)] transition-colors truncate block"
              >
                {notif.message}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variation 11 Full-Width Bottom Upload CTA */}
      <button
        type="button"
        onClick={onOpenCreate || onOpenStudio}
        className="w-full mt-auto bg-[var(--ink)] text-[var(--bg)] hover:bg-[#FF0000] hover:text-white py-5 px-6 font-display font-extrabold text-xs uppercase tracking-[0.08em] transition-colors cursor-pointer shrink-0"
      >
        Upload New Content
      </button>
    </aside>
  );
};
