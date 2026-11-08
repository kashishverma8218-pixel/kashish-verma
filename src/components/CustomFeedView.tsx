import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  Flame,
  Clock,
  Compass,
  Cpu,
  SlidersHorizontal,
  TrendingUp,
  RefreshCw,
  Eye,
  ThumbsUp,
  CheckCircle2,
  Film
} from 'lucide-react';
import { VideoItem, Channel } from '../types/video';
import { VideoCard } from './VideoCard';

interface CustomFeedViewProps {
  videos: VideoItem[];
  channels: Record<string, Channel>;
  onPlayVideo: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onToggleWatchLater: (videoId: string) => void;
  watchLaterIds: string[];
}

export const CustomFeedView: React.FC<CustomFeedViewProps> = ({
  videos,
  channels,
  onPlayVideo,
  onSelectChannel,
  onToggleWatchLater,
  watchLaterIds,
}) => {
  // Algorithm tuning profiles
  const [algoMode, setAlgoMode] = useState<'smart' | 'viral' | 'fresh' | 'underrated'>('smart');
  const [tagFilter, setTagFilter] = useState<string>('all');
  
  // Lazy Loading state: start with 4 videos, incrementally load 4 more
  const [visibleCount, setVisibleCount] = useState<number>(4);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Compute algorithmic score for each video
  const scoredVideos = useMemo(() => {
    return videos
      .map((video) => {
        const channel = channels[video.channelId];
        const views = video.views || 0;
        const likes = video.likes || 0;
        const likeRatio = views > 0 ? (likes / views) * 100 : 0;
        const subCount = channel?.subscribersCount || 0;

        // Recency score
        let recencyWeight = 1.0;
        if (video.publishedAt.includes('day') || video.publishedAt.includes('hour')) recencyWeight = 3.0;
        else if (video.publishedAt.includes('week')) recencyWeight = 2.0;

        let score = 0;
        if (algoMode === 'smart') {
          // Balanced multi-factor algorithm: engagement rate + recency + visual quality
          score = views * 0.2 + likes * 2.5 + likeRatio * 50 + recencyWeight * 100;
        } else if (algoMode === 'viral') {
          // Prioritize pure velocity and raw engagement
          score = views * 0.6 + likes * 3.0 + (video.isTrending ? 500 : 0);
        } else if (algoMode === 'fresh') {
          // Prioritize new uploads and low age
          score = recencyWeight * 300 + likes * 1.5;
        } else if (algoMode === 'underrated') {
          // High like ratio relative to view count
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
  }, [videos, channels, algoMode, tagFilter]);

  // Reset pagination when algorithm filters change
  useEffect(() => {
    setVisibleCount(4);
  }, [algoMode, tagFilter]);

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
  }, [visibleCount, scoredVideos.length, isLoadingMore]);

  const handleLoadMore = () => {
    if (visibleCount >= scoredVideos.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 4, scoredVideos.length));
      setIsLoadingMore(false);
    }, 450);
  };

  const visibleVideos = scoredVideos.slice(0, visibleCount);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Header with 24dp icons (h-6 w-6 = 24px / 24dp) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-purple-950/20 via-slate-900/10 to-transparent border border-purple-500/20 dark:border-purple-500/30">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
            {/* 24dp icon: h-6 w-6 = 24px */}
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Vio streaming Algorithmic Feed
              </h1>
              <span className="rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-xs px-2.5 py-0.5 font-bold flex items-center gap-1">
                {/* 24dp scaled down indicator */}
                <Sparkles className="h-3.5 w-3.5" />
                Neural Rank v2
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Personalized neural feed ranking content in real-time based on watch habits, like ratios, and cinematic score.
            </p>
          </div>
        </div>

        {/* Algorithm Tuning Modes (with 24dp icons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          <button
            onClick={() => setAlgoMode('smart')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              algoMode === 'smart'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {/* 24dp icon */}
            <Sparkles className="h-6 w-6 shrink-0" />
            <span>Smart Affinity</span>
          </button>

          <button
            onClick={() => setAlgoMode('viral')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              algoMode === 'viral'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {/* 24dp icon */}
            <Flame className="h-6 w-6 shrink-0" />
            <span>Velocity Surge</span>
          </button>

          <button
            onClick={() => setAlgoMode('fresh')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              algoMode === 'fresh'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {/* 24dp icon */}
            <Clock className="h-6 w-6 shrink-0" />
            <span>Fresh Drops</span>
          </button>

          <button
            onClick={() => setAlgoMode('underrated')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              algoMode === 'underrated'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {/* 24dp icon */}
            <Compass className="h-6 w-6 shrink-0" />
            <span>Hidden Gems</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-slate-400 uppercase tracking-wider text-[11px] shrink-0 mr-1">
          {/* 24dp icon */}
          <SlidersHorizontal className="h-6 w-6 text-purple-500" />
          Filter:
        </span>
        {['all', 'Animation', 'Sci-Fi', 'Film', 'Tutorial', 'Technology'].map((cat) => (
          <button
            key={cat}
            onClick={() => setTagFilter(cat)}
            className={`px-3 py-1.5 rounded-full font-semibold transition-colors shrink-0 capitalize ${
              tagFilter === cat
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video Grid */}
      {visibleVideos.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          {/* 24dp icon */}
          <Film className="h-6 w-6 mx-auto mb-2 text-purple-500" />
          <p className="text-base font-bold text-slate-800 dark:text-slate-200">
            No videos match the current algorithmic criteria
          </p>
          <p className="text-xs text-slate-500 mt-1">Try switching to Smart Affinity or clear filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {visibleVideos.map((video, idx) => (
            <div key={video.id} className="relative group">
              {/* Algorithmic Rank Badge with 24dp icon */}
              <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-900/80 backdrop-blur-md text-white text-[10px] font-bold shadow-md">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span>Rank #{idx + 1}</span>
              </div>
              <VideoCard
                video={video}
                channel={channels[video.channelId]}
                onPlay={onPlayVideo}
                onSelectChannel={onSelectChannel}
                onToggleWatchLater={onToggleWatchLater}
                isWatchLater={watchLaterIds.includes(video.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Lazy Loading Sentinel & Trigger */}
      <div ref={loadMoreRef} className="py-6 flex flex-col items-center justify-center">
        {isLoadingMore ? (
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800/50 animate-pulse">
            {/* 24dp icon */}
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Calculating next algorithmic recommendations...</span>
          </div>
        ) : visibleCount < scoredVideos.length ? (
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-purple-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs group"
          >
            {/* 24dp icon */}
            <TrendingUp className="h-6 w-6 text-purple-500 group-hover:text-white transition-colors" />
            <span>Load More ({scoredVideos.length - visibleCount} remaining)</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {/* 24dp icon */}
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <span>You've explored all algorithmic recommendations for now</span>
          </div>
        )}
      </div>
    </div>
  );
};
