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
  Clapperboard
} from 'lucide-react';
import { VideoItem, ReelItem, Channel, Comment } from '../types/video';
import { formatTime } from '../utils/formatTime';
import { DEFAULT_PLAYABLE_VIDEO_URL, sanitizePlayableVideoUrl } from '../services/streamingService';
import { formatViews, formatSubscribers } from '../data/mockData';
import { EditVideoModal } from './EditVideoModal';
import { calculateRevenueSplit, estimateEarningsFromViews } from '../utils/revenueSharing';
import { HlsStreamingMetricsPanel } from './HlsStreamingMetricsPanel';
import { uploadImageAsset } from '../services/firebaseDatabaseService';

const FALLBACK_POSTER =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80';
const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';

interface CreatorDashboardProps {
  channel: Channel;
  videos: VideoItem[];
  reels?: ReelItem[];
  comments: Record<string, Comment[]>;
  onPlayVideo: (video: VideoItem) => void;
  onPlayReel?: (reelId: string) => void;
  onOpenUpload: () => void;
  onUpdateVideo: (video: VideoItem) => void;
  onDeleteVideo: (videoId: string) => void;
  onUpdateReel?: (reel: ReelItem) => void;
  onDeleteReel?: (reelId: string) => void;
  onUpdateChannel: (channel: Channel) => void;
  onDeleteComment: (videoId: string, commentId: string) => void;
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({
  channel,
  videos,
  reels = [],
  comments,
  onPlayVideo,
  onPlayReel,
  onOpenUpload,
  onUpdateVideo,
  onDeleteVideo,
  onUpdateReel,
  onDeleteReel,
  onUpdateChannel,
  onDeleteComment,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'content' | 'analytics' | 'hls-metrics' | 'customization' | 'comments' | 'monetization' | 'ai-editor'
  >('overview');
  const [contentMediaType, setContentMediaType] = useState<'videos' | 'reels'>('videos');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'unlisted' | 'private'>('all');
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Revenue Sharing Calculator State
  const [calcEarningsInput, setCalcEarningsInput] = useState<number>(3500);

  // Studio Color & Framing Lab State
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

  useEffect(() => {
    const channelMatch = videos.find((v) => v.channelId === channel.id);
    if (!videos.some((v) => v.id === selectedEditorVideoId && v.channelId === channel.id)) {
      setSelectedEditorVideoId(channelMatch?.id || videos[0]?.id || '');
    }
  }, [channel.id, videos, selectedEditorVideoId]);

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

  // Channel Specific Videos & Reels
  const channelVideos = videos.filter((v) => v.channelId === channel.id);
  const channelReels = reels.filter((r) => r.channelId === channel.id);
  const totalVideoViews = channelVideos.reduce((acc, v) => acc + (v.views || 0), 0);
  const totalReelViews = channelReels.reduce((acc, r) => acc + (r.views || 0), 0);
  const totalViews = totalVideoViews + totalReelViews;
  const totalLikes =
    channelVideos.reduce((acc, v) => acc + (v.likes || 0), 0) +
    channelReels.reduce((acc, r) => acc + (r.likes || 0), 0);
  const totalUploadsCount = channelVideos.length + channelReels.length;
  const avgViewsPerUpload = totalUploadsCount > 0 ? Math.round(totalViews / totalUploadsCount) : 0;
  const likeRatePct = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : '0.0';
  const totalWatchHours = ((totalViews * 45) / 3600).toFixed(1);

  const hlsEnabledCount = channelVideos.filter((v) => Boolean(v.hlsManifestUrl)).length;
  const readyVideosCount = channelVideos.filter((v) => (v.transcodingStatus || 'ready') === 'ready').length;
  const processingVideosCount = channelVideos.filter((v) => v.transcodingStatus === 'processing').length;
  const failedVideosCount = channelVideos.filter((v) => v.transcodingStatus === 'failed').length;

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

  const filteredReels = channelReels.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesVis =
      visibilityFilter === 'all' || (r.visibility || 'public') === visibilityFilter;
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
      <div className="relative overflow-hidden rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={channel.avatar || FALLBACK_AVATAR}
              alt={channel.name}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== FALLBACK_AVATAR) target.src = FALLBACK_AVATAR;
              }}
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-[var(--ink-faint)] shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-[var(--ink)] tracking-tight">
                  {channel.name} Studio
                </h1>
                <span className="rounded-md bg-[#FF0000]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF0000] uppercase tracking-wider">
                  Creator Dashboard
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--ink-medium)] flex-wrap">
                <span>{channel.handle}</span>
                <span aria-hidden="true">·</span>
                <span>{formatSubscribers(channel.subscribersCount)}</span>
                <span aria-hidden="true">·</span>
                <span>{channelVideos.length} videos · {channelReels.length} reels</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenUpload}
              className="min-h-[42px] flex items-center gap-2 rounded-full bg-[#FF0000] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#CC0000] active:scale-95 transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Video</span>
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto border-t border-[var(--ink-faint)] pt-4 scrollbar-none">
          {[
            { id: 'overview', name: 'Dashboard', icon: LayoutDashboard },
            { id: 'content', name: 'Content Manager', icon: Film },
            { id: 'analytics', name: 'Channel Analytics', icon: BarChart3 },
            { id: 'hls-metrics', name: 'HLS Streaming Telemetry', icon: Activity },
            { id: 'monetization', name: 'Monetization (30/70)', icon: DollarSign },
            { id: 'ai-editor', name: 'Color & Framing Lab', icon: SlidersHorizontal },
            { id: 'comments', name: 'Comments', icon: MessageSquare },
            { id: 'customization', name: 'Branding & Customization', icon: Paintbrush },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`min-h-[38px] flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSel
                    ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                    : 'text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)]'
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
            <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                <span>Total Views</span>
                <Eye className="h-4 w-4 text-[var(--link)]" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-[var(--ink)]">
                {totalViews.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-medium)] font-semibold">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="tabular-nums">{avgViewsPerUpload.toLocaleString()} avg / upload</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                <span>Est. Watch Time</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-[var(--ink)]">
                {totalWatchHours} hrs
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-medium)] font-semibold">
                <span>Across {totalUploadsCount} total uploads</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                <span>Followers</span>
                <Users className="h-4 w-4 text-[#FF0000]" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-[var(--ink)]">
                {channel.subscribersCount.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-medium)] font-semibold truncate">
                <span>{channel.handle}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                <span>Total Likes</span>
                <ThumbsUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-black tabular-nums text-[var(--ink)]">
                {totalLikes.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                <span className="tabular-nums">{likeRatePct}% like-to-view rate</span>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Latest Video Performance & Quick Studio Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Latest Video Card */}
            <div className="lg:col-span-2 rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--ink-faint)]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--ink)]">
                  Latest Video Performance
                </h3>
                <span className="text-xs text-[var(--ink-medium)]">Uploaded {latestVideo?.publishedAt || 'recently'}</span>
              </div>

              {latestVideo ? (
                <div className="mt-4 flex flex-col sm:flex-row gap-5 items-start">
                  <div
                    onClick={() => onPlayVideo(latestVideo)}
                    className="relative aspect-video w-full sm:w-56 shrink-0 overflow-hidden rounded-2xl bg-black cursor-pointer group"
                  >
                    <img
                      src={latestVideo.poster || FALLBACK_POSTER}
                      alt={latestVideo.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== FALLBACK_POSTER) target.src = FALLBACK_POSTER;
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
                      className="text-base font-bold text-[var(--ink)] hover:text-[#FF0000] transition-colors cursor-pointer line-clamp-2"
                    >
                      {latestVideo.title}
                    </h4>

                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--ink-faint)] text-xs">
                      <div>
                        <span className="text-[var(--ink-medium)] block text-[11px]">Ranking</span>
                        <strong className="font-bold text-[var(--ink)]">1 of {channelVideos.length}</strong>
                      </div>
                      <div>
                        <span className="text-[var(--ink-medium)] block text-[11px]">Views</span>
                        <strong className="font-mono font-bold text-[var(--ink)]">
                          {formatViews(latestVideo.views)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[var(--ink-medium)] block text-[11px]">Likes</span>
                        <strong className="font-mono font-bold text-[var(--ink)]">
                          {latestVideo.likes.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onPlayVideo(latestVideo)}
                        className="min-h-[38px] rounded-full bg-[var(--ink)] px-4 py-1.5 text-xs font-bold text-[var(--bg)] hover:opacity-90 cursor-pointer"
                      >
                        Watch Video
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingVideo(latestVideo)}
                        className="min-h-[38px] rounded-full border border-[var(--ink-faint)] bg-[var(--bg)] px-4 py-1.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--card-hover)] cursor-pointer"
                      >
                        Edit Details
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 px-4 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-[#FF0000]/10 text-[#FF0000] flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Film className="h-7 w-7" />
                  </div>
                  <h4 className="text-sm font-bold text-[var(--ink)]">No Videos Uploaded Yet</h4>
                  <p className="mt-1 text-xs text-[var(--ink-medium)] max-w-sm mx-auto">
                    Publish your first high-definition animation, VFX clip, or nature film to start tracking audience analytics.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    className="mt-4 px-5 py-2 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Upload First Video
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions & Tips (Aligned and perfectly proportioned) */}
            <div className="rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--ink)]">
                Creator Fast Actions
              </h3>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="group flex w-full items-center justify-between rounded-2xl border border-[var(--ink-faint)] bg-[var(--bg)] p-3.5 hover:border-[#FF0000]/40 hover:bg-[var(--card-hover)] transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF0000] text-white shadow-xs group-hover:scale-105 transition-transform">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--ink)] truncate">Upload New Video</div>
                      <div className="text-[11px] text-[var(--ink-medium)] truncate">Publish in 1080p / 4K multi-res</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--ink-medium)] group-hover:text-[#FF0000] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('customization')}
                  className="group flex w-full items-center justify-between rounded-2xl border border-[var(--ink-faint)] bg-[var(--bg)] p-3.5 hover:border-[#3EA6FF]/40 hover:bg-[var(--card-hover)] transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3EA6FF] text-[#0F0F0F] shadow-xs group-hover:scale-105 transition-transform">
                      <Paintbrush className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--ink)] truncate">Channel Branding</div>
                      <div className="text-[11px] text-[var(--ink-medium)] truncate">Update banner, avatar & bio</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--ink-medium)] group-hover:text-[#3EA6FF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className="group flex w-full items-center justify-between rounded-2xl border border-[var(--ink-faint)] bg-[var(--bg)] p-3.5 hover:border-[var(--ink-medium)]/40 hover:bg-[var(--card-hover)] transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--bg)] shadow-xs group-hover:scale-105 transition-transform">
                      <Film className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--ink)] truncate">Manage Content</div>
                      <div className="text-[11px] text-[var(--ink-medium)] truncate">{channelVideos.length} uploads organized</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--ink-medium)] group-hover:text-[var(--ink)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ml-2" />
                </button>
              </div>
            </div>
          </div>

          {/* HLS & Encoding Readiness Summary */}
          <div className="rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF0000] text-white shadow-sm">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--ink)]">
                      HLS & Cloud Transcoding Readiness
                    </h3>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      {readyVideosCount} Ready
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-medium)]">
                    Live encoding status derived from your {channelVideos.length} uploaded channel videos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('hls-metrics')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 active:scale-95 text-xs font-bold shadow-xs transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                <span>Open HLS Telemetry</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)]">
                <span className="text-[11px] font-medium text-[var(--ink-medium)] block mb-0.5">Ready for Playback</span>
                <div className="text-xl font-black font-mono tabular-nums text-emerald-500">{readyVideosCount}</div>
                <span className="text-[10px] text-[var(--ink-medium)]">Videos ready</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)]">
                <span className="text-[11px] font-medium text-[var(--ink-medium)] block mb-0.5">HLS Adaptive Ladder</span>
                <div className="text-xl font-black font-mono tabular-nums text-[var(--link)]">{hlsEnabledCount}</div>
                <span className="text-[10px] text-[var(--ink-medium)]">ABR manifests linked</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)]">
                <span className="text-[11px] font-medium text-[var(--ink-medium)] block mb-0.5">Processing Queue</span>
                <div className="text-xl font-black font-mono tabular-nums text-amber-500">{processingVideosCount}</div>
                <span className="text-[10px] text-[var(--ink-medium)]">Transcoding active</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)]">
                <span className="text-[11px] font-medium text-[var(--ink-medium)] block mb-0.5">Failed Jobs</span>
                <div className={`text-xl font-black font-mono tabular-nums ${failedVideosCount > 0 ? 'text-[#FF0000]' : 'text-[var(--ink)]'}`}>
                  {failedVideosCount}
                </div>
                <span className="text-[10px] text-[var(--ink-medium)]">Needs attention</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTENT / VIDEO & REELS MANAGER TABLE */}
      {activeTab === 'content' && (
        <div className="space-y-4 rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-[var(--ink-faint)]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)]">
                  Channel Content
                </h2>
                <p className="text-xs text-[var(--ink-medium)]">
                  {channelVideos.length} videos · {channelReels.length} reels uploaded to this channel
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-[var(--bg)] p-1 border border-[var(--ink-faint)] self-start">
                <button
                  type="button"
                  onClick={() => {
                    setContentMediaType('videos');
                    setConfirmDeleteId(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    contentMediaType === 'videos'
                      ? 'bg-[var(--ink)] text-[var(--bg)]'
                      : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
                  }`}
                >
                  Videos ({channelVideos.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContentMediaType('reels');
                    setConfirmDeleteId(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    contentMediaType === 'reels'
                      ? 'bg-[var(--ink)] text-[var(--bg)]'
                      : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
                  }`}
                >
                  Reels ({channelReels.length})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search in channel */}
              <div className="relative flex-1 min-w-[140px] sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ink-medium)]" />
                <input
                  type="text"
                  placeholder={contentMediaType === 'videos' ? 'Filter videos...' : 'Filter reels...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] py-1.5 pl-8 pr-3 text-base sm:text-xs text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:border-[var(--ink)] focus:outline-none"
                />
              </div>

              {/* Visibility Filter */}
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as any)}
                className="min-h-[40px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-1.5 text-base sm:text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
              >
                <option value="all">All Visibility</option>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>

              <button
                type="button"
                onClick={onOpenUpload}
                className="min-h-[40px] flex items-center gap-1.5 rounded-full bg-[#FF0000] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#CC0000] shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Upload</span>
              </button>
            </div>
          </div>

          {contentMediaType === 'reels' ? (
            filteredReels.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="h-14 w-14 rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink-medium)] flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Clapperboard className="h-7 w-7 opacity-75" />
                </div>
                <h4 className="text-sm font-bold text-[var(--ink)]">No Matching Reels</h4>
                <p className="mt-1 text-xs text-[var(--ink-medium)] max-w-sm mx-auto">
                  {channelReels.length === 0
                    ? 'No Shorts & Reels have been published from this channel yet.'
                    : 'No reels match your current search or visibility filter.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--ink-faint)] text-[var(--ink-medium)] font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-2">Reel</th>
                      <th className="py-3 px-2">Visibility</th>
                      <th className="py-3 px-2 text-right">Views</th>
                      <th className="py-3 px-2 text-right">Likes</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ink-faint)]">
                    {filteredReels.map((reel) => {
                      const vis = reel.visibility || 'public';
                      const nextVis: 'public' | 'unlisted' | 'private' =
                        vis === 'public' ? 'unlisted' : vis === 'unlisted' ? 'private' : 'public';
                      return (
                        <tr key={reel.id} className="group hover:bg-[var(--card-hover)] transition-colors">
                          <td className="py-3 px-2 min-w-[260px]">
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => onPlayReel?.(reel.id)}
                                className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black cursor-pointer group/thumb"
                              >
                                <img
                                  src={reel.poster || FALLBACK_POSTER}
                                  alt={reel.title}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src !== FALLBACK_POSTER) target.src = FALLBACK_POSTER;
                                  }}
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                  <Play className="h-3.5 w-3.5 fill-white text-white" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4
                                  onClick={() => onPlayReel?.(reel.id)}
                                  className="font-bold text-[var(--ink)] hover:text-[#FF0000] transition-colors cursor-pointer line-clamp-1"
                                >
                                  {reel.title}
                                </h4>
                                <p className="text-[11px] text-[var(--ink-medium)] line-clamp-1 mt-0.5">
                                  {reel.audioTrack || 'Original Audio'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onUpdateReel?.({ ...reel, visibility: nextVis })}
                              title="Click to cycle visibility"
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                                vis === 'public'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : vis === 'unlisted'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : 'bg-[var(--bg)] text-[var(--ink-medium)] border border-[var(--ink-faint)]'
                              }`}
                            >
                              {vis === 'public' && <Globe className="h-3 w-3" />}
                              {vis === 'unlisted' && <EyeOff className="h-3 w-3" />}
                              {vis === 'private' && <Lock className="h-3 w-3" />}
                              <span className="capitalize">{vis}</span>
                            </button>
                          </td>
                          <td className="py-3 px-2 text-right font-mono font-bold tabular-nums text-[var(--ink)]">
                            {(reel.views || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right font-mono font-bold tabular-nums text-[var(--ink)]">
                            {(reel.likes || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right whitespace-nowrap">
                            {confirmDeleteId === reel.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteReel?.(reel.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="min-h-[34px] rounded-lg bg-[#FF0000] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#CC0000] cursor-pointer"
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[34px] rounded-lg border border-[var(--ink-faint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => onPlayReel?.(reel.id)}
                                  title="Play Reel"
                                  aria-label={`Play ${reel.title}`}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[#3EA6FF] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                                >
                                  <Play className="h-4 w-4" />
                                </button>
                                {onDeleteReel && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(reel.id)}
                                    title="Delete Reel"
                                    aria-label={`Delete ${reel.title}`}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[#FF0000] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredContent.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="h-14 w-14 rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink-medium)] flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Film className="h-7 w-7 opacity-75" />
              </div>
              <h4 className="text-sm font-bold text-[var(--ink)]">No Matching Videos</h4>
              <p className="mt-1 text-xs text-[var(--ink-medium)] max-w-sm mx-auto">
                No videos match your filter or search query. Try another keyword or reset visibility filter.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVisibilityFilter('all');
                  }}
                  className="px-4 py-1.5 rounded-full border border-[var(--ink-faint)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                >
                  Reset Filter
                </button>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="px-4 py-1.5 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Upload New Video
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--ink-faint)] text-[var(--ink-medium)] font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-2">Video</th>
                    <th className="py-3 px-2">Visibility</th>
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2 text-right">Views</th>
                    <th className="py-3 px-2 text-right">Likes</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ink-faint)]">
                  {filteredContent.map((vid) => {
                    const vis = vid.visibility || 'public';
                    const isCopied = copiedId === vid.id;
                    return (
                      <tr
                        key={vid.id}
                        className="group hover:bg-[var(--card-hover)] transition-colors"
                      >
                        {/* Video Info Column */}
                        <td className="py-3 px-2 min-w-[280px]">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => onPlayVideo(vid)}
                              className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-black cursor-pointer group/thumb"
                            >
                              <img
                                src={vid.poster || FALLBACK_POSTER}
                                alt={vid.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src !== FALLBACK_POSTER) target.src = FALLBACK_POSTER;
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
                                className="font-bold text-[var(--ink)] hover:text-[#FF0000] transition-colors cursor-pointer line-clamp-1"
                              >
                                {vid.title}
                              </h4>
                              <p className="text-[11px] text-[var(--ink-medium)] line-clamp-1 mt-0.5">
                                {vid.description}
                              </p>
                              <span className="text-[10px] text-[var(--ink-medium)] font-medium">
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
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : vis === 'unlisted'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-[var(--bg)] text-[var(--ink-medium)] border border-[var(--ink-faint)]'
                            }`}
                          >
                            {vis === 'public' && <Globe className="h-3 w-3" />}
                            {vis === 'unlisted' && <EyeOff className="h-3 w-3" />}
                            {vis === 'private' && <Lock className="h-3 w-3" />}
                            <span className="capitalize">{vis}</span>
                          </span>
                        </td>

                        {/* Published Date */}
                        <td className="py-3 px-2 whitespace-nowrap text-[var(--ink-medium)]">
                          {vid.publishedAt}
                        </td>

                        {/* Views */}
                        <td className="py-3 px-2 text-right font-mono font-bold tabular-nums text-[var(--ink)]">
                          {vid.views.toLocaleString()}
                        </td>

                        {/* Likes */}
                        <td className="py-3 px-2 text-right font-mono font-bold tabular-nums text-[var(--ink)]">
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
                                className="min-h-[34px] rounded-lg bg-[#FF0000] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#CC0000] cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[34px] rounded-lg border border-[var(--ink-faint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] cursor-pointer"
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
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[#3EA6FF] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                              >
                                <Play className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingVideo(vid)}
                                title="Edit Details"
                                aria-label={`Edit ${vid.title}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-amber-500 hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyLink(vid.id)}
                                title="Copy Link"
                                aria-label={`Copy link for ${vid.title}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-emerald-500 hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                              >
                                {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(vid.id)}
                                title="Delete Video"
                                aria-label={`Delete ${vid.title}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[#FF0000] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
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

      {/* TAB 3: CHANNEL ANALYTICS (Computed from real channel uploads) */}
      {activeTab === 'analytics' && (() => {
        const rankedUploads = [
          ...channelVideos.map((v) => ({ id: v.id, title: v.title, views: v.views || 0, likes: v.likes || 0, kind: 'Video' })),
          ...channelReels.map((r) => ({ id: r.id, title: r.title, views: r.views || 0, likes: r.likes || 0, kind: 'Reel' })),
        ]
          .sort((a, b) => b.views - a.views)
          .slice(0, 6);
        const maxViews = Math.max(1, ...rankedUploads.map((item) => item.views));

        const categoryCounts: Record<string, number> = {};
        channelVideos.forEach((v) => {
          const cat = v.category || 'Uncategorized';
          categoryCounts[cat] = (categoryCounts[cat] || 0) + (v.views || 0);
        });
        const topCategories = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-xs">
              <h3 className="text-base font-bold text-[var(--ink)] mb-1">
                Top Performing Uploads
              </h3>
              <p className="text-xs text-[var(--ink-medium)] mb-6">
                Channel total: <strong className="text-[var(--ink)] tabular-nums">{totalViews.toLocaleString()} views</strong> across {channelVideos.length} videos & {channelReels.length} reels.
              </p>

              {rankedUploads.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--ink-medium)]">
                  Upload videos or reels to view performance analytics.
                </div>
              ) : (
                <div className="flex items-end justify-between gap-3 h-48 pt-6 px-2 sm:px-4 border-b border-[var(--ink-faint)]">
                  {rankedUploads.map((item) => {
                    const heightPct = Math.max(12, Math.round((item.views / maxViews) * 100));
                    return (
                      <div key={item.id} className="flex-1 min-w-0 flex flex-col items-center gap-2 group">
                        <span className="text-[10px] font-mono font-bold tabular-nums text-[var(--ink)]">
                          {formatViews(item.views).replace(' views', '')}
                        </span>
                        <div
                          className="w-full max-w-[48px] rounded-t-xl bg-[#FF0000] group-hover:bg-[#CC0000] transition-all shadow-xs"
                          style={{ height: `${heightPct}%` }}
                          title={`${item.title}: ${item.views.toLocaleString()} views`}
                        />
                        <span className="text-[11px] font-semibold text-[var(--ink-medium)] truncate max-w-full text-center" title={item.title}>
                          {item.title.slice(0, 12)}{item.title.length > 12 ? '…' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Computed Category & Engagement Breakdown */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)] p-4">
                  <span className="text-[var(--ink-medium)] font-semibold block text-[11px]">Top Category by Views</span>
                  <strong className="text-lg font-bold text-[var(--ink)] truncate block">
                    {topCategories[0]?.[0] || 'General'}
                  </strong>
                  <p className="text-[11px] text-[var(--ink-medium)] mt-0.5 tabular-nums">
                    {(topCategories[0]?.[1] || 0).toLocaleString()} views in category
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)] p-4">
                  <span className="text-[var(--ink-medium)] font-semibold block text-[11px]">Average Engagement</span>
                  <strong className="text-lg font-bold text-[var(--ink)] tabular-nums">{likeRatePct}%</strong>
                  <p className="text-[11px] text-[var(--ink-medium)] mt-0.5 tabular-nums">
                    {totalLikes.toLocaleString()} total likes across uploads
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)] p-4">
                  <span className="text-[var(--ink-medium)] font-semibold block text-[11px]">Format Split</span>
                  <strong className="text-lg font-bold text-[var(--ink)] tabular-nums">
                    {channelVideos.length} Videos / {channelReels.length} Reels
                  </strong>
                  <p className="text-[11px] text-[var(--ink-medium)] mt-0.5">
                    {channelVideos.filter((v) => (v.visibility || 'public') === 'public').length} public videos active
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: REAL-TIME HLS STREAMING & CLOUD TRANSCODING TELEMETRY */}
      {activeTab === 'hls-metrics' && (
        <HlsStreamingMetricsPanel videos={videos} />
      )}

      {/* TAB 4: COMMENTS MODERATION */}
      {activeTab === 'comments' && (
        <div className="space-y-4 rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-xs">
          <div className="pb-3 border-b border-[var(--ink-faint)]">
            <h2 className="text-lg font-bold text-[var(--ink)]">
              Channel Comments ({channelComments.length})
            </h2>
            <p className="text-xs text-[var(--ink-medium)]">
              Manage and reply to viewers across all your videos
            </p>
          </div>

          {channelComments.length === 0 ? (
            <div className="py-16 text-center text-[var(--ink-medium)]">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No comments on your videos yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {channelComments.map(({ comment, videoTitle }) => (
                <div
                  key={comment.id}
                  className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-[var(--ink-faint)] bg-[var(--bg)]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <img
                      src={comment.authorAvatar || FALLBACK_AVATAR}
                      alt={comment.authorName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== FALLBACK_AVATAR) target.src = FALLBACK_AVATAR;
                      }}
                      className="h-9 w-9 rounded-full object-cover shrink-0 ring-1 ring-[var(--ink-faint)]"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[var(--ink)]">
                          {comment.authorName}
                        </span>
                        <span className="text-[11px] text-[var(--ink-medium)]">{comment.authorHandle}</span>
                        <span aria-hidden="true" className="text-[var(--ink-medium)] text-xs">·</span>
                        <span className="text-[11px] text-[var(--ink-medium)]">{comment.timestamp}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ink)] leading-relaxed">
                        {comment.content}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--ink-medium)] font-semibold">
                        <span>On video: <strong className="text-[var(--ink)]">{videoTitle}</strong></span>
                        <span aria-hidden="true">·</span>
                        <span>{comment.likes} likes</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteComment(comment.videoId, comment.id)}
                    title="Delete Comment"
                    aria-label="Delete Comment"
                    className="p-2 rounded-lg text-[var(--ink-medium)] hover:text-[#FF0000] hover:bg-[var(--card-hover)] shrink-0 transition-colors cursor-pointer"
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
        <div className="max-w-2xl rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-xs">
          <div className="pb-4 border-b border-[var(--ink-faint)]">
            <h2 className="text-lg font-bold text-[var(--ink)]">
              Channel Branding & Profile
            </h2>
            <p className="text-xs text-[var(--ink-medium)]">
              Customize how your channel appears to followers and viewers
            </p>
          </div>

          <form onSubmit={handleSaveCustomization} className="mt-5 space-y-4">
            {customizationSaved && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500 border border-emerald-500/20 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Channel branding updated successfully!</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Channel Name
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Channel Handle
              </label>
              <input
                type="text"
                value={channelHandle}
                onChange={(e) => setChannelHandle(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Channel Bio / Description
              </label>
              <textarea
                rows={3}
                value={channelBio}
                onChange={(e) => setChannelBio(e.target.value)}
                className="w-full rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none resize-none"
              />
            </div>

            {customUploadError && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {customUploadError}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-[var(--ink)]">
                  Profile Photo / Avatar
                </label>
                <button
                  type="button"
                  onClick={() => avatarUploadRef.current?.click()}
                  disabled={customUploading !== null}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[#FF0000] hover:text-[#FF0000] transition-colors cursor-pointer"
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
                  src={channelAvatar || channel.avatar || FALLBACK_AVATAR}
                  alt="Avatar preview"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== FALLBACK_AVATAR) target.src = FALLBACK_AVATAR;
                  }}
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-[var(--ink-faint)] shrink-0"
                />
                <input
                  type="url"
                  value={channelAvatar.startsWith('data:') ? '' : channelAvatar}
                  placeholder="Or paste avatar image URL..."
                  onChange={(e) => setChannelAvatar(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-[var(--ink)]">
                  Panoramic Banner
                </label>
                <button
                  type="button"
                  onClick={() => bannerUploadRef.current?.click()}
                  disabled={customUploading !== null}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[#FF0000] hover:text-[#FF0000] transition-colors cursor-pointer"
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
                <div className="mb-2 h-24 w-full overflow-hidden rounded-xl border border-[var(--ink-faint)] bg-gradient-to-br from-[#1f1f24] via-[#141416] to-[#261111]">
                  <img
                    src={channelBanner || channel.banner}
                    alt="Channel banner preview"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== FALLBACK_POSTER) target.src = FALLBACK_POSTER;
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
                className="w-full min-h-[42px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={customUploading !== null}
                className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-[#FF0000] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#CC0000] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
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
          <div className="rounded-3xl border border-emerald-500/30 bg-[var(--surface)] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/30">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-[var(--ink)]">
                      Creator Monetization & Revenue Sharing
                    </h2>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
                      Active Partner
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-medium)] mt-0.5">
                    Platform standard: strict <strong className="text-emerald-500">30% to creator</strong> and <strong className="text-[var(--ink)]">70% to platform owner</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--ink-medium)]">Payout Schedule:</span>
                <span className="rounded-lg bg-[var(--bg)] border border-[var(--ink-faint)] px-3 py-1 text-xs font-bold text-[var(--ink)]">
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
                  <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                      <span>Total Channel Gross</span>
                      <TrendingUp className="h-4 w-4 text-[#3EA6FF]" />
                    </div>
                    <div className="mt-2 text-2xl font-black tabular-nums text-[var(--ink)]">
                      {channelRevenue.formattedTotal}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--ink-medium)]">
                      Estimated from {totalViews.toLocaleString()} views @ $2.50 RPM
                    </p>
                  </div>

                  {/* 30% Creator Payout */}
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.06] p-5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-500">
                      <span>Creator Payout (30%)</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black tabular-nums text-emerald-500">
                      {channelRevenue.formattedCreatorShare}
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-500/80 font-medium">
                      Direct earnings deposited to your account
                    </p>
                  </div>

                  {/* 70% Platform Infrastructure */}
                  <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                      <span>Platform Owner Share (70%)</span>
                      <Globe className="h-4 w-4 text-[var(--ink-medium)]" />
                    </div>
                    <div className="mt-2 text-2xl font-black tabular-nums text-[var(--ink)]">
                      {channelRevenue.formattedPlatformShare}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--ink-medium)]">
                      Global CDN delivery, video encoding, cloud storage
                    </p>
                  </div>
                </div>

                {/* Interactive Revenue Split Calculator */}
                <div className="rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--ink-faint)]">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Interactive Revenue Split Simulator
                      </h3>
                      <p className="text-xs text-[var(--ink-medium)] mt-0.5">
                        Calculate exact creator (30%) and platform (70%) distribution for any gross earnings amount.
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {[500, 1500, 3500, 10000, 25000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCalcEarningsInput(amt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            calcEarningsInput === amt
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[var(--bg)] hover:bg-[var(--card-hover)] border border-[var(--ink-faint)] text-[var(--ink)]'
                          }`}
                        >
                          ${amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div>
                      <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
                        Gross Total Earnings (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-[var(--ink-medium)] font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={calcEarningsInput}
                          onChange={(e) => setCalcEarningsInput(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] pl-8 pr-4 py-2 text-base sm:text-sm font-bold text-[var(--ink)] focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      {/* Visual Ratio Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-emerald-500">
                            Creator Share: 30% ({calcSplit.formattedCreatorShare})
                          </span>
                          <span className="text-[var(--ink-medium)]">
                            Platform Owner: 70% ({calcSplit.formattedPlatformShare})
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-[var(--bg)] border border-[var(--ink-faint)] overflow-hidden flex">
                          <div
                            style={{ width: '30%' }}
                            className="h-full bg-emerald-500 transition-all duration-300"
                          />
                          <div
                            style={{ width: '70%' }}
                            className="h-full bg-[var(--ink-medium)]/50 transition-all duration-300"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[var(--bg)] p-4 border border-[var(--ink-faint)] space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-[var(--ink-faint)]">
                        <span className="text-[var(--ink-medium)]">Gross Revenue:</span>
                        <span className="font-bold text-[var(--ink)]">{calcSplit.formattedTotal}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--ink-faint)] text-emerald-500">
                        <span className="font-semibold">Creator Payout (30%):</span>
                        <span className="font-black">{calcSplit.formattedCreatorShare}</span>
                      </div>
                      <div className="flex justify-between py-1 text-[var(--ink-medium)]">
                        <span>Platform Owner Share (70%):</span>
                        <span className="font-bold text-[var(--ink)]">{calcSplit.formattedPlatformShare}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video-Level Monetization Table */}
                <div className="rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-[var(--ink-faint)]">
                    <h3 className="text-sm font-bold text-[var(--ink)]">
                      Video Monetization Breakdown
                    </h3>
                    <p className="text-xs text-[var(--ink-medium)] mt-0.5">
                      Estimated earnings calculated per video applying the strict 30/70 platform split.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg)] text-[var(--ink-medium)] uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3.5 pl-5">Video</th>
                          <th className="p-3.5">Views</th>
                          <th className="p-3.5">Gross Revenue</th>
                          <th className="p-3.5 text-emerald-600 dark:text-emerald-400">Creator 30%</th>
                          <th className="p-3.5">Platform 70%</th>
                          <th className="p-3.5 pr-5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ink-faint)]">
                        {channelVideos.map((v) => {
                          const vSplit = estimateEarningsFromViews(v.views || 0);
                          return (
                            <tr key={v.id} className="hover:bg-[var(--card-hover)] transition-colors">
                              <td className="p-3.5 pl-5">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={v.poster || FALLBACK_POSTER}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (target.src !== FALLBACK_POSTER) target.src = FALLBACK_POSTER;
                                    }}
                                    className="h-10 w-16 rounded-lg object-cover ring-1 ring-[var(--ink-faint)] shrink-0"
                                  />
                                  <span className="font-bold text-[var(--ink)] line-clamp-1 max-w-[200px]">
                                    {v.title}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3.5 tabular-nums text-[var(--ink-medium)]">
                                {(v.views || 0).toLocaleString()}
                              </td>
                              <td className="p-3.5 font-bold tabular-nums text-[var(--ink)]">
                                {vSplit.formattedTotal}
                              </td>
                              <td className="p-3.5 font-black tabular-nums text-emerald-500">
                                {vSplit.formattedCreatorShare}
                              </td>
                              <td className="p-3.5 font-medium tabular-nums text-[var(--ink-medium)]">
                                {vSplit.formattedPlatformShare}
                              </td>
                              <td className="p-3.5 pr-5">
                                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500">
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

      {/* TAB 7: STUDIO COLOR & FRAMING LAB (40x40px controls with live preview) */}
      {activeTab === 'ai-editor' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF0000] text-white shadow-md">
                  <SlidersHorizontal className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black text-[var(--ink)]">
                      Color & Framing Lab
                    </h2>
                    <span className="rounded-md bg-[#FF0000]/10 px-2.5 py-0.5 text-xs font-bold text-[#FF0000]">
                      Studio Preview
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-medium)] mt-0.5">
                    Preview color LUTs, subtitle styling, and 9:16 vertical crop framing before exporting.
                  </p>
                </div>
              </div>

              {/* Video Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--ink-medium)] whitespace-nowrap">Select Video:</span>
                <select
                  value={selectedEditorVideoId}
                  onChange={(e) => setSelectedEditorVideoId(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-2 text-base sm:text-xs font-bold text-[var(--ink)] focus:outline-none max-w-[200px] truncate"
                >
                  {(channelVideos.length > 0 ? channelVideos : videos).map((v) => (
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
                setAiStatusMsg(`Preset updated: ${next[toolKey] ? 'Enabled' : 'Disabled'}`);
                setTimeout(() => setAiStatusMsg(null), 2000);
                return next;
              });
            };

            const handleRunRender = () => {
              setIsProcessingAI(true);
              setTimeout(() => {
                setIsProcessingAI(false);
                setAiStatusMsg('Studio look & framing preset saved for this preview.');
                setTimeout(() => setAiStatusMsg(null), 3000);
              }, 800);
            };

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Video Preview Canvas */}
                <div className="lg:col-span-8 rounded-3xl border border-[var(--ink-faint)] bg-black p-4 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                  <div
                    className={`relative overflow-hidden rounded-2xl bg-[#181818] transition-all duration-300 ${
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
                      } ${aiTools.autoZoom ? 'scale-105' : ''}`}
                    />

                    {/* Captions Overlay Preview */}
                    {aiTools.autoCaptions && (
                      <div className="absolute bottom-12 inset-x-4 flex justify-center pointer-events-none">
                        <span className="rounded-lg bg-black/80 px-3 py-1 text-xs font-bold text-yellow-300 shadow-md backdrop-blur-xs text-center">
                          {currentEditVideo?.title || 'Live caption preview'}
                        </span>
                      </div>
                    )}

                    {/* Active Processing Indicator */}
                    {isProcessingAI && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3 z-30 animate-in fade-in">
                        <RefreshCw className="h-8 w-8 animate-spin text-[#FF0000]" />
                        <span className="text-sm font-bold">Applying color LUT & framing preset...</span>
                      </div>
                    )}
                  </div>

                  {/* Status Banner */}
                  {aiStatusMsg && (
                    <div className="mt-3 px-3 py-1 rounded-full bg-[#FF0000] text-white text-xs font-semibold shadow-md animate-in fade-in">
                      {aiStatusMsg}
                    </div>
                  )}
                </div>

                {/* Right: Dedicated 40x40px Studio Toolbar */}
                <div className="lg:col-span-4 rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 shadow-xs space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-[#FF0000]" />
                      Studio Adjustments
                    </h3>
                    <p className="text-[11px] text-[var(--ink-medium)] mt-0.5">
                      Toggle color grade, subtitles, zoom & vertical framing live.
                    </p>
                  </div>

                  {/* 40x40px Toolbar Buttons Grid */}
                  <div className="space-y-2.5">
                    {[
                      {
                        key: 'autoCut' as const,
                        name: 'Trim Dead Air Markers',
                        desc: 'Mark quiet gaps in timeline',
                        icon: Scissors,
                      },
                      {
                        key: 'autoCaptions' as const,
                        name: 'Preview Subtitles',
                        desc: 'Display burned-in caption bar',
                        icon: Subtitles,
                      },
                      {
                        key: 'lutGrade' as const,
                        name: 'Cinematic Color Grade',
                        desc: 'Warm contrast & saturation LUT',
                        icon: Palette,
                      },
                      {
                        key: 'audioDucking' as const,
                        name: 'Voice Clarity Leveler',
                        desc: 'Normalize vocal headroom',
                        icon: Volume2,
                      },
                      {
                        key: 'highlights' as const,
                        name: 'Chapter Markers',
                        desc: 'Highlight key timestamps',
                        icon: Sparkles,
                      },
                      {
                        key: 'shortsFormat' as const,
                        name: '9:16 Vertical Framing',
                        desc: 'Switch preview to Shorts ratio',
                        icon: Smartphone,
                      },
                      {
                        key: 'autoZoom' as const,
                        name: '1.05x Punch-In Crop',
                        desc: 'Subtle tight framing zoom',
                        icon: Maximize2,
                      },
                      {
                        key: 'sfxEnhance' as const,
                        name: 'Loudness Target (-14 LUFS)',
                        desc: 'Streaming audio normalization',
                        icon: SlidersHorizontal,
                      },
                    ].map((tool) => {
                      const Icon = tool.icon;
                      const isActive = aiTools[tool.key];

                      return (
                        <div
                          key={tool.key}
                          className="flex items-center justify-between p-2.5 rounded-2xl border border-[var(--ink-faint)] hover:bg-[var(--card-hover)] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <button
                              type="button"
                              onClick={() => toggleTool(tool.key)}
                              title={`${tool.name} (${isActive ? 'Active' : 'Inactive'})`}
                              style={{ width: '40px', height: '40px' }}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-[#FF0000] text-white shadow-sm'
                                  : 'bg-[var(--bg)] hover:bg-[var(--card-hover)] border border-[var(--ink-faint)] text-[var(--ink)]'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </button>

                            <div className="min-w-0">
                              <p className="font-bold text-xs text-[var(--ink)] truncate">
                                {tool.name}
                              </p>
                              <p className="text-[10px] text-[var(--ink-medium)] truncate">{tool.desc}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleTool(tool.key)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#FF0000]/15 text-[#FF0000]'
                                : 'bg-[var(--bg)] text-[var(--ink-medium)] border border-[var(--ink-faint)]'
                            }`}
                          >
                            {isActive ? 'ACTIVE' : 'OFF'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Save & Export Action */}
                  <div className="pt-2 border-t border-[var(--ink-faint)] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRunRender}
                      disabled={isProcessingAI}
                      className="flex-1 min-h-[42px] flex items-center justify-center gap-2 rounded-xl bg-[#FF0000] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#CC0000] disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      <span>Apply Preview Preset</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAiStatusMsg('Preset saved to current studio session.');
                        setTimeout(() => setAiStatusMsg(null), 2500);
                      }}
                      title="Save Preset"
                      aria-label="Save Preset"
                      className="min-h-[42px] min-w-[42px] flex items-center justify-center p-2.5 rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] hover:bg-[var(--card-hover)] text-[var(--ink)] cursor-pointer"
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
