import React from 'react';
import { Tv, Sparkles, CheckCircle2 } from 'lucide-react';
import { Channel, VideoItem } from '../types/video';
import { VideoCard } from './VideoCard';
import { formatSubscribers } from '../data/mockData';

interface SubscriptionsViewProps {
  subscribedChannels: Channel[];
  allChannels: Channel[];
  videos: VideoItem[];
  channelsMap: Record<string, Channel>;
  onPlayVideo: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onToggleSubscribe: (channelId: string) => void;
  onToggleWatchLater: (videoId: string) => void;
  watchLaterIds: string[];
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  subscribedChannels,
  allChannels,
  videos,
  channelsMap,
  onPlayVideo,
  onSelectChannel,
  onToggleSubscribe,
  onToggleWatchLater,
  watchLaterIds,
}) => {
  const subscribedIds = new Set(subscribedChannels.map((c) => c.id));
  const subVideos = videos.filter((v) => subscribedIds.has(v.channelId));

  if (subscribedChannels.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mx-auto mb-4">
          <Tv className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Don't miss new videos
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Follow your favorite animation studios, VFX laboratories, and nature creators to see their latest releases here.
        </p>

        {/* Recommended channels strip */}
        <div className="mt-8 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            Recommended Channels to Follow
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {allChannels.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  onClick={() => onSelectChannel(ch.id)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer"
                >
                  <img
                    src={ch.avatar}
                    alt={ch.name}
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {ch.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatSubscribers(ch.subscribersCount)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onToggleSubscribe(ch.id)}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-500 shrink-0 transition-colors shadow-xs active:scale-95"
                >
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Subscribed Channels Avatar Bar */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Channels You Follow ({subscribedChannels.length})
        </h3>
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
          {subscribedChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className="group flex flex-col items-center gap-1.5 shrink-0 focus:outline-none"
            >
              <div className="relative h-14 w-14 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-red-500 transition-all">
                <img
                  src={channel.avatar}
                  alt={channel.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px] group-hover:text-red-500 transition-colors">
                {channel.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Latest Uploads Feed */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Latest from Followed Channels
          </h2>
          <span className="text-xs text-slate-500">{subVideos.length} videos</span>
        </div>

        {subVideos.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            No recent uploads from followed channels.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {subVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                channel={channelsMap[video.channelId]}
                onPlay={onPlayVideo}
                onSelectChannel={onSelectChannel}
                onToggleWatchLater={onToggleWatchLater}
                isWatchLater={watchLaterIds.includes(video.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
