import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
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
  Bell,
  MessageSquare,
  ThumbsUp,
  ShieldCheck,
  FileVideo,
  Zap,
  Loader2,
  Copy,
  ImagePlus,
  RefreshCw,
  LogIn
} from 'lucide-react';
import { VideoItem, ReelItem, Channel } from '../types/video';
import { CATEGORIES } from '../data/mockData';
import { formatFileSize, formatTime } from '../utils/formatTime';
import { buildStreamLadder, triggerCloudTranscoding } from '../services/streamingService';
import { addVideoDoc, addReelDoc, uploadFileToStorage, uploadImageAsset } from '../services/firebaseDatabaseService';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublishVideo: (newVideo: VideoItem) => void;
  onPublishReel?: (newReel: ReelItem) => void;
  defaultTarget?: 'video' | 'reel';
  channels: Channel[];
  onOpenAuth?: () => void;
}

export type UploadPhase = 'idle' | 'staged' | 'uploading' | 'transcoding' | 'checking' | 'completed';
type WizardStep = 'details' | 'elements' | 'checks' | 'visibility';

const STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: 'details', label: 'Details', number: 1 },
  { id: 'elements', label: 'Video elements', number: 2 },
  { id: 'checks', label: 'Checks', number: 3 },
  { id: 'visibility', label: 'Visibility', number: 4 },
];

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  isOpen,
  onClose,
  onPublishVideo,
  onPublishReel,
  defaultTarget = 'video',
  channels,
  onOpenAuth,
}) => {
  const { currentUser, isFirebaseAuthenticated, signInWithGoogle } = useAuth();
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [publishTarget, setPublishTarget] = useState<'video' | 'reel'>(defaultTarget);
  const [activeStep, setActiveStep] = useState<WizardStep>('details');
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [sourceType, setSourceType] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(120);
  const [videoResolution, setVideoResolution] = useState<string>('1920x1080');
  const [copiedPreviewLink, setCopiedPreviewLink] = useState<boolean>(false);

  // Upload Progress & State
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadSpeed, setUploadSpeed] = useState<string>('Waiting for video file');
  const [uploadedBytes, setUploadedBytes] = useState<string>('0 B');
  const [totalBytes, setTotalBytes] = useState<string>('—');
  const [etaSeconds, setEtaSeconds] = useState<number>(0);
  const [thumbStorageMode, setThumbStorageMode] = useState<'cloud' | 'local' | null>(null);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState<boolean>(false);
  const [thumbGenerationStatus, setThumbGenerationStatus] = useState<'idle' | 'generating' | 'generated' | 'fallback'>('idle');
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);

  // Video Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Animation');
  const preferredChannelId =
    channels.find((c) => currentUser?.uid && c.id === `channel-${currentUser.uid}`)?.id ||
    channels[0]?.id ||
    'channel-blender';
  const [channelId, setChannelId] = useState(preferredChannelId);

  // Thumbnails
  const DEFAULT_THUMBS = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
  ];
  const [autoThumbnails, setAutoThumbnails] = useState<string[]>(DEFAULT_THUMBS);
  const [selectedPoster, setSelectedPoster] = useState<string>(DEFAULT_THUMBS[0]);
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState('');

  // Tags
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['4K', 'Original', 'VioStreaming']);

  // Privacy & Control Settings
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [hideLikes, setHideLikes] = useState<boolean>(false);
  const [commentsControl, setCommentsControl] = useState<
    'allow_all' | 'hold_inappropriate' | 'hold_all' | 'disabled'
  >('hold_inappropriate');
  const [notifySubscribers, setNotifySubscribers] = useState<boolean>(true);
  const [allowRemix, setAllowRemix] = useState<boolean>(true);
  const [ageRestricted, setAgeRestricted] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState<boolean>(false);
  const [draftSlugId] = useState<string>(() => Math.random().toString(36).slice(2, 10));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const publishedBlobUrlsRef = useRef<Set<string>>(new Set());

  const cleanTitleFromFileName = (name: string): string => {
    const withoutExt = name.replace(/\.[^/.]+$/, '');
    const humanized = withoutExt
      .replace(/[_-]+/g, ' ')
      .replace(/\b(1080p|720p|480p|4k|hdr|master|final|h264|hevc|x264|v\d+)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!humanized) return withoutExt || 'New Video Stream';
    return humanized
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
    if (isOpen) {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setActiveStep('details');
      setShowUrlInput(false);
      setPublishTarget(defaultTarget);
      setSourceType('file');
      setFile(null);
      setUrl('');
      if (blobUrlRef.current && !publishedBlobUrlsRef.current.has(blobUrlRef.current)) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      blobUrlRef.current = null;
      setResolvedVideoUrl('');
      setTitle('');
      setDescription('');
      setCustomThumbnailUrl('');
      setAutoThumbnails(DEFAULT_THUMBS);
      setSelectedPoster(DEFAULT_THUMBS[0]);
      setIsGeneratingThumbs(false);
      setThumbGenerationStatus('idle');
      setPublishSuccessMessage(null);
      setIsPublishing(false);
      setUploadProgress(0);
      setUploadPhase('idle');
      setUploadSpeed('Waiting for video file');
      setUploadedBytes('0 B');
      setTotalBytes('—');
      setEtaSeconds(0);
      setThumbStorageMode(null);
      setCopiedPreviewLink(false);
      setChannelId(
        channels.find((c) => currentUser?.uid && c.id === `channel-${currentUser.uid}`)?.id ||
          channels[0]?.id ||
          'channel-blender'
      );
      setError(null);
    }
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [isOpen, defaultTarget]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPublishing) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isPublishing, onClose]);

  if (!isOpen) return null;

  const hasSource = Boolean(file || resolvedVideoUrl);
  const activePoster = customThumbnailUrl.trim() || selectedPoster || autoThumbnails[0];
  const currentStepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const previewShareLink = `${window.location.origin}${window.location.pathname}?v=vio-${draftSlugId}`;

  const stageSelectedSource = (sizeLabel: string, isLocalFile: boolean) => {
    setUploadPhase('staged');
    setUploadProgress(0);
    setTotalBytes(sizeLabel);
    setUploadedBytes(isLocalFile ? '0 B' : 'Stream URL');
    setUploadSpeed(
      isLocalFile
        ? 'Ready to upload to Firebase Storage'
        : 'Stream URL ready to publish'
    );
    setEtaSeconds(0);
  };

  const applySelectedVideoFile = (selected: File) => {
    if (!selected.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(selected.name)) {
      setError('Please choose a valid video file (.mp4, .webm, .mov, etc.).');
      return;
    }
    setPublishSuccessMessage(null);
    setSourceType('file');
    setFile(selected);
    if (blobUrlRef.current && !publishedBlobUrlsRef.current.has(blobUrlRef.current)) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const blobUrl = URL.createObjectURL(selected);
    blobUrlRef.current = blobUrl;
    setResolvedVideoUrl(blobUrl);
    setTitle(cleanTitleFromFileName(selected.name));
    setCustomThumbnailUrl('');
    setThumbStorageMode(null);
    setError(null);
    setActiveStep('details');
    stageSelectedSource(formatFileSize(selected.size), true);
    extractThumbnails(blobUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (selected) {
      applySelectedVideoFile(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      applySelectedVideoFile(e.dataTransfer.files[0]);
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
    setPublishSuccessMessage(null);
    setError(null);
    setSourceType('url');
    setFile(null);
    setResolvedVideoUrl(targetUrl);
    const inferred = targetUrl.split('/').pop()?.split('?')[0] || 'Uploaded Video Stream';
    setTitle(cleanTitleFromFileName(inferred));
    setActiveStep('details');
    stageSelectedSource('External CDN / Stream', false);
    extractThumbnails(targetUrl);
  };

  const resetSourceSelection = () => {
    if (isPublishing) return;
    if (blobUrlRef.current && !publishedBlobUrlsRef.current.has(blobUrlRef.current)) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    blobUrlRef.current = null;
    setFile(null);
    setResolvedVideoUrl('');
    setUrl('');
    setUploadPhase('idle');
    setUploadProgress(0);
    setError(null);
    setPublishSuccessMessage(null);
    setActiveStep('details');
  };

  const extractThumbnails = (videoSrc: string) => {
    const isBlobSrc = videoSrc.startsWith('blob:');
    setIsGeneratingThumbs(true);
    setThumbGenerationStatus('generating');

    const cleanupVideo = (vid: HTMLVideoElement) => {
      vid.onloadedmetadata = null;
      vid.onloadeddata = null;
      vid.onerror = null;
      vid.removeAttribute('src');
      vid.load();
    };

    const loadVideoMeta = (withCors: boolean) => {
      const vid = document.createElement('video');
      if (withCors && !isBlobSrc) {
        vid.crossOrigin = 'anonymous';
      }
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';

      let capturedStarted = false;

      vid.onerror = () => {
        cleanupVideo(vid);
        if (withCors && !isBlobSrc) {
          loadVideoMeta(false);
        } else {
          setIsGeneratingThumbs(false);
          setThumbGenerationStatus('fallback');
        }
      };

      const captureFrames = async () => {
        if (capturedStarted) return;
        capturedStarted = true;

        const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 120;
        setVideoDuration(dur);
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          setVideoResolution(`${vid.videoWidth}x${vid.videoHeight}`);
        }

        if (!withCors && !isBlobSrc) {
          cleanupVideo(vid);
          setIsGeneratingThumbs(false);
          setThumbGenerationStatus('fallback');
          return;
        }

        try {
          const seekTargets =
            dur < 4
              ? [Math.min(0.2, dur * 0.2), Math.min(dur * 0.5, dur - 0.1), Math.max(0.1, dur * 0.8)]
              : [Math.max(0.5, dur * 0.15), dur * 0.5, dur * 0.8];
          const captured: string[] = [];

          for (const targetTime of seekTargets) {
            await new Promise<void>((resolve) => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                vid.removeEventListener('seeked', onSeeked);
                resolve();
              };
              const onSeeked = () => {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = 640;
                  canvas.height = 360;
                  const ctx = canvas.getContext('2d');
                  if (ctx && vid.readyState >= 2) {
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    if (dataUrl && dataUrl.length > 1000) {
                      captured.push(dataUrl);
                    }
                  }
                } catch {
                  // ignore CORS/codec errors
                }
                finish();
              };
              vid.addEventListener('seeked', onSeeked, { once: true });
              try {
                vid.currentTime = Math.min(Math.max(0.1, targetTime), Math.max(0.1, dur - 0.1));
              } catch {
                finish();
              }
              setTimeout(finish, 2200);
            });
          }

          if (captured.length > 0) {
            setAutoThumbnails(captured);
            setSelectedPoster(captured[0]);
            setThumbGenerationStatus('generated');
          } else {
            setThumbGenerationStatus('fallback');
          }
        } catch {
          setThumbGenerationStatus('fallback');
        } finally {
          cleanupVideo(vid);
          setIsGeneratingThumbs(false);
        }
      };

      vid.onloadeddata = () => {
        captureFrames();
      };

      vid.onloadedmetadata = () => {
        const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 120;
        setVideoDuration(dur);
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          setVideoResolution(`${vid.videoWidth}x${vid.videoHeight}`);
        }
        setTimeout(() => {
          if (!capturedStarted) captureFrames();
        }, 700);
      };

      vid.src = videoSrc;
      vid.load();
    };

    loadVideoMeta(!isBlobSrc);
  };

  const handleCustomThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    e.target.value = '';
    if (!imgFile) return;

    setError(null);
    setIsUploadingThumb(true);
    try {
      const res = await uploadImageAsset(imgFile, 'thumbnails');
      setCustomThumbnailUrl(res.url);
      setSelectedPoster(res.url);
      setThumbStorageMode(res.storage);
    } catch (err: any) {
      setError(err?.message || 'Failed to load custom thumbnail image.');
    } finally {
      setIsUploadingThumb(false);
    }
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

  const handleCopyPreviewLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(previewShareLink);
      }
      setCopiedPreviewLink(true);
      setTimeout(() => setCopiedPreviewLink(false), 1800);
    } catch {
      // ignore
    }
  };

  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  };

  const handleInlineGoogleSignIn = async () => {
    setError(null);
    setSigningInGoogle(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handlePublish = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);
    setPublishSuccessMessage(null);

    if (!currentUser?.uid) {
      setError('Please sign in to your Vio streaming account before publishing.');
      return;
    }

    const hasFirebaseSession = Boolean(auth.currentUser?.uid);

    const fallbackTitle = file
      ? cleanTitleFromFileName(file.name)
      : url.trim()
      ? cleanTitleFromFileName(url.split('/').pop()?.split('?')[0] || '')
      : 'Vio Stream Video';
    const finalTitle = title.trim() || fallbackTitle;

    let finalPoster =
      customThumbnailUrl.trim() ||
      selectedPoster ||
      autoThumbnails[0] ||
      DEFAULT_THUMBS[0];

    const finalVideoId = `studio-${Date.now()}`;
    let effectiveUrl = resolvedVideoUrl || url.trim();

    setIsPublishing(true);
    setUploadPhase('uploading');
    setUploadProgress(0);

    try {
      if (file && hasFirebaseSession) {
        setTotalBytes(formatFileSize(file.size));
        const startTime = Date.now();

        effectiveUrl = await uploadFileToStorage(
          file,
          'videos',
          (pct, bytesTransferred, total) => {
            setUploadProgress(pct);
            setUploadedBytes(formatFileSize(bytesTransferred));
            setTotalBytes(formatFileSize(total));
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0 && bytesTransferred > 0) {
              const speedMBps = bytesTransferred / (1024 * 1024) / elapsed;
              setUploadSpeed(`${speedMBps.toFixed(1)} MB/s`);
              const remainingBytes = total - bytesTransferred;
              const remainingSec = Math.round(remainingBytes / (bytesTransferred / elapsed));
              setEtaSeconds(Math.max(0, remainingSec));
            }
          },
          { visibility, title: finalTitle }
        );
      } else if (file && !hasFirebaseSession) {
        // Demo/Local session: keep playable local blob URL and animate smooth progress
        setUploadProgress(65);
        setUploadSpeed('Saving to local session...');
        await new Promise((r) => setTimeout(r, 350));
      }

      if (!effectiveUrl) {
        throw new Error('Please select a video file or provide a valid video URL.');
      }

      if (effectiveUrl.startsWith('blob:')) {
        publishedBlobUrlsRef.current.add(effectiveUrl);
      }

      setUploadPhase('transcoding');
      setUploadProgress(90);

      if (hasFirebaseSession && finalPoster.startsWith('data:image/')) {
        try {
          const thumbFile = await dataUrlToFile(finalPoster, `${finalVideoId}_thumb.jpg`);
          const uploadedThumb = await uploadImageAsset(thumbFile, 'thumbnails');
          if (uploadedThumb.url) {
            finalPoster = uploadedThumb.url;
          }
        } catch {
          // Keep generated JPEG data URL if Storage thumbnail upload falls back
        }
      }

      const ladder = buildStreamLadder(finalVideoId, effectiveUrl);

      if (publishTarget === 'reel') {
        const selectedChannel = channels.find((c) => c.id === channelId);
        const newReel: ReelItem = {
          id: `reel-${Date.now()}`,
          title: finalTitle,
          description: description.trim() || `${finalTitle} on Vio streaming Reels`,
          videoUrl: effectiveUrl,
          poster: finalPoster,
          channelId: channelId,
          views: 0,
          likes: 0,
          commentsCount: 0,
          audioTrack: `Original Sound · ${selectedChannel?.name || 'Vio Creator'}`,
          audioArtist: selectedChannel?.name || 'Vio Creator',
          tags: tags.length > 0 ? tags : [category, 'Reels'],
          createdAt: 'Just now',
        };

        setUploadPhase('checking');
        setUploadProgress(95);
        if (hasFirebaseSession) {
          await addReelDoc(newReel);
        }

        setUploadProgress(100);
        setUploadPhase('completed');
        setUploadSpeed(hasFirebaseSession ? 'Upload complete · Saved to Firebase' : 'Published to local session');
        setEtaSeconds(0);
        setPublishSuccessMessage(
          hasFirebaseSession
            ? `Reel "${finalTitle}" uploaded and published!`
            : `Reel "${finalTitle}" published to your session!`
        );

        triggerCloudTranscoding(newReel.id, effectiveUrl);
        onPublishReel?.(newReel);
      } else {
        const newVideo: VideoItem = {
          id: finalVideoId,
          title: finalTitle,
          description: description.trim(),
          url: effectiveUrl,
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
          streamQualities: ladder,
          hlsManifestUrl: `/api/stream/manifest/${finalVideoId}?format=hls`,
          backupStreams: [
            effectiveUrl,
            'https://media.w3.org/2010/05/bunny/movie.mp4',
            'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
          ],
          transcodingStatus: 'ready',
        };

        setUploadPhase('checking');
        setUploadProgress(95);
        if (hasFirebaseSession) {
          await addVideoDoc(newVideo);
        }

        setUploadProgress(100);
        setUploadPhase('completed');
        setUploadSpeed(hasFirebaseSession ? 'Upload complete · Saved to Firebase' : 'Published to local session');
        setEtaSeconds(0);
        setPublishSuccessMessage(
          hasFirebaseSession
            ? `"${finalTitle}" uploaded and published!`
            : `"${finalTitle}" published to your session!`
        );

        triggerCloudTranscoding(finalVideoId, effectiveUrl);
        onPublishVideo(newVideo);
      }

      setIsPublishing(false);
      closeTimeoutRef.current = window.setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      console.error('Video upload/publish error:', err);
      setIsPublishing(false);
      setUploadPhase('staged');
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to upload video to Firebase Storage. Please check your network and try again.'
      );
    }
  };

  const handleNextStep = () => {
    if (activeStep === 'details' && !title.trim()) {
      setError('Please enter a video title before continuing.');
      return;
    }
    setError(null);
    if (currentStepIndex < STEPS.length - 1) {
      setActiveStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (currentStepIndex > 0) {
      setActiveStep(STEPS[currentStepIndex - 1].id);
    }
  };

  return (
    <div
      onClick={() => {
        if (!isPublishing) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl rounded-t-2xl sm:rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] text-[var(--ink)] shadow-2xl max-h-[94dvh] flex flex-col overflow-hidden"
      >
        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/*"
          onChange={handleCustomThumbnailUpload}
          className="hidden"
        />

        {/* YOUTUBE STUDIO MODAL HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 border-b border-[var(--ink-faint)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-[var(--ink)] truncate">
              {hasSource ? title.trim() || 'Untitled video' : 'Upload videos'}
            </h2>
            {hasSource && (
              <span className="hidden sm:inline-flex items-center rounded-md bg-[var(--card-hover)] px-2 py-0.5 text-xs font-medium text-[var(--ink-medium)] capitalize shrink-0">
                {uploadPhase === 'completed' ? 'Published' : `${visibility} · Draft`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Target Toggle: Video vs Short/Reel */}
            <div className="hidden sm:flex items-center rounded-full bg-[var(--card-hover)] p-0.5 text-xs font-medium">
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => setPublishTarget('video')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  publishTarget === 'video'
                    ? 'bg-[var(--ink)] text-[var(--bg)] font-semibold'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
                }`}
              >
                Video
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => setPublishTarget('reel')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  publishTarget === 'reel'
                    ? 'bg-[#FF0000] text-white font-semibold'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
                }`}
              >
                Short / Reel
              </button>
            </div>

            <button
              onClick={() => {
                if (!isPublishing) onClose();
              }}
              disabled={isPublishing}
              aria-label="Close upload dialog"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] transition-colors disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* STAGE A: YOUTUBE STUDIO DROPZONE (Before file or stream URL is selected) */}
        {!hasSource ? (
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10 flex flex-col items-center justify-center">
            {!currentUser && (
              <div className="w-full max-w-xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Sign in to your Vio streaming account to upload and publish videos.</span>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 text-black font-semibold px-3.5 py-1.5 text-xs shrink-0 hover:bg-amber-300 transition-colors"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Sign in</span>
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="w-full max-w-xl mb-5 flex items-center gap-2.5 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-400 border border-rose-500/25">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mobile Video/Reel Switcher */}
            <div className="flex sm:hidden items-center rounded-full bg-[var(--card-hover)] p-1 text-xs font-medium mb-6">
              <button
                type="button"
                onClick={() => setPublishTarget('video')}
                className={`px-4 py-1.5 rounded-full transition-colors ${
                  publishTarget === 'video'
                    ? 'bg-[var(--ink)] text-[var(--bg)] font-semibold'
                    : 'text-[var(--ink-medium)]'
                }`}
              >
                Video (16:9)
              </button>
              <button
                type="button"
                onClick={() => setPublishTarget('reel')}
                className={`px-4 py-1.5 rounded-full transition-colors ${
                  publishTarget === 'reel'
                    ? 'bg-[#FF0000] text-white font-semibold'
                    : 'text-[var(--ink-medium)]'
                }`}
              >
                Short / Reel
              </button>
            </div>

            {!showUrlInput ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-xl flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed px-6 py-10 sm:py-14 cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#3EA6FF] bg-[#3EA6FF]/10 scale-[1.01]'
                    : 'border-[var(--ink-faint)] hover:border-[var(--ink-medium)] bg-[var(--surface)]/50'
                }`}
              >
                {/* Classic YouTube Studio Circular Upload Icon */}
                <div
                  className={`flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full mb-6 transition-transform ${
                    isDragging ? 'bg-[#3EA6FF]/20 scale-105' : 'bg-[var(--card-hover)]'
                  }`}
                >
                  <Upload className={`h-11 w-11 sm:h-12 sm:w-12 ${isDragging ? 'text-[#3EA6FF]' : 'text-[var(--ink-medium)]'}`} />
                </div>

                <p className="text-base font-medium text-[var(--ink)]">
                  {isDragging ? 'Drop your video file here' : 'Drag and drop video files to upload'}
                </p>
                <p className="mt-1.5 text-xs text-[var(--ink-medium)]">
                  Your videos will be private until you publish them. Supports MP4, WebM, MOV (max 500 MB).
                </p>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-6 min-h-[40px] rounded-full bg-[var(--ink)] text-[var(--bg)] px-6 py-2 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
                >
                  Select files
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUrlInput(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#3EA6FF] hover:underline"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Or upload via direct stream URL</span>
                </button>
              </div>
            ) : (
              <div className="w-full max-w-xl rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">Import from Video / CDN URL</h3>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(false)}
                    className="text-xs font-medium text-[#3EA6FF] hover:underline"
                  >
                    Back to file upload
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-medium)]" />
                    <input
                      type="url"
                      placeholder="https://media.w3.org/2010/05/bunny/movie.mp4"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] pl-10 pr-3 text-base sm:text-sm text-[var(--ink)] focus:border-[#3EA6FF] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUrlProceed()}
                    className="min-h-[44px] rounded-full bg-[var(--ink)] text-[var(--bg)] px-6 text-sm font-semibold hover:opacity-90 shrink-0"
                  >
                    Load URL
                  </button>
                </div>

                <div>
                  <span className="text-xs font-medium text-[var(--ink-medium)]">
                    Quick sample streams:
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { name: 'Big Buck Bunny', url: 'https://media.w3.org/2010/05/bunny/movie.mp4' },
                      { name: 'Tears of Steel', url: 'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4' },
                      { name: 'Flower Meadow', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
                    ].map((demo) => (
                      <button
                        key={demo.name}
                        type="button"
                        onClick={() => {
                          setUrl(demo.url);
                          handleUrlProceed(demo.url);
                        }}
                        className="rounded-lg bg-[var(--card-hover)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors"
                      >
                        {demo.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="mt-6 text-[11px] text-[var(--ink-medium)] text-center max-w-md">
              By submitting your videos to Vio streaming, you confirm that your content follows community safety & copyright guidelines.
            </p>
          </div>
        ) : (
          /* STAGE B: YOUTUBE STUDIO 4-STEP PROCESSOR */
          <>
            {/* 4-Step YouTube Studio Stepper */}
            <div className="px-4 sm:px-8 py-3.5 border-b border-[var(--ink-faint)] bg-[var(--surface)]/60 shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center justify-between max-w-2xl mx-auto min-w-[420px]">
                {STEPS.map((step, idx) => {
                  const isCurrent = activeStep === step.id;
                  const isCompleted = idx < currentStepIndex || uploadPhase === 'completed';
                  return (
                    <React.Fragment key={step.id}>
                      <button
                        type="button"
                        onClick={() => setActiveStep(step.id)}
                        className="group flex flex-col items-center gap-1.5 focus:outline-none px-2"
                      >
                        <span
                          className={`text-xs font-semibold transition-colors ${
                            isCurrent
                              ? 'text-[var(--ink)]'
                              : isCompleted
                              ? 'text-[var(--ink)]'
                              : 'text-[var(--ink-medium)]'
                          }`}
                        >
                          {step.label}
                        </span>
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                            isCompleted
                              ? 'bg-[#3EA6FF] text-black'
                              : isCurrent
                              ? 'border-2 border-[#3EA6FF] bg-[var(--bg)] text-[#3EA6FF]'
                              : 'border-2 border-[var(--ink-faint)] bg-[var(--bg)] text-[var(--ink-medium)] group-hover:border-[var(--ink-medium)]'
                          }`}
                        >
                          {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : step.number}
                        </div>
                      </button>
                      {idx < STEPS.length - 1 && (
                        <div
                          className={`h-[2px] flex-1 mx-1 rounded-full transition-colors ${
                            idx < currentStepIndex ? 'bg-[#3EA6FF]' : 'bg-[var(--ink-faint)]'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Scrollable 2-Column Studio Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Auth Notice Banner (for unauthenticated or local/demo session users) */}
              {(!currentUser || !(auth.currentUser?.uid || isFirebaseAuthenticated)) && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      {!currentUser
                        ? 'Sign in with Google to upload and publish your video.'
                        : 'Demo/local session active: video publishes to this session. Sign in with Google for Firebase Cloud storage.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={signingInGoogle}
                      onClick={handleInlineGoogleSignIn}
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-semibold px-3 py-1 text-xs transition-colors disabled:opacity-50"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>{signingInGoogle ? 'Signing in...' : 'Sign in with Google'}</span>
                    </button>
                    {!currentUser && onOpenAuth && (
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium hover:bg-amber-500/15 transition-colors"
                      >
                        Other options
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-400 border border-rose-500/25">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {!currentUser && onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="rounded-full bg-rose-600 text-white px-3 py-1 text-xs font-semibold shrink-0 hover:bg-rose-700"
                    >
                      Sign in
                    </button>
                  )}
                </div>
              )}

              {publishSuccessMessage && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-semibold truncate">{publishSuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-emerald-500 px-3.5 py-1 text-xs font-semibold text-black shrink-0"
                  >
                    Done
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: ACTIVE STEP FORM */}
                <div className="lg:col-span-7 space-y-5">
                  {/* STEP 1: DETAILS */}
                  {activeStep === 'details' && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-[var(--ink)]">Details</h3>
                        <button
                          type="button"
                          disabled={isPublishing}
                          onClick={resetSourceSelection}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3EA6FF] hover:underline disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Change video</span>
                        </button>
                      </div>

                      {/* Title Box */}
                      <div className="rounded-xl border border-[var(--ink-faint)] focus-within:border-[#3EA6FF] bg-[var(--surface)] px-3.5 py-2.5 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="yt-video-title" className="text-xs font-medium text-[var(--ink-medium)]">
                            Title (required)
                          </label>
                          <span className="text-[11px] text-[var(--ink-medium)] tabular-nums">
                            {title.length}/100
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="yt-video-title"
                            type="text"
                            maxLength={100}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Add a title that describes your video"
                            className="w-full bg-transparent text-base sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-medium)]/60 focus:outline-none"
                          />
                          {title && (
                            <button
                              type="button"
                              aria-label="Clear title"
                              onClick={() => setTitle('')}
                              className="p-1 text-[var(--ink-medium)] hover:text-[var(--ink)]"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Description Box (Optional) */}
                      <div className="rounded-xl border border-[var(--ink-faint)] focus-within:border-[#3EA6FF] bg-[var(--surface)] px-3.5 py-2.5 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="yt-video-desc" className="text-xs font-medium text-[var(--ink-medium)]">
                            Description (optional)
                          </label>
                          <span className="text-[11px] text-[var(--ink-medium)] tabular-nums">
                            {description.length}/5000
                          </span>
                        </div>
                        <textarea
                          id="yt-video-desc"
                          rows={4}
                          maxLength={5000}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Tell viewers about your video (timestamps, credits, links)"
                          className="w-full bg-transparent text-base sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-medium)]/60 focus:outline-none resize-none"
                        />
                      </div>

                      {/* Thumbnail Picker (YouTube Studio 4-tile grid) */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--ink)]">Thumbnail</h4>
                            <p className="text-xs text-[var(--ink-medium)]">
                              Select or upload a picture that shows what's in your video.
                            </p>
                          </div>
                          <span className="text-[11px] text-[var(--ink-medium)]">
                            {thumbGenerationStatus === 'generating'
                              ? 'Generating frames...'
                              : customThumbnailUrl
                              ? 'Custom cover'
                              : thumbGenerationStatus === 'generated'
                              ? 'Auto-generated'
                              : 'Default cover'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {/* Upload File Tile */}
                          <button
                            type="button"
                            onClick={() => thumbInputRef.current?.click()}
                            disabled={isUploadingThumb}
                            className={`aspect-video flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs transition-colors p-2 ${
                              customThumbnailUrl
                                ? 'border-[#3EA6FF] bg-[#3EA6FF]/10 text-[#3EA6FF]'
                                : 'border-[var(--ink-faint)] hover:border-[var(--ink-medium)] bg-[var(--surface)] text-[var(--ink-medium)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {isUploadingThumb ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <ImagePlus className="h-5 w-5" />
                            )}
                            <span className="font-medium text-[11px]">
                              {isUploadingThumb ? 'Uploading...' : 'Upload file'}
                            </span>
                          </button>

                          {/* 3 Auto-Generated Frame Tiles */}
                          {autoThumbnails.slice(0, 3).map((thumb, idx) => {
                            const isSelected = selectedPoster === thumb && !customThumbnailUrl;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedPoster(thumb);
                                  setCustomThumbnailUrl('');
                                }}
                                className={`relative aspect-video overflow-hidden rounded-xl border-2 transition-all bg-black ${
                                  isSelected
                                    ? 'border-[var(--ink)] ring-1 ring-[var(--ink)]'
                                    : 'border-[var(--ink-faint)] opacity-80 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={thumb}
                                  alt={`Auto frame ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    if (e.currentTarget.src !== DEFAULT_THUMBS[0]) {
                                      e.currentTarget.src = DEFAULT_THUMBS[0];
                                    }
                                  }}
                                  className="h-full w-full object-cover"
                                />
                                {isGeneratingThumbs && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                                  </div>
                                )}
                                {isSelected && (
                                  <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--bg)]">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {customThumbnailUrl && thumbStorageMode && (
                          <p className="text-[11px] font-medium text-emerald-400">
                            {thumbStorageMode === 'cloud'
                              ? 'Custom thumbnail uploaded to Firebase Storage'
                              : 'Custom thumbnail ready locally'}
                          </p>
                        )}
                      </div>

                      {/* Category & Channel */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label htmlFor="yt-category" className="block text-xs font-medium text-[var(--ink-medium)] mb-1.5">
                            Category
                          </label>
                          <select
                            id="yt-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--ink)] focus:border-[#3EA6FF] focus:outline-none"
                          >
                            {CATEGORIES.filter((c) => c !== 'All' && c !== 'Recently Uploaded' && c !== 'Custom Feed' && c !== 'Reels' && c !== 'Trending').map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="yt-channel" className="block text-xs font-medium text-[var(--ink-medium)] mb-1.5">
                            Channel
                          </label>
                          <select
                            id="yt-channel"
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--ink)] focus:border-[#3EA6FF] focus:outline-none"
                          >
                            {channels.map((ch) => (
                              <option key={ch.id} value={ch.id}>
                                {ch.name} ({ch.handle})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: VIDEO ELEMENTS */}
                  {activeStep === 'elements' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--ink)]">Video elements</h3>
                        <p className="text-xs text-[var(--ink-medium)]">
                          Choose format, add discovery tags, and configure viewer interaction controls.
                        </p>
                      </div>

                      {/* Publish Format Cards */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[var(--ink)]">Publish format</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPublishTarget('video')}
                            className={`text-left p-3.5 rounded-xl border transition-colors ${
                              publishTarget === 'video'
                                ? 'border-[#3EA6FF] bg-[#3EA6FF]/10'
                                : 'border-[var(--ink-faint)] bg-[var(--surface)] hover:bg-[var(--card-hover)]'
                            }`}
                          >
                            <div className="text-sm font-semibold text-[var(--ink)]">Standard Video (16:9)</div>
                            <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                              Appears in Home feed, Watch view & Channel uploads.
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPublishTarget('reel')}
                            className={`text-left p-3.5 rounded-xl border transition-colors ${
                              publishTarget === 'reel'
                                ? 'border-[#FF0000] bg-[#FF0000]/10'
                                : 'border-[var(--ink-faint)] bg-[var(--surface)] hover:bg-[var(--card-hover)]'
                            }`}
                          >
                            <div className="text-sm font-semibold text-[var(--ink)]">Short / Reel (9:16)</div>
                            <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                              Appears in the vertical Reels feed & Home Shorts shelf.
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[var(--ink)]">
                          Tags (Press Enter or comma to add)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 4k, animation, tutorial"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleAddTag}
                          className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] px-3.5 py-2 text-base sm:text-sm text-[var(--ink)] focus:border-[#3EA6FF] focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--card-hover)] px-3 py-1 text-xs font-medium text-[var(--ink)]"
                            >
                              #{tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                aria-label={`Remove tag ${tag}`}
                                className="ml-0.5 text-[var(--ink-medium)] hover:text-rose-400"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Comments & Moderation */}
                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                          <MessageSquare className="h-4 w-4 text-[var(--ink-medium)]" />
                          <span>Comments</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { id: 'allow_all', label: 'Allow all comments' },
                            { id: 'hold_inappropriate', label: 'Hold potentially inappropriate' },
                            { id: 'hold_all', label: 'Hold all comments for review' },
                            { id: 'disabled', label: 'Disable comments' },
                          ].map((opt) => (
                            <label
                              key={opt.id}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs ${
                                commentsControl === opt.id
                                  ? 'border-[#3EA6FF] bg-[#3EA6FF]/10 font-semibold'
                                  : 'border-[var(--ink-faint)] hover:bg-[var(--card-hover)]'
                              }`}
                            >
                              <input
                                type="radio"
                                name="commentsControl"
                                checked={commentsControl === opt.id}
                                onChange={() => setCommentsControl(opt.id as any)}
                                className="accent-[#3EA6FF]"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] divide-y divide-[var(--ink-faint)]">
                        <div className="flex items-center justify-between gap-3 p-3.5">
                          <div className="flex items-center gap-2.5">
                            <ThumbsUp className="h-4 w-4 text-[var(--ink-medium)] shrink-0" />
                            <div>
                              <div className="text-xs font-semibold">Hide like count from viewers</div>
                              <div className="text-[11px] text-[var(--ink-medium)]">Only you can see total likes in Studio</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={hideLikes}
                            onClick={() => setHideLikes(!hideLikes)}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                              hideLikes ? 'bg-[#3EA6FF]' : 'bg-[var(--ink-faint)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                                hideLikes ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-3 p-3.5">
                          <div className="flex items-center gap-2.5">
                            <Sparkles className="h-4 w-4 text-[var(--ink-medium)] shrink-0" />
                            <div>
                              <div className="text-xs font-semibold">Allow Shorts & Audio Remixing</div>
                              <div className="text-[11px] text-[var(--ink-medium)]">Let other creators sample this audio in Reels</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={allowRemix}
                            onClick={() => setAllowRemix(!allowRemix)}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                              allowRemix ? 'bg-[#3EA6FF]' : 'bg-[var(--ink-faint)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                                allowRemix ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-3 p-3.5">
                          <div className="flex items-center gap-2.5">
                            <ShieldCheck className="h-4 w-4 text-[var(--ink-medium)] shrink-0" />
                            <div>
                              <div className="text-xs font-semibold">Age restriction (18+)</div>
                              <div className="text-[11px] text-[var(--ink-medium)]">Hide when Restricted Mode is enabled</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={ageRestricted}
                            onClick={() => setAgeRestricted(!ageRestricted)}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                              ageRestricted ? 'bg-[#FF0000]' : 'bg-[var(--ink-faint)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                                ageRestricted ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: CHECKS */}
                  {activeStep === 'checks' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--ink)]">Checks</h3>
                        <p className="text-xs text-[var(--ink-medium)] mt-0.5">
                          We check your video for stream compatibility and copyright issues before you publish.
                        </p>
                      </div>

                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] divide-y divide-[var(--ink-faint)]">
                        <div className="p-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--ink)]">Copyright</div>
                            <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                              No copyright or audio strike issues found.
                            </div>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        </div>

                        <div className="p-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--ink)]">Video & Codec Quality</div>
                            <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                              Resolution {videoResolution} · Duration {formatTime(videoDuration)} · Size {file ? formatFileSize(file.size) : totalBytes}
                            </div>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="text-sm font-semibold text-[var(--ink)]">Adaptive Streaming Ladder</div>
                          <p className="text-xs text-[var(--ink-medium)]">
                            Qualities generated automatically after upload:
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {['1080p60 HD', '720p HD', '480p', '360p', '240p'].map((q) => (
                              <span
                                key={q}
                                className="rounded-md bg-[var(--card-hover)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)]"
                              >
                                {q}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: VISIBILITY */}
                  {activeStep === 'visibility' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--ink)]">Visibility</h3>
                        <p className="text-xs text-[var(--ink-medium)] mt-0.5">
                          Choose when to publish and who can see your video.
                        </p>
                      </div>

                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] p-4 space-y-3">
                        <div className="text-sm font-semibold text-[var(--ink)]">Save or publish</div>

                        <div className="space-y-2.5">
                          {[
                            {
                              id: 'private' as const,
                              title: 'Private',
                              desc: 'Only you can watch your video.',
                              icon: Lock,
                            },
                            {
                              id: 'unlisted' as const,
                              title: 'Unlisted',
                              desc: 'Anyone with the video link can watch your video.',
                              icon: EyeOff,
                            },
                            {
                              id: 'public' as const,
                              title: 'Public',
                              desc: 'Everyone can watch your video.',
                              icon: Globe,
                            },
                          ].map((opt) => {
                            const Icon = opt.icon;
                            const isSelected = visibility === opt.id;
                            return (
                              <label
                                key={opt.id}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-[#3EA6FF] bg-[#3EA6FF]/10'
                                    : 'border-[var(--ink-faint)] hover:bg-[var(--card-hover)]'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="visibility"
                                  checked={isSelected}
                                  onChange={() => setVisibility(opt.id)}
                                  className="mt-1 accent-[#3EA6FF]"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                                    <Icon className="h-4 w-4 text-[var(--ink-medium)]" />
                                    <span>{opt.title}</span>
                                  </div>
                                  <p className="text-xs text-[var(--ink-medium)] mt-0.5">{opt.desc}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Notify Followers Toggle */}
                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Bell className="h-4 w-4 text-[var(--ink-medium)] shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-[var(--ink)]">Notify Followers</div>
                            <div className="text-[11px] text-[var(--ink-medium)]">
                              Publish to Following feed and alert your channel followers
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={notifySubscribers}
                          onClick={() => setNotifySubscribers(!notifySubscribers)}
                          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                            notifySubscribers ? 'bg-[#3EA6FF]' : 'bg-[var(--ink-faint)]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                              notifySubscribers ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: STICKY YOUTUBE STUDIO VIDEO PREVIEW CARD */}
                <div className="lg:col-span-5 lg:sticky lg:top-0">
                  <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] overflow-hidden">
                    {/* Live Playable Preview */}
                    <div className="relative aspect-video w-full bg-black">
                      {resolvedVideoUrl ? (
                        <video
                          key={resolvedVideoUrl}
                          src={resolvedVideoUrl}
                          poster={activePoster}
                          controls
                          playsInline
                          muted
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <img
                          src={activePoster}
                          alt="Video preview"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    {/* Preview Card Metadata (Exact YouTube Studio Style) */}
                    <div className="p-4 space-y-3.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] text-[var(--ink-medium)]">Video link</div>
                          <div className="text-xs font-medium text-[#3EA6FF] truncate mt-0.5">
                            {previewShareLink}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyPreviewLink}
                          title="Copy video link"
                          className="p-2 rounded-full hover:bg-[var(--card-hover)] text-[var(--ink-medium)] hover:text-[var(--ink)] shrink-0 transition-colors"
                        >
                          {copiedPreviewLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>

                      <div>
                        <div className="text-[11px] text-[var(--ink-medium)]">Filename</div>
                        <div className="text-xs font-medium text-[var(--ink)] truncate mt-0.5 flex items-center gap-1.5">
                          <FileVideo className="h-3.5 w-3.5 text-[var(--ink-medium)] shrink-0" />
                          <span className="truncate">{file ? file.name : url || 'External Stream'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--ink-faint)]">
                        <div>
                          <div className="text-[11px] text-[var(--ink-medium)]">Video quality</div>
                          <div className="text-xs font-medium text-[var(--ink)] mt-0.5">
                            {videoResolution} · {formatTime(videoDuration)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-[var(--card-hover)] px-1.5 py-0.5 text-[10px] font-bold">SD</span>
                          <span className="rounded bg-[var(--card-hover)] px-1.5 py-0.5 text-[10px] font-bold">HD</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* YOUTUBE STUDIO BOTTOM PROGRESS & ACTION BAR */}
            <div className="shrink-0 border-t border-[var(--ink-faint)] bg-[var(--surface-elevated)]">
              {/* Thin Live Progress Track along top of footer */}
              <div className="h-[3px] w-full bg-[var(--ink-faint)] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    uploadPhase === 'completed'
                      ? 'bg-emerald-500'
                      : uploadPhase === 'uploading' || uploadPhase === 'transcoding' || uploadPhase === 'checking'
                      ? 'bg-[#FF0000]'
                      : 'bg-[#3EA6FF]'
                  }`}
                  style={{
                    width: `${
                      uploadPhase === 'uploading' ||
                      uploadPhase === 'transcoding' ||
                      uploadPhase === 'checking' ||
                      uploadPhase === 'completed'
                        ? uploadProgress
                        : ((currentStepIndex + 1) / STEPS.length) * 100
                    }%`,
                  }}
                />
              </div>

              <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left Live Upload / Processing Status */}
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink-medium)] min-w-0">
                  {uploadPhase === 'uploading' || uploadPhase === 'transcoding' || uploadPhase === 'checking' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#FF0000] shrink-0" />
                  ) : uploadPhase === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#3EA6FF] shrink-0" />
                  )}

                  <span className="truncate font-medium text-[var(--ink)]">
                    {uploadPhase === 'uploading' &&
                      `Uploading ${uploadProgress}% (${uploadedBytes} / ${totalBytes}) · ${uploadSpeed}${
                        etaSeconds > 0 ? ` · ${etaSeconds}s left` : ''
                      }`}
                    {uploadPhase === 'transcoding' && `Processing adaptive stream (${uploadProgress}%)...`}
                    {uploadPhase === 'checking' && `Saving to Firestore (${uploadProgress}%)...`}
                    {uploadPhase === 'completed' && 'Upload complete · Saved to Vio streaming'}
                    {(uploadPhase === 'staged' || uploadPhase === 'idle') &&
                      `${uploadSpeed} · ${file ? formatFileSize(file.size) : totalBytes}`}
                  </span>
                </div>

                {/* Right Stepper & Publish Buttons */}
                <div className="flex items-center justify-end gap-2 shrink-0">
                  {currentStepIndex > 0 && (
                    <button
                      type="button"
                      disabled={isPublishing}
                      onClick={handlePrevStep}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors disabled:opacity-40"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back</span>
                    </button>
                  )}

                  {activeStep !== 'visibility' && (
                    <>
                      <button
                        type="button"
                        disabled={isPublishing || signingInGoogle}
                        onClick={() => {
                          if (!currentUser) {
                            handleInlineGoogleSignIn();
                          } else {
                            handlePublish();
                          }
                        }}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-faint)] px-4 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors disabled:opacity-40"
                      >
                        <Zap className="h-3.5 w-3.5 text-[#FF0000]" />
                        <span>
                          {!currentUser
                            ? signingInGoogle
                              ? 'Signing in...'
                              : 'Sign in & Publish'
                            : publishTarget === 'reel'
                            ? 'Publish Reel'
                            : 'Quick Publish'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isPublishing}
                        onClick={handleNextStep}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] text-[var(--bg)] px-5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        <span>Next</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}

                  {activeStep === 'visibility' && (
                    <button
                      type="button"
                      disabled={isPublishing || signingInGoogle}
                      onClick={() => {
                        if (!currentUser) {
                          handleInlineGoogleSignIn();
                        } else {
                          handlePublish();
                        }
                      }}
                      className={`min-h-[38px] inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-xs font-semibold text-white transition-all ${
                        isPublishing || signingInGoogle
                          ? 'bg-[var(--ink-faint)] text-[var(--ink-medium)] cursor-not-allowed'
                          : 'bg-[#FF0000] hover:bg-[#CC0000] active:scale-95'
                      }`}
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Uploading ({uploadProgress}%)</span>
                        </>
                      ) : uploadPhase === 'completed' ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Published</span>
                        </>
                      ) : (
                        <span>
                          {!currentUser
                            ? signingInGoogle
                              ? 'Signing in...'
                              : 'Sign in to Publish'
                            : visibility === 'private'
                            ? 'Save'
                            : publishTarget === 'reel'
                            ? 'Publish Reel'
                            : 'Publish'}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
