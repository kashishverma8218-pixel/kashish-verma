import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Flame,
  Clock,
  Compass,
  SlidersHorizontal,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Film
} from 'lucide-react';
import { VideoItem, Channel, PlaylistItem } from '../types/video';
import { VideoCard } from './VideoCard';
import { CATEGORIES } from '../data/mockData';

interface CustomFeedViewProps {
  videos: VideoItem[];
  channels: Record<string, Channel>;
  onPlayVideo: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onToggleWatchLater: (videoId: string) => void;
  watchLaterIds: string[];
  playlists?: PlaylistItem[];
  onAddToPlaylist?: (playlistId: string, videoId: string) => void;
}

export const CustomFeedView: React.FC<CustomFeedViewProps> = ({
  videos,
  channels,
  onPlayVideo,
  onSelectChannel,
  onToggleWatchLater,
  watchLaterIds,
  playlists = [],
  onAddToPlaylist,
}) => {
  // Feed sorting profiles
  const [algoMode, setAlgoMode] = useState<'smart' | 'viral' | 'fresh' | 'underrated'>('smart');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Lazy Loading state: start with 4 videos, incrementally load 4 more
  const [visibleCount, setVisibleCount] = useState<number>(4);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const filterCategories = useMemo(() => {
    const base = CATEGORIES.filter(
      (c) =>
        c !== 'All' &&
        c !== 'Reels' &&
        c !== 'Custom Feed' &&
        c !== 'Trending' &&
        c !== 'Recently Uploaded'
    );
    const dynamic = videos
      .map((v) => v.category)
      .filter((cat): cat is string => Boolean(cat) && !base.includes(cat));
    return ['all', ...Array.from(new Set([...base, ...dynamic]))];
  }, [videos]);

  // Compute score for each video
  const scoredVideos = useMemo(() => {
    return videos
      .filter((v) => (v.visibility || 'public') !== 'private')
      .map((video) => {
        const views = video.views || 0;
        const likes = video.likes || 0;
        const likeRatio = views > 0 ? (likes / views) * 100 : 0;

        let recencyWeight = 1.0;
        if (video.publishedAt.includes('day') || video.publishedAt.includes('hour') || video.publishedAt.includes('Just')) {
          recencyWeight = 3.0;
        } else if (video.publishedAt.includes('week')) {
          recencyWeight = 2.0;
        }

        let score = 0;
        if (algoMode === 'smart') {
          score = views * 0.2 + likes * 2.5 + likeRatio * 50 + recencyWeight * 100;
        } else if (algoMode === 'viral') {
          score = views * 0.6 + likes * 3.0 + (video.isTrending ? 500 : 0);
        } else if (algoMode === 'fresh') {
          score = recencyWeight * 300 + (video.createdAt || 0) * 0.000001 + likes * 1.5;
        } else if (algoMode === 'underrated') {
          score = likeRatio * 150 + (views < 200000 ? 300 : 50);
        }

        return { video, score };
      })
      .filter(({ video }) => {
        if (tagFilter === 'all') return true;
        return (
          video.category.toLowerCase() === tagFilter.toLowerCase() ||
          video.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))
        );
      })
      .sort((a, b) => b.score - a.score)
      .map(({ video }) => video);
  }, [videos, algoMode, tagFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(4);
  }, [algoMode, tagFilter]);

  const handleLoadMore = useCallback(() => {
    if (visibleCount >= scoredVideos.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 4, scoredVideos.length));
      setIsLoadingMore(false);
    }, 350);
  }, [visibleCount, scoredVideos.length, isLoadingMore]);

  // IntersectionObserver for automatic lazy loading when user scrolls near bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && visibleCount < scoredVideos.length) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, scoredVideos.length, isLoadingMore, handleLoadMore]);

  const visibleVideos = scoredVideos.slice(0, visibleCount);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-[var(--surface)] border border-[var(--ink-faint)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF0000] text-white shadow-md">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">
                Custom Discovery Feed
              </h1>
              <span className="rounded-md bg-[#FF0000]/10 text-[#FF0000] text-xs px-2.5 py-0.5 font-bold">
                Live Ranking
              </span>
            </div>
            <p className="text-xs text-[var(--ink-medium)] mt-1">
              Tune how your feed prioritizes engagement, freshness, or under-discovered creators.
            </p>
          </div>
        </div>

        {/* Feed Tuning Modes */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          <button
            type="button"
            onClick={() => setAlgoMode('smart')}
            className={`flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              algoMode === 'smart'
                ? 'bg-[#FF0000] text-white shadow-sm'
                : 'bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink-medium)] hover:text-[var(--ink)]'
            }`}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Balanced</span>
          </button>

          <button
            type="button"
            onClick={() => setAlgoMode('viral')}
            className={`flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              algoMode === 'viral'
                ? 'bg-[#FF0000] text-white shadow-sm'
                : 'bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink-medium)] hover:text-[var(--ink)]'
            }`}
          >
            <Flame className="h-4 w-4 shrink-0" />
            <span>Most Viewed</span>
          </button>

          <button
            type="button"
            onClick={() => setAlgoMode('fresh')}
            className={`flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              algoMode === 'fresh'
                ? 'bg-[#FF0000] text-white shadow-sm'
                : 'bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink-medium)] hover:text-[var(--ink)]'
            }`}
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span>Fresh Drops</span>
          </button>

          <button
            type="button"
            onClick={() => setAlgoMode('underrated')}
            className={`flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              algoMode === 'underrated'
                ? 'bg-[#FF0000] text-white shadow-sm'
                : 'bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink-medium)] hover:text-[var(--ink)]'
            }`}
          >
            <Compass className="h-4 w-4 shrink-0" />
            <span>Hidden Gems</span>
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
        <span className="flex items-center gap-1.5 font-bold text-[var(--ink-medium)] uppercase tracking-wider text-[11px] shrink-0 mr-1">
          <SlidersHorizontal className="h-4 w-4 text-[#FF0000]" />
          Filter:
        </span>
        {filterCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setTagFilter(cat)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 capitalize cursor-pointer ${
              tagFilter === cat
                ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                : 'bg-[var(--surface)] border border-[var(--ink-faint)] text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)]'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Video Grid */}
      {visibleVideos.length === 0 ? (
        <div className="py-20 text-center text-[var(--ink-medium)]">
          <Film className="h-8 w-8 mx-auto mb-2 text-[#FF0000]" />
          <p className="text-base font-bold text-[var(--ink)]">
            No videos match this category filter
          </p>
          <p className="text-xs text-[var(--ink-medium)] mt-1">
            Try switching to Balanced mode or selecting All Categories.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {visibleVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              channel={channels[video.channelId]}
              onPlay={onPlayVideo}
              onSelectChannel={onSelectChannel}
              onToggleWatchLater={onToggleWatchLater}
              isWatchLater={watchLaterIds.includes(video.id)}
              playlists={playlists}
              onAddToPlaylist={onAddToPlaylist}
            />
          ))}
        </div>
      )}

      {/* Lazy Loading Sentinel & Trigger */}
      <div ref={loadMoreRef} className="py-6 flex flex-col items-center justify-center">
        {isLoadingMore ? (
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[var(--surface)] text-[var(--ink)] text-xs font-bold border border-[var(--ink-faint)]">
            <RefreshCw className="h-4 w-4 animate-spin text-[#FF0000]" />
            <span>Loading more recommendations...</span>
          </div>
        ) : visibleCount < scoredVideos.length ? (
          <button
            type="button"
            onClick={handleLoadMore}
            className="flex items-center gap-2 min-h-[42px] px-6 py-2.5 rounded-full bg-[var(--surface)] border border-[var(--ink-faint)] hover:bg-[#FF0000] hover:text-white hover:border-[#FF0000] text-[var(--ink)] text-xs font-bold transition-all shadow-xs group cursor-pointer"
          >
            <TrendingUp className="h-4 w-4 text-[#FF0000] group-hover:text-white transition-colors" />
            <span>Load More ({scoredVideos.length - visibleCount} remaining)</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[var(--ink-medium)]">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>You've reached the end of this custom feed</span>
          </div>
        )}
      </div>
    </div>
  );
};
