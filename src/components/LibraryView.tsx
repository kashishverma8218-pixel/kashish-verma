import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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
      <div className="flex items-center gap-2 border-b border-[var(--ink-faint)] pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`min-h-[40px] flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
              : 'text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)]'
          }`}
        >
          <History className="h-4 w-4" />
          <span>History ({historyVideos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('liked')}
          className={`min-h-[40px] flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'liked'
              ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
              : 'text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)]'
          }`}
        >
          <ThumbsUp className="h-4 w-4" />
          <span>Liked Videos ({likedVideos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('watchLater')}
          className={`min-h-[40px] flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'watchLater'
              ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
              : 'text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)]'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Watch Later ({watchLaterVideos.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--ink-faint)]">
            <h2 className="text-lg font-bold text-[var(--ink)]">
              Watch History
            </h2>
            {historyVideos.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="min-h-[40px] flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear all watch history</span>
              </button>
            )}
          </div>

          {historyVideos.length === 0 ? (
            <div className="py-16 text-center text-[var(--ink-medium)]">
              <History className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-[var(--ink)]">No watch history yet</p>
              <p className="text-xs mt-1">Videos you watch will show up here.</p>
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
                    type="button"
                    onClick={() => onRemoveFromHistory(video.id)}
                    title="Remove from history"
                    aria-label={`Remove ${video.title} from history`}
                    className="absolute top-2 right-2 min-h-[36px] min-w-[36px] flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 p-1.5 rounded-full bg-black/75 text-white hover:bg-rose-600 transition-all z-10 cursor-pointer"
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
          <h2 className="text-lg font-bold text-[var(--ink)] pb-2 border-b border-[var(--ink-faint)]">
            Liked Videos
          </h2>
          {likedVideos.length === 0 ? (
            <div className="py-16 text-center text-[var(--ink-medium)]">
              <ThumbsUp className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-[var(--ink)]">No liked videos yet</p>
              <p className="text-xs mt-1">Click the thumbs-up button under any video to save it here.</p>
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
          <h2 className="text-lg font-bold text-[var(--ink)] pb-2 border-b border-[var(--ink-faint)]">
            Watch Later
          </h2>
          {watchLaterVideos.length === 0 ? (
            <div className="py-16 text-center text-[var(--ink-medium)]">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-[var(--ink)]">No videos saved for later</p>
              <p className="text-xs mt-1">Use the menu or Watch Later button on any video to save it here.</p>
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
