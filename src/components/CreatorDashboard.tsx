import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Film,
  BarChart3,
  Paintbrush,
  MessageSquare,
  Upload,
  Plus,
  Play,
  Edit3,
  Trash2,
  Copy,
  Check,
  Globe,
  EyeOff,
  Lock,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Users,
  Eye,
  ThumbsUp,
  Search,
  CheckCircle2,
  Save,
  Sparkles,
  DollarSign,
  Wand2,
  Scissors,
  Subtitles,
  Palette,
  Smartphone,
  Volume2,
  Maximize2,
  SlidersHorizontal,
  RefreshCw,
  Download,
  Activity,
  Signal,
  Cpu,
  Layers
} from 'lucide-react';
import { VideoItem, Channel, Comment } from '../types/video';
import { formatTime } from '../utils/formatTime';
import { DEFAULT_PLAYABLE_VIDEO_URL, sanitizePlayableVideoUrl } from '../services/streamingService';
import { formatViews, formatSubscribers } from '../data/mockData';
import { EditVideoModal } from './EditVideoModal';
import { calculateRevenueSplit, estimateEarningsFromViews } from '../utils/revenueSharing';
import { HlsStreamingMetricsPanel } from './HlsStreamingMetricsPanel';
import { uploadImageAsset } from '../services/firebaseDatabaseService';

interface CreatorDashboardProps {
  channel: Channel;
  videos: VideoItem[];
  comments: Record<string, Comment[]>;
  onPlayVideo: (video: VideoItem) => void;
  onOpenUpload: () => void;
  onUpdateVideo: (video: VideoItem) => void;
  onDeleteVideo: (videoId: string) => void;
  onUpdateChannel: (channel: Channel) => void;
  onDeleteComment: (videoId: string, commentId: string) => void;
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({
  channel,
  videos,
  comments,
  onPlayVideo,
  onOpenUpload,
  onUpdateVideo,
  onDeleteVideo,
  onUpdateChannel,
  onDeleteComment,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'content' | 'analytics' | 'hls-metrics' | 'customization' | 'comments' | 'monetization' | 'ai-editor'
  >('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'unlisted' | 'private'>('all');
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Revenue Sharing Calculator State
  const [calcEarningsInput, setCalcEarningsInput] = useState<number>(3500);

  // AI Video Studio Editor State
  const [selectedEditorVideoId, setSelectedEditorVideoId] = useState<string>(
    videos.find((v) => v.channelId === channel.id)?.id || videos[0]?.id || ''
  );
  const [aiTools, setAiTools] = useState({
    autoCut: false,
    autoCaptions: true,
    lutGrade: true,
    audioDucking: false,
    highlights: false,
    shortsFormat: false,
    autoZoom: false,
    sfxEnhance: true,
  });
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<string | null>(null);

  // Customization Form State
  const [channelName, setChannelName] = useState(channel.name);
  const [channelHandle, setChannelHandle] = useState(channel.handle);
  const [channelBio, setChannelBio] = useState(channel.bio);
  const [channelAvatar, setChannelAvatar] = useState(channel.avatar);
  const [channelBanner, setChannelBanner] = useState(channel.banner);
  const [customizationSaved, setCustomizationSaved] = useState(false);
  const [customUploadError, setCustomUploadError] = useState<string | null>(null);
  const [customUploading, setCustomUploading] = useState<'avatar' | 'banner' | null>(null);
  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const bannerUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChannelName(channel.name);
    setChannelHandle(channel.handle);
    setChannelBio(channel.bio);
    setChannelAvatar(channel.avatar);
    setChannelBanner(channel.banner);
  }, [channel]);

  const handleChannelImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'avatar' | 'banner'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCustomUploadError(null);
    setCustomUploading(field);
    try {
      const res = await uploadImageAsset(file, 'profileImages');
      if (field === 'avatar') setChannelAvatar(res.url);
      else setChannelBanner(res.url);
    } catch (err: any) {
      setCustomUploadError(err?.message || 'Could not process image file.');
    } finally {
      setCustomUploading(null);
    }
  };

