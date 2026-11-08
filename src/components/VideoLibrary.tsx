import React, { useState } from 'react';
import { Play, Plus, Trash2, Film, CheckCircle2 } from 'lucide-react';
import { VideoItem } from '../types/video';
import { formatTime } from '../utils/formatTime';

interface VideoLibraryProps {
  videos: VideoItem[];
  activeVideoId: string;
  onSelectVideo: (video: VideoItem) => void;
  onRemoveVideo?: (id: string) => void;
  onOpenUpload: () => void;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  videos,
  activeVideoId,
  onSelectVideo,
  onRemoveVideo,
  onOpenUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Extract unique tags
  const allTags = Array.from(
    new Set(videos.flatMap((v) => v.tags || []))
  );

  const filteredVideos = videos.filter((v) => {
    const matchesSearch =
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.author && v.author.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTag = selectedTag === 'all' || (v.tags && v.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tag Filter Segmented Buttons */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80">
            <button
              onClick={() => setSelectedTag('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedTag === 'all'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              All Videos
            </button>
            {allTags.slice(0, 4).map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedTag === tag
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-60 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 whitespace-nowrap shrink-0 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Video</span>
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVideos.map((item) => {
          const isActive = item.id === activeVideoId;
          return (
            <div
              key={item.id}
              onClick={() => onSelectVideo(item)}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all cursor-pointer hover:shadow-md dark:bg-slate-900 ${
                isActive
                  ? 'border-sky-500 ring-2 ring-sky-500/20 dark:border-sky-500'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
              }`}
            >
              {/* Media Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-500">
                    <Film className="h-10 w-10" />
                  </div>
                )}

                {/* Scrim Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Center Play Button on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="h-5 w-5 fill-white ml-0.5" />
                  </div>
                </div>

                {/* Duration Badge */}
                {item.duration && (
                  <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-mono text-white backdrop-blur-xs">
                    {formatTime(item.duration)}
                  </div>
                )}

                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-sky-500/90 backdrop-blur-xs px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Now Playing</span>
                  </div>
                )}
              </div>

              {/* Video Info Body */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors dark:text-white dark:group-hover:text-sky-400 line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Unboxed Metadata with Typographic Separator (Zero-Pill Compliance) */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{item.author || 'Open Creator'}</span>
                    {item.tags && item.tags.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{item.tags[0]}</span>
                      </>
                    )}
                  </div>

                  {item.isLocal && onRemoveVideo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveVideo(item.id);
                      }}
                      title="Remove local item"
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
