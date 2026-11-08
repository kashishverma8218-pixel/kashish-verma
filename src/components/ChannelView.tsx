import React, { useState } from 'react';
import { CheckCircle2, Bell, BellRing, BellOff, Check, Play, Film, Calendar, Eye } from 'lucide-react';
import { Channel, VideoItem } from '../types/video';
import { VideoCard } from './VideoCard';
import { formatSubscribers, formatViews } from '../data/mockData';

interface ChannelViewProps {
  channel: Channel;
  channelVideos: VideoItem[];
  onPlayVideo: (video: VideoItem) => void;
  onToggleSubscribe: (channelId: string) => void;
  onUpdateNotificationBell: (channelId: string, bell: 'all' | 'personalized' | 'none') => void;
  onToggleWatchLater: (videoId: string) => void;
  watchLaterIds: string[];
}

export const ChannelView: React.FC<ChannelViewProps> = ({
  channel,
  channelVideos,
  onPlayVideo,
  onToggleSubscribe,
  onUpdateNotificationBell,
  onToggleWatchLater,
  watchLaterIds,
}) => {
  const [activeTab, setActiveTab] = useState<'videos' | 'about'>('videos');
  const [bellOpen, setBellOpen] = useState(false);

  const totalViews = channelVideos.reduce((acc, v) => acc + v.views, 0);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4">
      {/* Channel Banner */}
      <div className="relative h-36 sm:h-56 md:h-64 w-full overflow-hidden rounded-2xl bg-slate-900 shadow-md">
        <img
          src={channel.banner}
          alt={channel.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Channel Header Profile */}
      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="relative -mt-10 sm:-mt-12 h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden ring-4 ring-white dark:ring-slate-950 shadow-xl shrink-0">
            <img
              src={channel.avatar}
              alt={channel.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {channel.name}
              </h1>
              {channel.verified && (
                <CheckCircle2 className="h-5 w-5 text-sky-500 fill-sky-500/20" />
              )}
            </div>

            {/* Clean unboxed metadata */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{channel.handle}</span>
              <span aria-hidden="true">·</span>
              <span>{formatSubscribers(channel.subscribersCount)}</span>
              <span aria-hidden="true">·</span>
              <span>{channelVideos.length} videos</span>
            </div>

            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-xl line-clamp-1">
              {channel.bio}
            </p>
          </div>
        </div>

        {/* Follow & Bell Action */}
        <div className="relative flex items-center">
          {channel.isSubscribed ? (
            <div className="flex items-center rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                onClick={() => onToggleSubscribe(channel.id)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Following
              </button>
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="p-2 rounded-full text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                {channel.notificationBell === 'all' ? (
                  <BellRing className="h-4 w-4 text-sky-500" />
                ) : channel.notificationBell === 'personalized' ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4 text-slate-400" />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onToggleSubscribe(channel.id)}
              className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 shadow-md transition-all active:scale-95"
            >
              Follow
            </button>
          )}

          {bellOpen && channel.isSubscribed && (
            <div className="absolute right-0 top-12 z-40 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 text-xs">
              <button
                onClick={() => {
                  onUpdateNotificationBell(channel.id, 'all');
                  setBellOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-sky-500" />
                  <span>All</span>
                </div>
                {channel.notificationBell === 'all' && <Check className="h-3.5 w-3.5 text-sky-500" />}
              </button>
              <button
                onClick={() => {
                  onUpdateNotificationBell(channel.id, 'personalized');
                  setBellOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span>Personalized</span>
                </div>
                {channel.notificationBell === 'personalized' && <Check className="h-3.5 w-3.5 text-sky-500" />}
              </button>
              <button
                onClick={() => {
                  onUpdateNotificationBell(channel.id, 'none');
                  setBellOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  <BellOff className="h-4 w-4 text-slate-400" />
                  <span>None</span>
                </div>
                {channel.notificationBell === 'none' && <Check className="h-3.5 w-3.5 text-sky-500" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('videos')}
          className={`py-3 transition-colors border-b-2 -mb-px ${
            activeTab === 'videos'
              ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Videos ({channelVideos.length})
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`py-3 transition-colors border-b-2 -mb-px ${
            activeTab === 'about'
              ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          About
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'videos' ? (
          channelVideos.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Film className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>This channel has not uploaded any public videos yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {channelVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  channel={channel}
                  onPlay={onPlayVideo}
                  onSelectChannel={() => {}}
                  onToggleWatchLater={onToggleWatchLater}
                  isWatchLater={watchLaterIds.includes(video.id)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                Description
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {channel.bio}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Stats & Channel Details
              </h4>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>{channel.joinedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Eye className="h-4 w-4" />
                <span>{formatViews(totalViews)} on this platform</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
