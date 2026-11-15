import React, { useState, useEffect } from 'react';
import { History, ThumbsUp, Clock, Trash2, ListVideo, Bookmark, Plus, Play, Sparkles, X } from 'lucide-react';
import { VideoItem, Channel, HistoryItem, PlaylistItem, ReelItem } from '../types/video';
import { VideoCard } from './VideoCard';

export type LibraryTab = 'history' | 'liked' | 'watchLater' | 'playlists' | 'savedReels';

interface LibraryViewProps {
  initialTab?: LibraryTab;
  videos: VideoItem[];
  reels?: ReelItem[];
  channelsMap: Record<string, Channel>;
  history: HistoryItem[];
  likedVideoIds: string[];
  watchLaterIds: string[];
  playlists?: PlaylistItem[];
  onPlayVideo: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onClearHistory: () => void;
  onToggleWatchLater: (videoId: string) => void;
  onRemoveFromHistory: (videoId: string) => void;
  onCreatePlaylist?: (title: string) => void;
  onDeletePlaylist?: (playlistId: string) => void;
  onToggleVideoInPlaylist?: (playlistId: string, videoId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onToggleSaveReel?: (reelId: string) => void;
  onPlayQueue?: (title: string, videoIds: string[]) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  initialTab = 'history',
  videos,
  reels = [],
  channelsMap,
  history,
  likedVideoIds,
  watchLaterIds,
  playlists = [],
  onPlayVideo,
  onSelectChannel,
  onClearHistory,
  onToggleWatchLater,
  onRemoveFromHistory,
  onCreatePlaylist,
  onDeletePlaylist,
  onToggleVideoInPlaylist,
  onOpenReel,
  onToggleSaveReel,
  onPlayQueue,
}) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

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
  const savedReels = reels.filter((r) => r.userSaved);

  const selectedPlaylist =
    playlists.find((p) => p.id === selectedPlaylistId) || playlists[0] || null;
  const selectedPlaylistVideos = selectedPlaylist
    ? (selectedPlaylist.videoIds
        .map((id) => videos.find((v) => v.id === id))
        .filter(Boolean) as VideoItem[])
    : [];

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
          <span className="tabular-nums">History ({historyVideos.length})</span>
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
          <span className="tabular-nums">Liked Videos ({likedVideos.length})</span>
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
          <span className="tabular-nums">Watch Later ({watchLaterVideos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('playlists')}
          className={`min-h-[40px] flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'playlists'
              ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
              : 'text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)]'
          }`}
        >
          <ListVideo className="h-4 w-4" />
          <span className="tabular-nums">Playlists ({playlists.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('savedReels')}
          className={`min-h-[40px] flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'savedReels'
              ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
              : 'text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)]'
          }`}
        >
          <Bookmark className="h-4 w-4" />
          <span className="tabular-nums">Saved Reels ({savedReels.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--ink-faint)]">
            <h2 className="text-lg font-bold text-[var(--ink)]">Watch History</h2>
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
                <VideoCard
                  key={video.id}
                  video={video}
                  channel={channelsMap[video.channelId]}
                  onPlay={onPlayVideo}
                  onSelectChannel={onSelectChannel}
                  onToggleWatchLater={onToggleWatchLater}
                  isWatchLater={watchLaterIds.includes(video.id)}
                  watchProgress={progress}
                  playlists={playlists}
                  onAddToPlaylist={onToggleVideoInPlaylist}
                  onRemoveFromHistory={onRemoveFromHistory}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'liked' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--ink-faint)]">
            <h2 className="text-lg font-bold text-[var(--ink)]">
              Liked Videos
            </h2>
            {likedVideos.length > 0 && onPlayQueue && (
              <button
                type="button"
                onClick={() => onPlayQueue('Liked Videos', likedVideos.map((v) => v.id))}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#FF0000] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#CC0000] transition-colors shrink-0 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Play all</span>
              </button>
            )}
          </div>
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
                  playlists={playlists}
                  onAddToPlaylist={onToggleVideoInPlaylist}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'watchLater' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--ink-faint)]">
            <h2 className="text-lg font-bold text-[var(--ink)]">
              Watch Later
            </h2>
            {watchLaterVideos.length > 0 && onPlayQueue && (
              <button
                type="button"
                onClick={() => onPlayQueue('Watch Later', watchLaterVideos.map((v) => v.id))}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#FF0000] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#CC0000] transition-colors shrink-0 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Play all</span>
              </button>
            )}
          </div>
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
                  playlists={playlists}
                  onAddToPlaylist={onToggleVideoInPlaylist}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'playlists' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--ink-faint)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Your Playlists</h2>
              <p className="text-xs text-[var(--ink-medium)]">
                Organize saved streams into custom collections
              </p>
            </div>

            {onCreatePlaylist && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPlaylistTitle.trim()) return;
                  onCreatePlaylist(newPlaylistTitle.trim());
                  setNewPlaylistTitle('');
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="Create new playlist..."
                  className="min-h-[40px] w-full sm:w-56 rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newPlaylistTitle.trim()}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#FF0000] px-4 py-2 text-xs font-bold text-white hover:bg-[#CC0000] disabled:opacity-40 shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create</span>
                </button>
              </form>
            )}
          </div>

          {playlists.length === 0 ? (
            <div className="py-16 text-center text-[var(--ink-medium)]">
              <ListVideo className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-[var(--ink)]">No playlists yet</p>
              <p className="text-xs mt-1">Create a playlist above or save any video to a playlist from its menu.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Playlist Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playlists.map((pl) => {
                  const isActive = selectedPlaylist?.id === pl.id;
                  const coverVid = pl.videoIds
                    .map((id) => videos.find((v) => v.id === id))
                    .find(Boolean);
                  return (
                    <div
                      key={pl.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-colors ${
                        isActive
                          ? 'border-[#FF0000] bg-[var(--surface-elevated)]'
                          : 'border-[var(--ink-faint)] bg-[var(--surface)] hover:bg-[var(--card-hover)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPlaylistId(pl.id)}
                        className="flex flex-1 items-center gap-3 min-w-0 text-left cursor-pointer"
                      >
                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--thumb-bg)]">
                          {coverVid?.poster ? (
                            <img
                              src={coverVid.poster}
                              alt={pl.title}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[var(--ink-medium)]">
                              <ListVideo className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[var(--ink)] truncate">
                            {pl.title}
                          </h3>
                          <p className="text-xs text-[var(--ink-medium)] tabular-nums">
                            {pl.videoIds.length} {pl.videoIds.length === 1 ? 'video' : 'videos'}
                          </p>
                        </div>
                      </button>

                      {onDeletePlaylist && (
                        <button
                          type="button"
                          onClick={() => onDeletePlaylist(pl.id)}
                          aria-label={`Delete playlist ${pl.title}`}
                          title="Delete playlist"
                          className="p-2 rounded-lg text-[var(--ink-medium)] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selected Playlist Videos */}
              {selectedPlaylist && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-[var(--ink)]">
                      {selectedPlaylist.title} ({selectedPlaylistVideos.length})
                    </h3>
                    {selectedPlaylistVideos.length > 0 && onPlayQueue && (
                      <button
                        type="button"
                        onClick={() => onPlayQueue(selectedPlaylist.title, selectedPlaylistVideos.map((v) => v.id))}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#FF0000] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#CC0000] transition-colors shrink-0 cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        <span>Play all</span>
                      </button>
                    )}
                  </div>

                  {selectedPlaylistVideos.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] py-10 text-center text-xs text-[var(--ink-medium)]">
                      This playlist is empty. Add videos via the "Playlist" button on any watch page or video menu.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                      {selectedPlaylistVideos.map((video) => (
                        <div key={`${selectedPlaylist.id}-${video.id}`} className="space-y-2">
                          <VideoCard
                            video={video}
                            channel={channelsMap[video.channelId]}
                            onPlay={onPlayVideo}
                            onSelectChannel={onSelectChannel}
                            onToggleWatchLater={onToggleWatchLater}
                            isWatchLater={watchLaterIds.includes(video.id)}
                          />
                          {onToggleVideoInPlaylist && (
                            <button
                              type="button"
                              onClick={() => onToggleVideoInPlaylist(selectedPlaylist.id, video.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-medium)] hover:text-rose-500 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Remove from playlist</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'savedReels' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--ink)] pb-2 border-b border-[var(--ink-faint)]">
            Saved Reels
          </h2>
          {savedReels.length === 0 ? (
            <div className="py-16 text-center text-[var(--ink-medium)]">
              <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-[var(--ink)]">No saved reels yet</p>
              <p className="text-xs mt-1">Tap Save inside Reels to bookmark short clips here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {savedReels.map((reel) => {
                const ch = channelsMap[reel.channelId];
                return (
                  <div
                    key={reel.id}
                    className="group relative aspect-[9/16] overflow-hidden rounded-2xl bg-[var(--thumb-bg)] border border-[var(--ink-faint)] cursor-pointer"
                    onClick={() => onOpenReel?.(reel.id)}
                  >
                    <img
                      src={reel.poster}
                      alt={reel.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                    {onToggleSaveReel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSaveReel(reel.id);
                        }}
                        aria-label="Remove from saved reels"
                        title="Remove saved reel"
                        className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                      >
                        <Bookmark className="h-4 w-4 fill-current" />
                      </button>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-xl">
                        <Play className="h-5 w-5 fill-white ml-0.5" />
                      </div>
                    </div>

                    <div className="absolute bottom-2.5 inset-x-2.5 text-white">
                      <p className="text-xs font-bold line-clamp-2 drop-shadow-sm">{reel.title}</p>
                      <p className="text-[10px] text-white/75 truncate mt-0.5">
                        {ch?.name || 'Creator'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
