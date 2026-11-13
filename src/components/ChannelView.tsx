import React, { useState, useRef, useEffect } from 'react';
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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarFailed(false);
  }, [channel.id, channel.avatar]);

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

  const totalViews = channelVideos.reduce((acc, v) => acc + v.views, 0);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4">
      {/* Channel Banner */}
      <div className="relative h-36 sm:h-56 md:h-64 w-full overflow-hidden rounded-2xl bg-[#141416] shadow-md border border-[var(--ink-faint)]">
        <img
          src={channel.banner}
          alt={channel.name}
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.opacity = '0.3';
          }}
          className="h-full w-full object-cover"
        />
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
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-medium)]">
              <span className="font-semibold text-[var(--ink)]">{channel.handle}</span>
              <span aria-hidden="true">·</span>
              <span>{formatSubscribers(channel.subscribersCount)}</span>
              <span aria-hidden="true">·</span>
              <span>{channelVideos.length} videos</span>
            </div>

            <p className="mt-1 text-xs text-[var(--ink-medium)] max-w-xl line-clamp-2">
              {channel.bio}
            </p>
          </div>
        </div>

        {/* Follow & Bell Action */}
        <div ref={bellRef} className="relative flex items-center">
          {channel.isSubscribed ? (
            <div className="flex items-center rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] p-0.5">
              <button
                type="button"
                onClick={() => onToggleSubscribe(channel.id)}
                className="min-h-[38px] rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors cursor-pointer"
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
              className="min-h-[42px] rounded-full bg-[#FF0000] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#CC0000] shadow-md transition-all active:scale-95 cursor-pointer"
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
      <div className="flex items-center gap-8 border-b border-[var(--ink-faint)] text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('videos')}
          className={`min-h-[44px] py-3 transition-colors border-b-2 -mb-px cursor-pointer ${
            activeTab === 'videos'
              ? 'border-[var(--ink)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-medium)] hover:text-[var(--ink)]'
          }`}
        >
          Videos ({channelVideos.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`min-h-[44px] py-3 transition-colors border-b-2 -mb-px cursor-pointer ${
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