  // Channel Specific Videos
  const channelVideos = videos.filter((v) => v.channelId === channel.id);
  const totalViews = channelVideos.reduce((acc, v) => acc + (v.views || 0), 0);
  const totalLikes = channelVideos.reduce((acc, v) => acc + (v.likes || 0), 0);
  const totalDurationSec = channelVideos.reduce((acc, v) => acc + (v.duration || 0), 0);
  const totalWatchHours = ((totalViews * 45) / 3600).toFixed(1); // estimated watch hours

  const latestVideo = channelVideos[0];

  // Filtered Content
  const filteredContent = channelVideos.filter((v) => {
    const matchesSearch =
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesVis =
      visibilityFilter === 'all' || (v.visibility || 'public') === visibilityFilter;
    return matchesSearch && matchesVis;
  });

  // All comments on channel's videos
  const channelComments: { comment: Comment; videoTitle: string }[] = [];
  channelVideos.forEach((v) => {
    const vComments = comments[v.id] || [];
    vComments.forEach((c) => {
      channelComments.push({ comment: c, videoTitle: v.title });
    });
  });

  const handleCopyLink = (videoId: string) => {
    const link = `${window.location.origin}${window.location.pathname}?v=${videoId}`;
    navigator.clipboard?.writeText(link);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveCustomization = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateChannel({
      ...channel,
      name: channelName.trim() || channel.name,
      handle: channelHandle.trim() || channel.handle,
      bio: channelBio.trim() || channel.bio,
      avatar: channelAvatar.trim() || channel.avatar,
      banner: channelBanner.trim() || channel.banner,
    });
    setCustomizationSaved(true);
    setTimeout(() => setCustomizationSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Studio Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={channel.avatar}
              alt={channel.name}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.opacity = '0.4';
              }}
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-slate-200 dark:ring-slate-700 shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {channel.name} Studio
                </h1>
                <span className="rounded-md bg-red-600/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  Creator Dashboard
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{channel.handle}</span>
                <span aria-hidden="true">·</span>
                <span>{formatSubscribers(channel.subscribersCount)}</span>
                <span aria-hidden="true">·</span>
                <span>{channelVideos.length} uploaded videos</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-500 active:scale-95 transition-all"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Video</span>
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-4 scrollbar-none">
          {[
            { id: 'overview', name: 'Dashboard', icon: LayoutDashboard },
            { id: 'content', name: 'Content Manager', icon: Film },
            { id: 'analytics', name: 'Channel Analytics', icon: BarChart3 },
            { id: 'hls-metrics', name: 'HLS Streaming Telemetry', icon: Activity },
            { id: 'monetization', name: 'Monetization (30/70)', icon: DollarSign },
            { id: 'ai-editor', name: 'AI Video Studio', icon: Wand2 },
            { id: 'comments', name: 'Comments', icon: MessageSquare },
            { id: 'customization', name: 'Branding & Customization', icon: Paintbrush },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                  isSel
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Total Views</span>
                <Eye className="h-4 w-4 text-sky-500" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                {totalViews.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+14.8% vs last 28 days</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Watch Time (Hours)</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                {totalWatchHours} hrs
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+9.2% engagement</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Followers</span>
                <Users className="h-4 w-4 text-red-500" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                {channel.subscribersCount.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+1,240 new followers</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Total Likes</span>
                <ThumbsUp className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                {totalLikes.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>99.2% positive rating</span>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Latest Video Performance & Quick Studio Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Latest Video Card */}
            <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Latest Video Performance
                </h3>
                <span className="text-xs text-slate-400">Uploaded {latestVideo?.publishedAt || 'recently'}</span>
              </div>

              {latestVideo ? (
                <div className="mt-4 flex flex-col sm:flex-row gap-5 items-start">
                  <div
                    onClick={() => onPlayVideo(latestVideo)}
                    className="relative aspect-video w-full sm:w-56 shrink-0 overflow-hidden rounded-2xl bg-black cursor-pointer group"
                  >
                    <img
                      src={latestVideo.poster}
                      alt={latestVideo.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.4';
                      }}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-8 w-8 fill-white text-white" />
                    </div>
                    <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-mono text-white">
                      {formatTime(latestVideo.duration)}
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <h4
                      onClick={() => onPlayVideo(latestVideo)}
                      className="text-base font-bold text-slate-900 dark:text-white hover:text-red-500 transition-colors cursor-pointer line-clamp-2"
                    >
                      {latestVideo.title}
                    </h4>

                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Ranking</span>
                        <strong className="font-bold text-slate-900 dark:text-white">1 of {channelVideos.length}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Views</span>
                        <strong className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatViews(latestVideo.views)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Likes</span>
                        <strong className="font-mono font-bold text-slate-900 dark:text-white">
                          {latestVideo.likes.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => onPlayVideo(latestVideo)}
                        className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                      >
                        Watch Video
                      </button>
                      <button
                        onClick={() => setEditingVideo(latestVideo)}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Edit Details
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 px-4 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Film className="h-7 w-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Videos Uploaded Yet</h4>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                    Publish your first high-definition animation, VFX clip, or nature film to start tracking audience analytics.
                  </p>
                  <button
                    onClick={onOpenUpload}
                    className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                  >
                    Upload First Video
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions & Tips (Aligned and perfectly proportioned) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Creator Fast Actions
              </h3>

              <div className="space-y-2.5">
                <button
                  onClick={onOpenUpload}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 hover:border-red-500/30 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all text-left"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Upload New Video</div>
                      <div className="text-[11px] text-slate-400 truncate">Publish in 1080p / 4K multi-res</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-red-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ml-2" />
                </button>

                <button
                  onClick={() => setActiveTab('customization')}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 hover:border-sky-500/30 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all text-left"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                      <Paintbrush className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Channel Branding</div>
                      <div className="text-[11px] text-slate-400 truncate">Update banner, avatar & bio</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ml-2" />
                </button>

                <button
                  onClick={() => setActiveTab('content')}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 hover:border-indigo-500/30 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all text-left"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                      <Film className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Manage Content</div>
                      <div className="text-[11px] text-slate-400 truncate">{channelVideos.length} uploads organized</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ml-2" />
                </button>
              </div>
            </div>
          </div>

          {/* Real-time HLS Streaming & Cloud-Transcoding Quick Monitor */}
          <div className="rounded-3xl border border-purple-500/25 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-amber-500/5 p-6 dark:border-purple-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-500/20">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      HLS Streaming & Cloud-Transcoding Performance
                    </h3>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Stream Telemetry
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Real-time buffer health, rebuffering frequency, and ABR bitrates across active viewers
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('hls-metrics')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold shadow-md transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                <span>Open Full HLS Studio</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Buffer Health</span>
                <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">14.6s</div>
                <span className="text-[10px] text-slate-500">Optimal (Zero Stalls)</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Rebuffer Frequency</span>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white">0.02</div>
                <span className="text-[10px] text-slate-500">Stalls / Stream Hour</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">1080p60 Bitrate</span>
                <div className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">6.18 Mbps</div>
                <span className="text-[10px] text-slate-500">VBR Dynamic Ladder</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Anycast CDN Cache</span>
                <div className="text-xl font-black font-mono text-sky-600 dark:text-sky-400">98.9%</div>
                <span className="text-[10px] text-slate-500">285 Edge Locations</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTENT / VIDEO MANAGER TABLE */}
      {activeTab === 'content' && (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Channel Content
              </h2>
              <p className="text-xs text-slate-500">
                {channelVideos.length} total videos uploaded to this channel
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search in channel */}
              <div className="relative flex-1 min-w-[140px] sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              {/* Visibility Filter */}
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as any)}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none"
              >
                <option value="all">All Visibility</option>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>

              <button
                onClick={onOpenUpload}
                className="min-h-[40px] flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-500 shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Upload</span>
              </button>
            </div>
          </div>

          {/* Videos Table */}
          {filteredContent.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Film className="h-7 w-7 opacity-75" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Matching Videos</h4>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                No videos match your filter or search query. Try another keyword or reset visibility filter.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setVisibilityFilter('all');
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Reset Filter
                </button>
                <button
                  onClick={onOpenUpload}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                >
                  Upload New Video
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-2">Video</th>
                    <th className="py-3 px-2">Visibility</th>
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2 text-right">Views</th>
                    <th className="py-3 px-2 text-right">Likes</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredContent.map((vid) => {
                    const vis = vid.visibility || 'public';
                    const isCopied = copiedId === vid.id;
                    return (
                      <tr
                        key={vid.id}
                        className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Video Info Column */}
                        <td className="py-3 px-2 min-w-[280px]">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => onPlayVideo(vid)}
                              className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-black cursor-pointer group/thumb"
                            >
                              <img
                                src={vid.poster}
                                alt={vid.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.opacity = '0.4';
                                }}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                <Play className="h-4 w-4 fill-white text-white" />
                              </div>
                              <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[9px] font-mono text-white">
                                {formatTime(vid.duration)}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4
                                onClick={() => onPlayVideo(vid)}
                                className="font-bold text-slate-900 dark:text-white hover:text-red-500 transition-colors cursor-pointer line-clamp-1"
                              >
                                {vid.title}
                              </h4>
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {vid.description}
                              </p>
                              <span className="text-[10px] text-slate-500 font-medium">
                                #{vid.category || 'General'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Visibility Column */}
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              vis === 'public'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : vis === 'unlisted'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {vis === 'public' && <Globe className="h-3 w-3" />}
                            {vis === 'unlisted' && <EyeOff className="h-3 w-3" />}
                            {vis === 'private' && <Lock className="h-3 w-3" />}
                            <span className="capitalize">{vis}</span>
                          </span>
                        </td>

                        {/* Published Date */}
                        <td className="py-3 px-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                          {vid.publishedAt}
                        </td>

                        {/* Views */}
                        <td className="py-3 px-2 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                          {vid.views.toLocaleString()}
                        </td>

                        {/* Likes */}
                        <td className="py-3 px-2 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                          {vid.likes.toLocaleString()}
                        </td>

                        {/* Quick Actions */}
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          {confirmDeleteId === vid.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteVideo(vid.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="min-h-[34px] rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[34px] rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onPlayVideo(vid)}
                                title="Play Video"
                                aria-label={`Play ${vid.title}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Play className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingVideo(vid)}
                                title="Edit Details"
                                aria-label={`Edit ${vid.title}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyLink(vid.id)}
                                title="Copy Link"
                                aria-label={`Copy link for ${vid.title}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(vid.id)}
                                title="Delete Video"
                                aria-label={`Delete ${vid.title}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHANNEL ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Views Over Time (Last 7 Days)
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Your channel got <strong className="text-slate-900 dark:text-white">{totalViews.toLocaleString()} views</strong> in this period.
            </p>

            {/* Simulated Visual Analytics Bar Chart */}
            <div className="flex items-end justify-between gap-2 h-44 pt-6 px-4 border-b border-slate-100 dark:border-slate-800">
              {[
                { day: 'Mon', val: 45, label: '45K' },
                { day: 'Tue', val: 62, label: '62K' },
                { day: 'Wed', val: 85, label: '85K' },
                { day: 'Thu', val: 74, label: '74K' },
                { day: 'Fri', val: 110, label: '110K' },
                { day: 'Sat', val: 140, label: '140K' },
                { day: 'Sun', val: 165, label: '165K' },
              ].map((item) => (
                <div key={item.day} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                  <span className="text-[10px] font-mono font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.label}
                  </span>
                  <div
                    className="w-full max-w-[48px] rounded-t-xl bg-red-600 group-hover:bg-red-500 transition-all shadow-xs"
                    style={{ height: `${(item.val / 170) * 100}%` }}
                  />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {item.day}
                  </span>
                </div>
              ))}
            </div>

            {/* Traffic Sources Breakdown */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <span className="text-slate-400 font-semibold block text-[11px]">Vio streaming / Global Search</span>
                <strong className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">48.2%</strong>
                <p className="text-[11px] text-slate-400 mt-0.5">Top keyword: "Blender 3D VFX"</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <span className="text-slate-400 font-semibold block text-[11px]">Suggested Videos</span>
                <strong className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">34.6%</strong>
                <p className="text-[11px] text-slate-400 mt-0.5">From related open movie reels</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <span className="text-slate-400 font-semibold block text-[11px]">Direct / External Links</span>
                <strong className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">17.2%</strong>
                <p className="text-[11px] text-slate-400 mt-0.5">Social shares & embed players</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: REAL-TIME HLS STREAMING & CLOUD TRANSCODING TELEMETRY */}
      {activeTab === 'hls-metrics' && (
        <HlsStreamingMetricsPanel videos={videos} />
      )}

      {/* TAB 4: COMMENTS MODERATION */}
      {activeTab === 'comments' && (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Channel Comments ({channelComments.length})
            </h2>
            <p className="text-xs text-slate-500">
              Manage and reply to viewers across all your videos
            </p>
          </div>

          {channelComments.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No comments on your videos yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {channelComments.map(({ comment, videoTitle }) => (
                <div
                  key={comment.id}
                  className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <img
                      src={comment.authorAvatar}
                      alt={comment.authorName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.4';
                      }}
                      className="h-9 w-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {comment.authorName}
                        </span>
                        <span className="text-[11px] text-slate-400">{comment.authorHandle}</span>
                        <span aria-hidden="true" className="text-slate-400 text-xs">·</span>
                        <span className="text-[11px] text-slate-400">{comment.timestamp}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {comment.content}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                        <span>On video: <strong className="text-slate-700 dark:text-slate-300">{videoTitle}</strong></span>
                        <span aria-hidden="true">·</span>
                        <span>{comment.likes} likes</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteComment(comment.videoId, comment.id)}
                    title="Delete Comment"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BRANDING & CUSTOMIZATION */}
      {activeTab === 'customization' && (
        <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Channel Branding & Profile
            </h2>
            <p className="text-xs text-slate-500">
              Customize how your channel appears to followers and viewers
            </p>
          </div>

          <form onSubmit={handleSaveCustomization} className="mt-5 space-y-4">
            {customizationSaved && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Channel branding updated successfully!</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Channel Name
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Channel Handle
              </label>
              <input
                type="text"
                value={channelHandle}
                onChange={(e) => setChannelHandle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Channel Bio / Description
              </label>
              <textarea
                rows={3}
                value={channelBio}
                onChange={(e) => setChannelBio(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
              />
            </div>

            {customUploadError && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {customUploadError}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Profile Photo / Avatar
                </label>
                <button
                  type="button"
                  onClick={() => avatarUploadRef.current?.click()}
                  disabled={customUploading !== null}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-red-500 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{customUploading === 'avatar' ? 'Uploading...' : 'Upload Photo'}</span>
                </button>
                <input
                  ref={avatarUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleChannelImageUpload(e, 'avatar')}
                  className="hidden"
                />
              </div>
              <div className="flex items-center gap-3">
                <img
                  src={channelAvatar || channel.avatar}
                  alt="Avatar preview"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0.4';
                  }}
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-300 dark:ring-slate-700 shrink-0"
                />
                <input
                  type="url"
                  value={channelAvatar.startsWith('data:') ? '' : channelAvatar}
                  placeholder="Or paste avatar image URL..."
                  onChange={(e) => setChannelAvatar(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-base sm:text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Panoramic Banner
                </label>
                <button
                  type="button"
                  onClick={() => bannerUploadRef.current?.click()}
                  disabled={customUploading !== null}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-red-500 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{customUploading === 'banner' ? 'Uploading...' : 'Upload Banner'}</span>
                </button>
                <input
                  ref={bannerUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleChannelImageUpload(e, 'banner')}
                  className="hidden"
                />
              </div>
              {(channelBanner || channel.banner) && (
                <div className="mb-2 h-24 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900">
                  <img
                    src={channelBanner || channel.banner}
                    alt="Channel banner preview"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.35';
                    }}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <input
                type="url"
                value={channelBanner.startsWith('data:') ? '' : channelBanner}
                placeholder="Or paste banner image URL..."
                onChange={(e) => setChannelBanner(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-base sm:text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={customUploading !== null}
                className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-500 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Channel Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: MONETIZATION & REVENUE SHARING (30% Creator / 70% Platform Split) */}
      {activeTab === 'monetization' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-slate-900/10 to-transparent p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/30">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      Creator Monetization & Revenue Sharing
                    </h2>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      Active Partner
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Platform standard: strict <strong className="text-emerald-600 dark:text-emerald-400">30% to creator</strong> and <strong className="text-slate-700 dark:text-slate-300">70% to platform owner</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Payout Schedule:</span>
                <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                  Monthly (15th)
                </span>
              </div>
            </div>
          </div>

          {/* Revenue Split Overview Cards */}
          {(() => {
            const channelRevenue = estimateEarningsFromViews(totalViews);
            const calcSplit = calculateRevenueSplit(calcEarningsInput);

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Gross Earnings */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                      <span>Total Channel Gross</span>
                      <TrendingUp className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                      {channelRevenue.formattedTotal}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Estimated from {totalViews.toLocaleString()} views @ $2.50 RPM
                    </p>
                  </div>

                  {/* 30% Creator Payout */}
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.04] p-5 shadow-xs dark:bg-emerald-500/[0.06]">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <span>Creator Payout (30%)</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                      {channelRevenue.formattedCreatorShare}
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                      Direct earnings deposited to your account
                    </p>
                  </div>

                  {/* 70% Platform Infrastructure */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                      <span>Platform Owner Share (70%)</span>
                      <Globe className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-2 text-2xl font-black tabular-nums text-slate-700 dark:text-slate-300">
                      {channelRevenue.formattedPlatformShare}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Global CDN delivery, video encoding, cloud storage
                    </p>
                  </div>
                </div>

                {/* Interactive Revenue Split Calculator */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Interactive Revenue Split Simulator
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Calculate exact creator (30%) and platform (70%) distribution for any gross earnings amount.
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {[500, 1500, 3500, 10000, 25000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setCalcEarningsInput(amt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            calcEarningsInput === amt
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          ${amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Gross Total Earnings (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={calcEarningsInput}
                          onChange={(e) => setCalcEarningsInput(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      {/* Visual Ratio Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Creator Share: 30% ({calcSplit.formattedCreatorShare})
                          </span>
                          <span className="text-slate-500">
                            Platform Owner: 70% ({calcSplit.formattedPlatformShare})
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                          <div
                            style={{ width: '30%' }}
                            className="h-full bg-emerald-500 transition-all duration-300"
                          />
                          <div
                            style={{ width: '70%' }}
                            className="h-full bg-slate-500 dark:bg-slate-600 transition-all duration-300"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-500">Gross Revenue:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{calcSplit.formattedTotal}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60 text-emerald-600 dark:text-emerald-400">
                        <span className="font-semibold">Creator Payout (30%):</span>
                        <span className="font-black">{calcSplit.formattedCreatorShare}</span>
                      </div>
                      <div className="flex justify-between py-1 text-slate-600 dark:text-slate-300">
                        <span>Platform Owner Share (70%):</span>
                        <span className="font-bold">{calcSplit.formattedPlatformShare}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video-Level Monetization Table */}
                <div className="rounded-3xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Video Monetization Breakdown
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Estimated earnings calculated per video applying the strict 30/70 platform split.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3.5 pl-5">Video</th>
                          <th className="p-3.5">Views</th>
                          <th className="p-3.5">Gross Revenue</th>
                          <th className="p-3.5 text-emerald-600 dark:text-emerald-400">Creator 30%</th>
                          <th className="p-3.5">Platform 70%</th>
                          <th className="p-3.5 pr-5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {channelVideos.map((v) => {
                          const vSplit = estimateEarningsFromViews(v.views || 0);
                          return (
                            <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-3.5 pl-5 flex items-center gap-3">
                                <img
                                  src={v.poster}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.opacity = '0.4';
                                  }}
                                  className="h-10 w-16 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                                />
                                <span className="font-bold text-slate-900 dark:text-white line-clamp-1 max-w-[200px]">
                                  {v.title}
                                </span>
                              </td>
                              <td className="p-3.5 tabular-nums text-slate-600 dark:text-slate-300">
                                {(v.views || 0).toLocaleString()}
                              </td>
                              <td className="p-3.5 font-bold tabular-nums text-slate-900 dark:text-white">
                                {vSplit.formattedTotal}
                              </td>
                              <td className="p-3.5 font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                                {vSplit.formattedCreatorShare}
                              </td>
                              <td className="p-3.5 font-medium tabular-nums text-slate-500">
                                {vSplit.formattedPlatformShare}
                              </td>
                              <td className="p-3.5 pr-5">
                                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  Monetized
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* TAB 7: AI VIDEO EDITING STUDIO (Toolbar buttons exactly 40x40 pixels with active states) */}
      {activeTab === 'ai-editor' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/20 via-slate-900/10 to-transparent p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
                  <Wand2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      Vio streaming AI Video Studio
                    </h2>
                    <span className="rounded-full bg-purple-100 dark:bg-purple-950/80 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Pro Suite
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Automated silence cut, speech captions, cinematic LUT color grading, audio ducking, and 9:16 Shorts reformatting.
                  </p>
                </div>
              </div>

              {/* Video Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Select Video:</span>
                <select
                  value={selectedEditorVideoId}
                  onChange={(e) => setSelectedEditorVideoId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white max-w-[200px] truncate"
                >
                  {channelVideos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Editor Workspace & 40x40px Toolbar */}
          {(() => {
            const currentEditVideo =
              channelVideos.find((v) => v.id === selectedEditorVideoId) || channelVideos[0] || videos[0];

            const toggleTool = (toolKey: keyof typeof aiTools) => {
              setAiTools((prev) => {
                const next = { ...prev, [toolKey]: !prev[toolKey] };
                setAiStatusMsg(`AI ${String(toolKey)} set to ${next[toolKey] ? 'Active' : 'Disabled'}`);
                setTimeout(() => setAiStatusMsg(null), 2000);
                return next;
              });
            };

            const handleRunRender = () => {
              setIsProcessingAI(true);
              setTimeout(() => {
                setIsProcessingAI(false);
                setAiStatusMsg('AI rendering complete! Video enhancements applied successfully.');
                setTimeout(() => setAiStatusMsg(null), 3000);
              }, 1200);
            };

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Video Preview Canvas */}
                <div className="lg:col-span-8 rounded-3xl border border-slate-200 bg-black p-4 shadow-xl dark:border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                  <div
                    className={`relative overflow-hidden rounded-2xl bg-slate-900 transition-all duration-300 ${
                      aiTools.shortsFormat
                        ? 'w-[min(280px,100%)] aspect-[9/16] max-h-[65vh]'
                        : 'w-full aspect-video max-h-[460px]'
                    }`}
                  >
                    <video
                      key={currentEditVideo?.id || 'studio-preview'}
                      src={sanitizePlayableVideoUrl(currentEditVideo?.url, currentEditVideo?.id, 'video', false)}
                      poster={currentEditVideo?.poster}
                      controls
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.dataset.fallbackApplied === 'true') return;
                        if (target.src !== DEFAULT_PLAYABLE_VIDEO_URL) {
                          target.dataset.fallbackApplied = 'true';
                          target.src = DEFAULT_PLAYABLE_VIDEO_URL;
                          target.load();
                        }
                      }}
                      className={`w-full h-full object-cover transition-all ${
                        aiTools.lutGrade ? 'saturate-125 contrast-110 brightness-105' : ''
                      }`}
                    />

                    {/* Auto-Captions Overlay Preview */}
                    {aiTools.autoCaptions && (
                      <div className="absolute bottom-12 inset-x-4 flex justify-center pointer-events-none">
                        <span className="rounded-lg bg-black/80 px-3 py-1 text-xs font-bold text-yellow-300 shadow-md backdrop-blur-xs text-center">
                          "Transforming creative vision into high-definition reality on Vio streaming..."
                        </span>
                      </div>
                    )}

                    {/* Active Processing Indicator */}
                    {isProcessingAI && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3 z-30 animate-in fade-in">
                        <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
                        <span className="text-sm font-bold">Applying AI Neural Color & Silence Cuts...</span>
                      </div>
                    )}
                  </div>

                  {/* Status Banner */}
                  {aiStatusMsg && (
                    <div className="mt-3 px-3 py-1 rounded-full bg-purple-600/90 text-white text-xs font-semibold shadow-md animate-in fade-in">
                      {aiStatusMsg}
                    </div>
                  )}
                </div>

                {/* Right: Dedicated AI Toolbar (Toolbar buttons 40x40 pixels with active states) */}
                <div className="lg:col-span-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      AI Studio Toolbar
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      40x40px quick toggles with live preview feedback.
                    </p>
                  </div>

                  {/* 40x40px Toolbar Buttons Grid */}
                  <div className="space-y-2.5">
                    {[
                      {
                        key: 'autoCut' as const,
                        name: 'Auto-Cut & Silence Remover',
                        desc: 'Trim dead air & pauses',
                        icon: Scissors,
                      },
                      {
                        key: 'autoCaptions' as const,
                        name: 'AI Dynamic Subtitles',
                        desc: 'Generate animated subtitles',
                        icon: Subtitles,
                      },
                      {
                        key: 'lutGrade' as const,
                        name: 'Cinematic Color Grading',
                        desc: 'Kodak 4K color profile',
                        icon: Palette,
                      },
                      {
                        key: 'audioDucking' as const,
                        name: 'Audio Ducking & Voice Clarity',
                        desc: 'Suppress background noise',
                        icon: Volume2,
                      },
                      {
                        key: 'highlights' as const,
                        name: 'AI Viral Highlights',
                        desc: 'Extract key moments',
                        icon: Sparkles,
                      },
                      {
                        key: 'shortsFormat' as const,
                        name: '9:16 Shorts Reformatter',
                        desc: 'Vertical crop & face tracking',
                        icon: Smartphone,
                      },
                      {
                        key: 'autoZoom' as const,
                        name: 'Dynamic Motion & Zoom',
                        desc: 'Subtle punch-in on emphasis',
                        icon: Maximize2,
                      },
                      {
                        key: 'sfxEnhance' as const,
                        name: 'Audio SFX Enhancer',
                        desc: 'Crisp transients & bass',
                        icon: SlidersHorizontal,
                      },
                    ].map((tool) => {
                      const Icon = tool.icon;
                      const isActive = aiTools[tool.key];

                      return (
                        <div
                          key={tool.key}
                          className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            {/* 
                              Exact toolbar button dimension: 40x40 pixels 
                              w-10 h-10 (40x40px) with active state styles
                            */}
                            <button
                              onClick={() => toggleTool(tool.key)}
                              title={`${tool.name} (${isActive ? 'Active' : 'Inactive'})`}
                              style={{ width: '40px', height: '40px' }}
                              className={`w-10 h-10 w-[40px] h-[40px] rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400 scale-105'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </button>

                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                                {tool.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{tool.desc}</p>
                            </div>
                          </div>

                          {/* Active state pill */}
                          <button
                            onClick={() => toggleTool(tool.key)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                              isActive
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isActive ? 'ACTIVE' : 'OFF'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Render & Export Action */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={handleRunRender}
                      disabled={isProcessingAI}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/30 hover:bg-purple-700 disabled:opacity-50 transition-all"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Process & Apply AI</span>
                    </button>

                    <button
                      onClick={() => {
                        setAiStatusMsg('Master copy exported to Vio streaming CDN.');
                        setTimeout(() => setAiStatusMsg(null), 2500);
                      }}
                      title="Export Video"
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Edit Video Modal */}
      {editingVideo && (
        <EditVideoModal
          isOpen={!!editingVideo}
          onClose={() => setEditingVideo(null)}
          video={editingVideo}
          onSave={onUpdateVideo}
        />
      )}
    </div>
  );
};
