import React, { useState } from 'react';
import { History, ThumbsUp, Clock, Trash2, Film, Play } from 'lucide-react';
import { VideoItem, Channel, HistoryItem } from '../types/video';
import { VideoCard } from './VideoCard';
import { formatTime } from '../utils/formatTime';

interface LibraryViewProps {
  initialTab?: 'history' | 'liked' | 'watchLater';
  videos: VideoItem[];
  channelsMap: Record<string, Channel>;
  history: HistoryItem[];
  likedVideoIds: string[];
  watchLaterIds: string[];
  onPlayVideo: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onClearHistory: () => void;
  onToggleWatchLater: (videoId: string) => void;
  onRemoveFromHistory: (videoId: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  initialTab = 'history',
  videos,
  channelsMap,
  history,
  likedVideoIds,
  watchLaterIds,
  onPlayVideo,
  onSelectChannel,
  onClearHistory,
  onToggleWatchLater,
  onRemoveFromHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'liked' | 'watchLater'>(initialTab);

  const historyVideos = history
    .map((h) => {
      const vid = videos.find((v) => v.id === h.videoId);
      return vid ? { video: vid, progress: h.progressSeconds / (vid.duration || 1) } : null;
    })
    .filter(Boolean) as { video: VideoItem; progress: number }[];

  const likedVideos = videos.filter((v) => likedVideoIds.includes(v.id) || v.userLiked);
  const watchLaterVideos = videos.filter((v) => watchLaterIds.includes(v.id));

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <History className="h-4 w-4" />
          <span>History ({historyVideos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('liked')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'liked'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <ThumbsUp className="h-4 w-4" />
          <span>Liked Videos ({likedVideos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('watchLater')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'watchLater'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Watch Later ({watchLaterVideos.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Watch History
            </h2>
            {historyVideos.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear all watch history</span>
              </button>
            )}
          </div>

          {historyVideos.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <History className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No watch history yet</p>
              <p className="text-xs text-slate-500 mt-1">Videos you watch will show up here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {historyVideos.map(({ video, progress }) => (
                <div key={video.id} className="relative group/item">
                  <VideoCard
                    video={video}
                    channel={channelsMap[video.channelId]}
                    onPlay={onPlayVideo}
                    onSelectChannel={onSelectChannel}
                    onToggleWatchLater={onToggleWatchLater}
                    isWatchLater={watchLaterIds.includes(video.id)}
                    watchProgress={progress}
                  />
                  <button
                    onClick={() => onRemoveFromHistory(video.id)}
                    title="Remove from history"
                    className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 p-1.5 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-all z-10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'liked' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Liked Videos
          </h2>
          {likedVideos.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <ThumbsUp className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No liked videos yet</p>
              <p className="text-xs text-slate-500 mt-1">Click the thumbs-up button under any video to save it here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {likedVideos.map((video) => (
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
      )}

      {activeTab === 'watchLater' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Watch Later
          </h2>
          {watchLaterVideos.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No videos saved for later</p>
              <p className="text-xs text-slate-500 mt-1">Hover over any video and click the clock icon to watch it later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {watchLaterVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  channel={channelsMap[video.channelId]}
                  onPlay={onPlayVideo}
                  onSelectChannel={onSelectChannel}
                  onToggleWatchLater={onToggleWatchLater}
                  isWatchLater={true}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
