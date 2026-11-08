import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Film,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Check,
  Globe,
  Lock,
  EyeOff,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Bell,
  MessageSquare,
  ThumbsUp,
  ShieldCheck,
  Calendar,
  Clock,
  Radio,
  FileVideo,
  Layers,
  HelpCircle
} from 'lucide-react';
import { VideoItem, Channel } from '../types/video';
import { CATEGORIES } from '../data/mockData';
import { formatFileSize, formatTime } from '../utils/formatTime';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublishVideo: (newVideo: VideoItem) => void;
  channels: Channel[];
}

export type UploadPhase = 'idle' | 'uploading' | 'transcoding' | 'checking' | 'completed';

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  isOpen,
  onClose,
  onPublishVideo,
  channels,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'details' | 'privacy' | 'checks'>('upload');
  const [sourceType, setSourceType] = useState<'file' | 'url'>('url');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(120);
  const [videoResolution, setVideoResolution] = useState<string>('1920x1080 (1080p HD)');

  // Upload Progress & State
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [uploadSpeed, setUploadSpeed] = useState<string>('12.4 MB/s');
  const [uploadedBytes, setUploadedBytes] = useState<string>('0 MB');
  const [totalBytes, setTotalBytes] = useState<string>('84.2 MB');
  const [etaSeconds, setEtaSeconds] = useState<number>(7);
  const progressIntervalRef = useRef<number | null>(null);

  // Video Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Animation');
  const [channelId, setChannelId] = useState(channels[0]?.id || 'channel-blender');

  // Thumbnails
  const [autoThumbnails, setAutoThumbnails] = useState<string[]>([
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
  ]);
  const [selectedPoster, setSelectedPoster] = useState<string>(
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80'
  );
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState('');

  // Tags
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['4K', 'Original', 'VioStreaming']);

  // Privacy & Control Settings
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [hideLikes, setHideLikes] = useState<boolean>(false); // When true: hide like counts from viewers
  const [commentsControl, setCommentsControl] = useState<
    'allow_all' | 'hold_inappropriate' | 'hold_all' | 'disabled'
  >('hold_inappropriate');
  const [notifySubscribers, setNotifySubscribers] = useState<boolean>(true); // Push notification & subscriptions feed
  const [notifyOnReplies, setNotifyOnReplies] = useState<boolean>(true);
  const [allowRemix, setAllowRemix] = useState<boolean>(true); // Allow audio & reel reuse
  const [ageRestricted, setAgeRestricted] = useState<boolean>(false); // 18+ restriction
  const [scheduleDate, setScheduleDate] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab('upload');
      setUploadProgress(0);
      setUploadPhase('idle');
      setIsPaused(false);
      setError(null);
    }
  }, [isOpen]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Start simulated realistic upload progress pipeline
  const startUploadPipeline = (fileName: string, estimatedSizeMB: number = 84.2) => {
    setUploadPhase('uploading');
    setUploadProgress(5);
    setTotalBytes(`${estimatedSizeMB.toFixed(1)} MB`);
    setUploadedBytes(`4.2 MB`);
    setEtaSeconds(6);

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    let currentPct = 5;
    progressIntervalRef.current = window.setInterval(() => {
      if (isPaused) return;

      currentPct += Math.floor(Math.random() * 8) + 5;
      if (currentPct < 60) {
        setUploadPhase('uploading');
        setUploadProgress(currentPct);
        const currentMB = ((currentPct / 100) * estimatedSizeMB).toFixed(1);
        setUploadedBytes(`${currentMB} MB`);
        setUploadSpeed(`${(11 + Math.random() * 4).toFixed(1)} MB/s`);
        setEtaSeconds(Math.max(1, Math.round(((100 - currentPct) / 100) * 8)));
      } else if (currentPct < 85) {
        setUploadPhase('transcoding');
        setUploadProgress(currentPct);
        setUploadedBytes(`${estimatedSizeMB.toFixed(1)} MB`);
        setUploadSpeed('Adaptive Bitrate Encoding');
        setEtaSeconds(3);
      } else if (currentPct < 100) {
        setUploadPhase('checking');
        setUploadProgress(currentPct);
        setUploadSpeed('Audio & Copyright Scan');
        setEtaSeconds(1);
      } else {
        setUploadProgress(100);
        setUploadPhase('completed');
        setUploadedBytes(`${estimatedSizeMB.toFixed(1)} MB`);
        setUploadSpeed('Ready');
        setEtaSeconds(0);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
    }, 400);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.type.startsWith('video/')) {
        setError('Please choose a valid video file (.mp4, .webm, .mov, etc.).');
        return;
      }
      setFile(selected);
      const blobUrl = URL.createObjectURL(selected);
      setResolvedVideoUrl(blobUrl);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
      setError(null);
      const sizeMB = selected.size / (1024 * 1024);
      startUploadPipeline(selected.name, sizeMB);
      extractThumbnails(blobUrl);
    }
  };

  const handleUrlProceed = (customUrl?: string) => {
    const targetUrl = (customUrl || url).trim();
    if (!targetUrl) {
      setError('Please enter a valid video stream or direct MP4 URL.');
      return;
    }
    try {
      new URL(targetUrl);
    } catch {
      setError('Please enter a well-formed URL.');
      return;
    }
    setError(null);
    setResolvedVideoUrl(targetUrl);
    if (!title) {
      const inferred = targetUrl.split('/').pop()?.split('?')[0] || 'Uploaded Video';
      setTitle(inferred.replace(/\.[^/.]+$/, ''));
    }
    startUploadPipeline(targetUrl, 68.5);
    extractThumbnails(targetUrl);
  };

  const extractThumbnails = (videoSrc: string) => {
    const vid = document.createElement('video');
    vid.src = videoSrc;
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.playsInline = true;

    vid.onloadedmetadata = () => {
      setVideoDuration(vid.duration || 120);
      setVideoResolution(`${vid.videoWidth || 1920}x${vid.videoHeight || 1080} (4K HDR Transcoded)`);
    };
  };

  const togglePauseUpload = () => {
    setIsPaused((prev) => !prev);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for your video.');
      setActiveTab('details');
      return;
    }

    const finalPoster =
      customThumbnailUrl.trim() ||
      selectedPoster ||
      autoThumbnails[0] ||
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80';

    const newVideo: VideoItem = {
      id: `studio-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Uploaded with Vio streaming Studio.',
      url: resolvedVideoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      poster: finalPoster,
      channelId: channelId,
      views: 0,
      likes: 0,
      dislikes: 0,
      publishedAt: 'Just now',
      duration: Math.round(videoDuration) || 120,
      category: category,
      tags: tags.length > 0 ? tags : [category],
      isLocal: sourceType === 'file',
      fileSize: file ? formatFileSize(file.size) : totalBytes,
      visibility,
      hideLikes,
      commentsControl,
      notifySubscribers,
      allowRemix,
      ageRestricted,
      createdAt: Date.now(),
    };

    onPublishVideo(newVideo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-md shadow-red-500/20">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Creator Studio: Upload Video
                <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 text-[10px] px-2 py-0.5 font-bold">
                  Vio streaming Cloud
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload progress, transcoding, metadata & granular privacy controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close upload modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
          {[
            { id: 'upload', label: '1. Upload & Progress', icon: Upload },
            { id: 'details', label: '2. Details & Thumbnail', icon: Layers },
            { id: 'privacy', label: '3. Privacy & Interaction Settings', icon: ShieldCheck },
            { id: 'checks', label: '4. Quality Checks & Review', icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-red-600 text-red-600 dark:text-red-500'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-rose-500/10 p-3.5 text-xs text-rose-500 border border-rose-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: UPLOAD & PROGRESS BAR */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* Progress Card (Shown whenever an upload or processing starts) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/60 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                      <FileVideo className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {file ? file.name : title || 'Video Stream Upload'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{uploadedBytes} of {totalBytes}</span>
                        <span>•</span>
                        <span>{uploadSpeed}</span>
                        <span>•</span>
                        <span>{etaSeconds > 0 ? `ETA ${etaSeconds}s` : 'Completed'}</span>
                      </div>
                    </div>
                  </div>

                  {uploadPhase !== 'completed' && uploadPhase !== 'idle' && (
                    <button
                      type="button"
                      onClick={togglePauseUpload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                  )}
                </div>

                {/* Animated Gradient Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      {uploadPhase === 'idle' && 'Ready to select video file'}
                      {uploadPhase === 'uploading' && '🚀 Uploading chunks to cloud storage...'}
                      {uploadPhase === 'transcoding' && '⚙️ Generating 4K/1080p adaptive transcoding...'}
                      {uploadPhase === 'checking' && '🛡️ Checking audio tracks & copyright safety...'}
                      {uploadPhase === 'completed' && '✅ Upload & processing complete · Ready to stream'}
                    </span>
                    <span className="text-red-600 dark:text-red-400 font-mono">{uploadProgress}%</span>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-300 shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>

                {/* Multi-Stage Checkpoint Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: 'Upload Chunks', done: uploadProgress >= 50, active: uploadPhase === 'uploading' },
                    { label: '4K Transcoding', done: uploadProgress >= 80, active: uploadPhase === 'transcoding' },
                    { label: 'Audio Normalization', done: uploadProgress >= 95, active: uploadPhase === 'checking' },
                    { label: 'Stream Ready', done: uploadProgress === 100, active: uploadPhase === 'completed' },
                  ].map((stepItem, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-xl text-[11px] font-semibold border transition-all ${
                        stepItem.done
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : stepItem.active
                          ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse'
                          : 'border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      {stepItem.done ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current shrink-0" />
                      )}
                      <span className="truncate">{stepItem.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Switcher */}
              <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setSourceType('url')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    sourceType === 'url'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Direct Stream (Cloud CDN / MP4)
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('file')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    sourceType === 'file'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Upload Local Video File
                </button>
              </div>

              {sourceType === 'file' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center cursor-pointer hover:border-red-500 hover:bg-red-500/5 dark:border-slate-700 dark:hover:border-red-500 transition-all"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-3">
                      <Upload className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Drag and drop video files to upload
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Supports MP4, WebM, MOV, ProRes up to 4K 60fps
                    </p>
                    <button
                      type="button"
                      className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      Select Local File
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Direct Video URL or CDN Stream (MP4, WebM, HLS)
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="url"
                        placeholder="https://commondatastorage.googleapis.com/.../video.mp4"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Instant Sample 4K Test Streams
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        {
                          name: 'Big Buck Bunny (Animation)',
                          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        },
                        {
                          name: 'Tears of Steel (Sci-Fi VFX)',
                          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                        },
                        {
                          name: 'Chromecast Nature 4K',
                          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                        },
                      ].map((demo) => (
                        <button
                          key={demo.name}
                          type="button"
                          onClick={() => {
                            setUrl(demo.url);
                            handleUrlProceed(demo.url);
                          }}
                          className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
                        >
                          {demo.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (sourceType === 'url' && url && uploadProgress === 0) {
                      handleUrlProceed();
                    }
                    setActiveTab('details');
                  }}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-500 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Next: Video Details</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILS & THUMBNAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Title (required) · <span className="font-mono text-slate-400">{title.length}/100</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your video a compelling, searchable title"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell viewers about your video (timestamps, credits, links, hashtags)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
                />
              </div>

              {/* Thumbnails Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Thumbnail (Choose an auto-generated frame or provide custom URL)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {autoThumbnails.map((thumb, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedPoster(thumb);
                        setCustomThumbnailUrl('');
                      }}
                      className={`group relative aspect-video cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                        selectedPoster === thumb && !customThumbnailUrl
                          ? 'border-red-600 ring-2 ring-red-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <img src={thumb} alt={`Frame ${idx + 1}`} className="h-full w-full object-cover" />
                      {selectedPoster === thumb && !customThumbnailUrl && (
                        <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1.5 rounded bg-black/70 px-1 text-[9px] font-mono text-white">
                        Frame {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5">
                  <input
                    type="url"
                    placeholder="Or paste custom thumbnail image URL (e.g. Unsplash / CDN)..."
                    value={customThumbnailUrl}
                    onChange={(e) => setCustomThumbnailUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Category & Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {CATEGORIES.filter((c) => c !== 'All' && c !== 'Recently Uploaded').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Creator Channel
                  </label>
                  <select
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name} ({ch.handle})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (Press Enter or comma to add)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4k, blender, cinematography, tutorial"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white mb-2"
                />
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!title.trim()) {
                      setError('Title is required to proceed.');
                      return;
                    }
                    setError(null);
                    setActiveTab('privacy');
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-500 cursor-pointer"
                >
                  <span>Next: Privacy & Controls</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY SETTINGS, HIDE LIKES, COMMENT CONTROLS & NOTIFICATION TOGGLES */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              {/* SECTION A: VISIBILITY */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    <span>Visibility Level</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Who can watch this video</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'public',
                      title: 'Public',
                      desc: 'Everyone can see, search and stream your video.',
                      icon: Globe,
                    },
                    {
                      id: 'unlisted',
                      title: 'Unlisted',
                      desc: 'Anyone with the direct link can stream it.',
                      icon: EyeOff,
                    },
                    {
                      id: 'private',
                      title: 'Private',
                      desc: 'Only you and authorized members can view.',
                      icon: Lock,
                    },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isSel = visibility === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setVisibility(opt.id as any)}
                        className={`flex flex-col p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isSel
                            ? 'border-red-600 bg-red-500/5 ring-1 ring-red-600 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${isSel ? 'text-red-500' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold">{opt.title}</span>
                          </div>
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSel ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSel && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">{opt.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: HIDE LIKES TOGGLE */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <ThumbsUp className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Hide Likes Count from Viewers
                      </div>
                      <div className="text-[11px] text-slate-400">
                        When enabled, like counts remain private to creator studio; viewers see only the Like icon without numbers.
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hideLikes}
                    onClick={() => setHideLikes(!hideLikes)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      hideLikes ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        hideLikes ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* SECTION C: COMMENT CONTROLS */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Comment Controls & Moderation
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Choose how comments and user discussions are handled on this video
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {[
                    {
                      id: 'allow_all',
                      label: 'Allow all comments',
                      desc: 'Publish all viewer comments immediately.',
                    },
                    {
                      id: 'hold_inappropriate',
                      label: 'Hold inappropriate for review',
                      desc: 'Auto-filter toxic remarks, spam & malicious links (Recommended).',
                    },
                    {
                      id: 'hold_all',
                      label: 'Hold all comments for review',
                      desc: 'Every comment requires manual creator approval.',
                    },
                    {
                      id: 'disabled',
                      label: 'Disable comments entirely',
                      desc: 'Comments are turned off and existing comments hidden.',
                    },
                  ].map((option) => {
                    const isSelected = commentsControl === option.id;
                    return (
                      <label
                        key={option.id}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-sky-500 bg-sky-500/10 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="commentsControl"
                          value={option.id}
                          checked={isSelected}
                          onChange={() => setCommentsControl(option.id as any)}
                          className="mt-0.5 accent-sky-500"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight">{option.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{option.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* SECTION D: NOTIFICATION TOGGLES & INTERACTION PREFERENCES */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Notification Toggles & Syndication
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Configure automated follower delivery and community alerts
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Notify Followers Toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Notify Followers
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Publish to Following feed and dispatch push notifications to followers
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifySubscribers}
                      onClick={() => setNotifySubscribers(!notifySubscribers)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifySubscribers ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifySubscribers ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Comment & Reply Push Alerts */}
                  <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Creator Comment Alerts
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Send notifications to creator dashboard when viewers post top replies
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyOnReplies}
                      onClick={() => setNotifyOnReplies(!notifyOnReplies)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notifyOnReplies ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifyOnReplies ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Allow Remix & Reels Reuse */}
                  <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Allow Reels & Audio Remixing
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Allow other creators to sample this audio track for Vio streaming Shorts & Reels
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowRemix}
                      onClick={() => setAllowRemix(!allowRemix)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        allowRemix ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allowRemix ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Age Restriction Toggle */}
                  <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Age Restriction (18+)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Limit visibility to registered adult viewers (mature animation/cinematic content)
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ageRestricted}
                      onClick={() => setAgeRestricted(!ageRestricted)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        ageRestricted ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          ageRestricted ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('checks')}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-500 cursor-pointer"
                >
                  <span>Next: Checks & Review</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CHECKS & FINAL PUBLISH REVIEW */}
          {activeTab === 'checks' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Automated Copyright & Safety Check: Passed</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  No copyrighted audio or visual strikes were found on this video. Resolution verified at {videoResolution}.
                </p>
              </div>

              {/* Video Preview Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 flex flex-col sm:flex-row gap-4">
                <div className="relative w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-black shrink-0">
                  <img
                    src={customThumbnailUrl || selectedPoster || autoThumbnails[0]}
                    alt="Thumbnail preview"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white">
                    {formatTime(videoDuration)}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold capitalize">
                      {visibility}
                    </span>
                    <span className="text-[10px] text-slate-400">•</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Category: {category}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {title || 'Untitled Video'}
                  </h4>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {description || 'No description provided.'}
                  </p>

                  <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span>Like counts: <strong className="text-slate-700 dark:text-slate-200">{hideLikes ? 'Hidden' : 'Visible'}</strong></span>
                    <span>Comments: <strong className="text-slate-700 dark:text-slate-200">{commentsControl.replace('_', ' ')}</strong></span>
                    <span>Followers alert: <strong className="text-slate-700 dark:text-slate-200">{notifySubscribers ? 'Yes' : 'No'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('privacy')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Privacy</span>
                </button>

                <button
                  type="button"
                  onClick={handlePublish}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-7 py-3 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Publish Video to Vio streaming</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
