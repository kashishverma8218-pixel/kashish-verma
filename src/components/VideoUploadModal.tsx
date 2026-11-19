import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  LogIn,
  Camera,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Sliders,
  DollarSign,
  Aperture,
  FolderOpen,
  Scissors,
  Crop,
  Volume2,
  VolumeX,
  RotateCcw,
  Hash,
  Video,
  Clapperboard
} from 'lucide-react';
import { VideoItem, ReelItem, Channel } from '../types/video';
import { CATEGORIES } from '../data/mockData';
import { formatFileSize, formatTime } from '../utils/formatTime';
import {
  buildStreamLadder,
  checkUploadPermissions,
  MAX_SHORTS_DURATION_SECONDS,
  ResumableUploadController,
  startVideoProcessing,
  StreamingServiceError,
  uploadFileResumableInChunks,
  UploadStatusPhase,
  validateUploadVideoFile,
  verifyUploadedStorageObject,
} from '../services/streamingService';
import {
  addVideoDoc,
  addReelDoc,
} from '../services/firebaseDatabaseService';
import { useAuth } from '../context/AuthContext';
import { useLanguage, CONTENT_LANGUAGES } from '../context/LanguageContext';
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

export type UploadPhase = UploadStatusPhase;
type WizardStep = 'details' | 'elements' | 'checks' | 'visibility';
type SourceInputTab = 'gallery' | 'record' | 'url';

interface FilterPreset {
  id: string;
  label: string;
  css: string;
  swatch: string;
}

const VIDEO_FILTER_PRESETS: FilterPreset[] = [
  { id: 'normal', label: 'Original', css: 'none', swatch: 'from-zinc-500 to-zinc-700' },
  { id: 'vivid', label: 'Vivid HDR', css: 'saturate(1.45) contrast(1.12) brightness(1.04)', swatch: 'from-rose-500 to-amber-500' },
  { id: 'warm', label: 'Golden', css: 'sepia(0.28) saturate(1.35) contrast(1.06) brightness(1.05)', swatch: 'from-amber-400 to-orange-600' },
  { id: 'cinema', label: 'Cinema Teal', css: 'contrast(1.18) saturate(1.15) hue-rotate(-10deg) brightness(0.96)', swatch: 'from-cyan-500 to-teal-700' },
  { id: 'noir', label: 'Noir B&W', css: 'grayscale(1) contrast(1.28) brightness(1.02)', swatch: 'from-neutral-300 to-neutral-900' },
  { id: 'frost', label: 'Cool Frost', css: 'hue-rotate(15deg) saturate(1.1) brightness(1.06) contrast(1.05)', swatch: 'from-sky-300 to-indigo-600' },
  { id: 'vintage', label: 'Vintage 90s', css: 'sepia(0.45) contrast(0.95) brightness(1.04) saturate(0.9)', swatch: 'from-yellow-600 to-amber-900' },
  { id: 'neon', label: 'Cyber Neon', css: 'saturate(1.75) contrast(1.22) hue-rotate(24deg)', swatch: 'from-fuchsia-500 to-violet-700' },
];

const STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: 'details', label: 'Details', number: 1 },
  { id: 'elements', label: 'Edit & Filters', number: 2 },
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
  const { t } = useLanguage();
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [publishTarget, setPublishTarget] = useState<'video' | 'reel'>(defaultTarget);
  const [activeStep, setActiveStep] = useState<WizardStep>('details');
  const [sourceTab, setSourceTab] = useState<SourceInputTab>('gallery');
  const [sourceType, setSourceType] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(120);
  const [videoResolution, setVideoResolution] = useState<string>('1920x1080');
  const [sourceWidth, setSourceWidth] = useState<number>(1920);
  const [sourceHeight, setSourceHeight] = useState<number>(1080);
  const [copiedPreviewLink, setCopiedPreviewLink] = useState<boolean>(false);

  // Editing State: Trimming, Cropping, Audio Mute, Preview Mute & Hashtags
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(120);
  const [cropAspect, setCropAspect] = useState<'original' | '16:9' | '9:16' | '1:1' | '4:5'>(
    defaultTarget === 'reel' ? '9:16' : 'original'
  );
  const [cropFit, setCropFit] = useState<'contain' | 'cover'>(
    defaultTarget === 'reel' ? 'cover' : 'contain'
  );
  const [isMutedAudio, setIsMutedAudio] = useState<boolean>(false);
  const [previewMuted, setPreviewMuted] = useState<boolean>(false);
  const [hashtagsInput, setHashtagsInput] = useState<string>(
    defaultTarget === 'reel' ? '#shorts #reels #vio' : ''
  );

  // Camera Recorder & Filter State
  const [selectedFilterId, setSelectedFilterId] = useState<string>('normal');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraMicEnabled, setCameraMicEnabled] = useState<boolean>(true);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraStarting, setCameraStarting] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'preview'>('idle');
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [recordedBakedFilter, setRecordedBakedFilter] = useState<boolean>(false);

  // Upload Progress & State
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadSpeed, setUploadSpeed] = useState<string>('Waiting for video file');
  const [uploadedBytes, setUploadedBytes] = useState<string>('0 B');
  const [totalBytes, setTotalBytes] = useState<string>('—');
  const [etaSeconds, setEtaSeconds] = useState<number>(0);
  const [thumbStorageMode, setThumbStorageMode] = useState<'cloud' | 'local' | null>(null);
  const [customThumbStoragePath, setCustomThumbStoragePath] = useState<string | undefined>(undefined);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState<boolean>(false);
  const [thumbGenerationStatus, setThumbGenerationStatus] = useState<'idle' | 'generating' | 'generated' | 'fallback'>('idle');
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);
  const [transcoderWarning, setTranscoderWarning] = useState<string | null>(null);

  // Video Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Gaming');
  const [videoLanguage, setVideoLanguage] = useState('Hindi');
  const [monetizationEnabled, setMonetizationEnabled] = useState<boolean>(true);
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
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const resumableControllerRef = useRef<ResumableUploadController | null>(null);
  const activeVideoIdRef = useRef<string | null>(null);
  const uploadedObjectRef = useRef<{ objectPath: string; finalVideoId: string; fileRef: File } | null>(null);
  const publishingLockRef = useRef<boolean>(false);
  const publishedMediaIdRef = useRef<string | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const canvasLoopRef = useRef<number | null>(null);
  const selectedFilterCssRef = useRef<string>('none');
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

  const activeFilterPreset =
    VIDEO_FILTER_PRESETS.find((f) => f.id === selectedFilterId) || VIDEO_FILTER_PRESETS[0];

  useEffect(() => {
    selectedFilterCssRef.current = activeFilterPreset.css;
  }, [activeFilterPreset.css]);

  const stopCameraResources = useCallback(() => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (canvasLoopRef.current) {
      window.cancelAnimationFrame(canvasLoopRef.current);
      canvasLoopRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((tr) => tr.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setCameraStarting(false);
  }, []);

  const startCameraStream = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera recording is not supported in this browser. Please upload a video from Gallery.');
      return;
    }
    stopCameraResources();
    setCameraError(null);
    setCameraStarting(true);
    try {
      const idealWidth = publishTarget === 'reel' ? 720 : 1280;
      const idealHeight = publishTarget === 'reel' ? 1280 : 720;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
        },
        audio: cameraMicEnabled,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error
          ? `Camera access unavailable: ${err.message}`
          : 'Could not access camera/microphone. Please grant permission or choose from Gallery.'
      );
    } finally {
      setCameraStarting(false);
    }
  }, [cameraFacing, cameraMicEnabled, publishTarget, stopCameraResources]);

  useEffect(() => {
    if (isOpen && sourceTab === 'record' && !file && !resolvedVideoUrl && recordingState !== 'preview') {
      startCameraStream();
    } else {
      stopCameraResources();
    }
    return () => {
      stopCameraResources();
    };
  }, [isOpen, sourceTab, file, resolvedVideoUrl, recordingState, startCameraStream, stopCameraResources]);

  useEffect(() => {
    if (isOpen) {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (resumableControllerRef.current) {
        try {
          resumableControllerRef.current.cancel();
        } catch {
          // ignore
        }
        resumableControllerRef.current = null;
      }
      activeVideoIdRef.current = null;
      uploadedObjectRef.current = null;
      setTranscoderWarning(null);
      setActiveStep('details');
      setPublishTarget(defaultTarget);
      setSourceTab('gallery');
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
      setSelectedFilterId('normal');
      setRecordedBakedFilter(false);
      setRecordedBlob(null);
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl);
      }
      setRecordedPreviewUrl(null);
      setRecordingState('idle');
      setRecordSeconds(0);
      setCameraError(null);
      setMonetizationEnabled(true);
      setCustomThumbnailUrl('');
      setCustomThumbStoragePath(undefined);
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
      setTrimStart(0);
      setTrimEnd(120);
      setCropAspect(defaultTarget === 'reel' ? '9:16' : 'original');
      setCropFit(defaultTarget === 'reel' ? 'cover' : 'contain');
      setIsMutedAudio(false);
      setPreviewMuted(false);
      setHashtagsInput(defaultTarget === 'reel' ? '#shorts #reels #vio' : '');
      setChannelId(
        channels.find((c) => currentUser?.uid && c.id === `channel-${currentUser.uid}`)?.id ||
          channels[0]?.id ||
          'channel-blender'
      );
      setError(null);
    } else {
      stopCameraResources();
    }
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [isOpen, defaultTarget, stopCameraResources]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPublishing) {
        stopCameraResources();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isPublishing, onClose, stopCameraResources]);

  const handleSelectPublishTarget = (target: 'video' | 'reel') => {
    setPublishTarget(target);
    if (target === 'reel') {
      setCropAspect((prev) => (prev === 'original' || prev === '16:9' ? '9:16' : prev));
      setCropFit('cover');
      setHashtagsInput((prev) => (prev.trim() ? prev : '#shorts #reels #vio'));
      if (trimEnd - trimStart > MAX_SHORTS_DURATION_SECONDS) {
        setTrimEnd(Math.min(videoDuration, trimStart + MAX_SHORTS_DURATION_SECONDS));
      }
    } else {
      setCropAspect((prev) => (prev === '9:16' ? 'original' : prev));
      setCropFit('contain');
    }
  };

  if (!isOpen) return null;

  const hasSource = Boolean(file || resolvedVideoUrl);
  const activePoster = customThumbnailUrl.trim() || selectedPoster || autoThumbnails[0];
  const currentStepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const previewShareLink = `${window.location.origin}${window.location.pathname}?v=vio-${draftSlugId}`;

  const parsedHashtags = Array.from(
    new Set(
      hashtagsInput
        .split(/[\s,]+/)
        .map((token) => token.trim().replace(/^#+/, ''))
        .filter(Boolean)
        .map((token) => `#${token}`)
    )
  );

  const trimmedDuration = Math.max(1, Math.round(trimEnd - trimStart));
  const exceedsShortsMax = publishTarget === 'reel' && trimmedDuration > MAX_SHORTS_DURATION_SECONDS;

  const stageSelectedSource = (sizeLabel: string, isLocalFile: boolean) => {
    setUploadPhase('staged');
    setUploadProgress(0);
    setTotalBytes(sizeLabel);
    setUploadedBytes(isLocalFile ? '0 B' : 'Stream URL');
    setUploadSpeed(
      isLocalFile
        ? 'Ready for resumable chunked upload to Cloud Storage'
        : 'Stream URL ready to publish'
    );
    setEtaSeconds(0);
  };

  const applySelectedVideoFile = (
    selected: File,
    opts?: { preserveTitle?: string; bakedFilter?: boolean }
  ) => {
    const validation = validateUploadVideoFile(selected);
    if (!validation.valid) {
      setError(validation.error || 'Unsupported video file. Use MP4, MOV, or WebM.');
      return;
    }
    resumableControllerRef.current?.cancel();
    resumableControllerRef.current = null;
    activeVideoIdRef.current = null;
    uploadedObjectRef.current = null;
    setTranscoderWarning(null);
    setPublishSuccessMessage(null);
    setSourceType('file');
    setFile(selected);
    setRecordedBakedFilter(Boolean(opts?.bakedFilter));
    if (blobUrlRef.current && !publishedBlobUrlsRef.current.has(blobUrlRef.current)) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const blobUrl = URL.createObjectURL(selected);
    blobUrlRef.current = blobUrl;
    setResolvedVideoUrl(blobUrl);
    setTitle(opts?.preserveTitle || cleanTitleFromFileName(selected.name));
    setCustomThumbnailUrl('');
    setCustomThumbStoragePath(undefined);
    setThumbStorageMode(null);
    publishedMediaIdRef.current = null;
    publishingLockRef.current = false;
    setError(null);
    setActiveStep('details');
    stageSelectedSource(formatFileSize(selected.size), true);
    extractThumbnails(blobUrl);
  };

  const handleStartRecording = () => {
    const rawStream = cameraStreamRef.current;
    const vidEl = cameraVideoRef.current;
    if (!rawStream || !vidEl) {
      setCameraError('Camera stream is not ready yet.');
      return;
    }
    setCameraError(null);
    recordChunksRef.current = [];
    setRecordSeconds(0);

    let captureStream: MediaStream = rawStream;
    let baked = false;

    try {
      const vw = vidEl.videoWidth || (publishTarget === 'reel' ? 720 : 1280);
      const vh = vidEl.videoHeight || (publishTarget === 'reel' ? 1280 : 720);
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');

      if (ctx && typeof canvas.captureStream === 'function' && 'filter' in ctx) {
        const renderFrame = () => {
          if (!cameraStreamRef.current) return;
          ctx.save();
          ctx.filter = selectedFilterCssRef.current || 'none';
          if (cameraFacing === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(vidEl, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          canvasLoopRef.current = window.requestAnimationFrame(renderFrame);
        };
        canvasLoopRef.current = window.requestAnimationFrame(renderFrame);
        const canvasStream = canvas.captureStream(30);
        rawStream.getAudioTracks().forEach((tAudio) => canvasStream.addTrack(tAudio));
        captureStream = canvasStream;
        baked = selectedFilterId !== 'normal';
      }
    } catch {
      captureStream = rawStream;
      baked = false;
    }

    setRecordedBakedFilter(baked);

    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const supportedMime = mimeCandidates.find((m) =>
      typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    );

    try {
      const recorder = supportedMime
        ? new MediaRecorder(captureStream, { mimeType: supportedMime })
        : new MediaRecorder(captureStream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (canvasLoopRef.current) {
          window.cancelAnimationFrame(canvasLoopRef.current);
          canvasLoopRef.current = null;
        }
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        const blobType = recorder.mimeType || supportedMime || 'video/webm';
        const blob = new Blob(recordChunksRef.current, { type: blobType });
        if (blob.size > 0) {
          if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
          setRecordedBlob(blob);
          setRecordedPreviewUrl(URL.createObjectURL(blob));
          setRecordingState('preview');
        } else {
          setRecordingState('idle');
        }
      };

      recorder.start(350);
      mediaRecorderRef.current = recorder;
      setRecordingState('recording');
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1;
          if (publishTarget === 'reel' && next >= MAX_SHORTS_DURATION_SECONDS) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
          }
          return next;
        });
      }, 1000);
    } catch (err: unknown) {
      setCameraError(err instanceof Error ? err.message : 'Unable to start camera recording.');
    }
  };

  const handleTogglePauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording' && typeof rec.pause === 'function') {
      rec.pause();
      setRecordingState('paused');
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    } else if (rec.state === 'paused' && typeof rec.resume === 'function') {
      rec.resume();
      setRecordingState('recording');
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleUseRecordedClip = () => {
    if (!recordedBlob) return;
    const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const recordedFile = new File([recordedBlob], `vio-camera-${Date.now()}.${ext}`, {
      type: recordedBlob.type || 'video/webm',
    });
    stopCameraResources();
    applySelectedVideoFile(recordedFile, {
      preserveTitle: publishTarget === 'reel' ? 'My Recorded Short' : 'My Camera Video',
      bakedFilter: recordedBakedFilter,
    });
  };

  const handleRetakeRecording = () => {
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
    }
    setRecordedPreviewUrl(null);
    setRecordedBlob(null);
    setRecordSeconds(0);
    setRecordingState('idle');
  };

  const handleCapturePreviewFrame = () => {
    const vid = previewVideoRef.current;
    if (!vid || vid.readyState < 2) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (!recordedBakedFilter && activeFilterPreset.css !== 'none' && 'filter' in ctx) {
        ctx.filter = activeFilterPreset.css;
      }
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      if (dataUrl && dataUrl.length > 500) {
        setAutoThumbnails((prev) => [dataUrl, ...prev.slice(0, 2)]);
        setSelectedPoster(dataUrl);
        setCustomThumbnailUrl('');
        setThumbGenerationStatus('generated');
      }
    } catch {
      setError('Unable to snapshot external stream due to CORS; upload a custom thumbnail instead.');
    }
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
    resumableControllerRef.current?.cancel();
    resumableControllerRef.current = null;
    activeVideoIdRef.current = null;
    uploadedObjectRef.current = null;
    setTranscoderWarning(null);
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
        setTrimStart(0);
        setTrimEnd(
          publishTarget === 'reel'
            ? Math.min(dur, MAX_SHORTS_DURATION_SECONDS)
            : dur
        );
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          setSourceWidth(vid.videoWidth);
          setSourceHeight(vid.videoHeight);
          setVideoResolution(`${vid.videoWidth}x${vid.videoHeight}`);
          if (vid.videoHeight > vid.videoWidth && publishTarget === 'reel') {
            setCropAspect('9:16');
          }
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
        setTrimStart(0);
        setTrimEnd(
          publishTarget === 'reel'
            ? Math.min(dur, MAX_SHORTS_DURATION_SECONDS)
            : dur
        );
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          setSourceWidth(vid.videoWidth);
          setSourceHeight(vid.videoHeight);
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

    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const lowerThumbName = (imgFile.name || '').toLowerCase();
    const validImageExt = /\.(jpe?g|png|webp|gif)$/i.test(lowerThumbName);
    const normalizedThumbMime = (imgFile.type || '').toLowerCase();
    if (!validImageTypes.includes(normalizedThumbMime) && !validImageExt) {
      setError('Unsupported thumbnail format. Please select a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (imgFile.size <= 0 || imgFile.size > 5 * 1024 * 1024) {
      setError('Thumbnail image must be smaller than 5 MB.');
      return;
    }
    if (!auth.currentUser?.uid) {
      setError('Sign in with a real Firebase account (Google or Email/Password) to upload custom thumbnails.');
      return;
    }

    setError(null);
    setIsUploadingThumb(true);
    try {
      const uploaded = await uploadFileResumableInChunks({
        file: imgFile,
        videoId: activeVideoIdRef.current || draftSlugId,
        folder: 'thumbnails',
        visibility,
      });
      await verifyUploadedStorageObject(uploaded.objectPath);
      const assetUrl = `/api/media/asset?path=${encodeURIComponent(uploaded.objectPath)}`;
      setCustomThumbnailUrl(assetUrl);
      setSelectedPoster(assetUrl);
      setCustomThumbStoragePath(uploaded.objectPath);
      setThumbStorageMode('cloud');
    } catch (err: any) {
      setError(err?.message || 'Failed to upload custom thumbnail image to Cloud Storage.');
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

  const handlePauseUpload = () => {
    if (resumableControllerRef.current && uploadPhase === 'uploading') {
      resumableControllerRef.current.pause();
      publishingLockRef.current = false;
      setIsPublishing(false);
      setUploadPhase('paused');
      setUploadSpeed('Paused · Click Resume to continue from last chunk');
    }
  };

  const handleCancelUpload = () => {
    if (resumableControllerRef.current) {
      try {
        resumableControllerRef.current.cancel();
      } catch {
        // ignore
      }
      resumableControllerRef.current = null;
    }
    publishingLockRef.current = false;
    setIsPublishing(false);
    setUploadPhase('failed');
    setUploadSpeed('Upload canceled · Retry starts a fresh session');
    setError('Upload canceled. Click "Retry Upload" whenever you are ready.');
  };

  const handlePublish = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (publishingLockRef.current) return;
    if (
      uploadPhase === 'completed' &&
      publishedMediaIdRef.current &&
      publishedMediaIdRef.current === activeVideoIdRef.current
    ) {
      return;
    }

    setError(null);
    setTranscoderWarning(null);
    setPublishSuccessMessage(null);

    if (!currentUser?.uid || !auth.currentUser?.uid) {
      setError(
        'Firebase sign-in is required to upload videos. Please sign in with Google or Email/Password (local demo mode cannot access Cloud Storage).'
      );
      return;
    }

    if (file) {
      const fileCheck = validateUploadVideoFile(file);
      if (!fileCheck.valid) {
        setError(fileCheck.error || 'Unsupported video file.');
        setUploadPhase('failed');
        return;
      }
    }

    if (publishTarget === 'reel' && trimmedDuration > MAX_SHORTS_DURATION_SECONDS) {
      setError(
        `Shorts & Reels must be 3 minutes (180s) or shorter. Trim your clip in "Edit & Filters" or switch to Long Video.`
      );
      setActiveStep('elements');
      return;
    }

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

    const expectedPrefix = publishTarget === 'reel' ? 'reel-' : 'studio-';
    if (!activeVideoIdRef.current || !activeVideoIdRef.current.startsWith(expectedPrefix)) {
      activeVideoIdRef.current = `${expectedPrefix}${Date.now()}`;
    }
    const finalVideoId = activeVideoIdRef.current;

    let effectiveUrl = resolvedVideoUrl || url.trim();
    let uploadedSourcePath: string | undefined;
    let uploadedThumbStoragePath: string | undefined = customThumbStoragePath;

    publishingLockRef.current = true;
    setIsPublishing(true);
    setUploadPhase('validating');
    setUploadSpeed('Checking Firebase permissions & Cloud Storage readiness...');

    try {
      const permCheck = await checkUploadPermissions();
      if (!permCheck.authorized) {
        throw new StreamingServiceError(
          permCheck.message || 'Authentication check failed.',
          'AUTH_REQUIRED',
          401
        );
      }

      if (file) {
        if (!permCheck.storageReady) {
          throw new StreamingServiceError(
            permCheck.message ||
              `Google Cloud Storage bucket "${permCheck.bucketName || 'unconfigured'}" is not accessible. Check bucket configuration before uploading.`,
            'GCS_BUCKET_NOT_READY',
            503
          );
        }

        // Reuse already-verified object if previous publish failed only during metadata/transcoder step
        if (
          uploadedObjectRef.current &&
          uploadedObjectRef.current.fileRef === file &&
          uploadedObjectRef.current.finalVideoId === finalVideoId
        ) {
          uploadedSourcePath = uploadedObjectRef.current.objectPath;
        } else {
          setUploadPhase('uploading');
          setTotalBytes(formatFileSize(file.size));
          const resumeStartTime = Date.now();
          let resumeBaseBytes = 0;

          if (
            !resumableControllerRef.current ||
            resumableControllerRef.current.file !== file ||
            resumableControllerRef.current.videoId !== finalVideoId ||
            resumableControllerRef.current.getState() === 'canceled'
          ) {
            resumableControllerRef.current = new ResumableUploadController({
              file,
              videoId: finalVideoId,
              folder: 'videos',
              visibility,
              onProgress: (pct, bytesTransferred, total) => {
                setUploadProgress(Math.min(85, Math.round(pct * 0.85)));
                setUploadedBytes(formatFileSize(bytesTransferred));
                setTotalBytes(formatFileSize(total));
                const elapsed = (Date.now() - resumeStartTime) / 1000;
                const deltaBytes = Math.max(0, bytesTransferred - resumeBaseBytes);
                if (elapsed > 0.4 && deltaBytes > 0) {
                  const speedMBps = deltaBytes / (1024 * 1024) / elapsed;
                  setUploadSpeed(`${speedMBps.toFixed(1)} MB/s`);
                  const remainingBytes = Math.max(0, total - bytesTransferred);
                  const bytesPerSec = deltaBytes / elapsed;
                  setEtaSeconds(bytesPerSec > 0 ? Math.round(remainingBytes / bytesPerSec) : 0);
                }
              },
            });
          } else {
            const committed = resumableControllerRef.current.getCommittedOffset();
            resumeBaseBytes = committed;
            const existingPct = file.size > 0 ? Math.round((committed / file.size) * 85) : 0;
            setUploadProgress(Math.min(85, existingPct));
            setUploadedBytes(formatFileSize(committed));
            setUploadSpeed('Resuming chunked upload...');
          }

          const uploadResult = await resumableControllerRef.current.startOrResume();
          uploadedSourcePath = uploadResult.objectPath;
          uploadedObjectRef.current = {
            objectPath: uploadedSourcePath,
            finalVideoId,
            fileRef: file,
          };
        }

        setUploadPhase('verifying');
        setUploadProgress(88);
        setUploadSpeed('Verifying uploaded object in Google Cloud Storage...');

        const verified = await verifyUploadedStorageObject(uploadedSourcePath);
        if (!verified.exists || verified.sizeBytes <= 0) {
          uploadedObjectRef.current = null;
          throw new StreamingServiceError(
            'Uploaded file could not be verified in Google Cloud Storage.',
            'GCS_VERIFY_FAILED',
            404
          );
        }
        effectiveUrl = `/api/media/object/${encodeURIComponent(finalVideoId)}`;
      }

      if (!effectiveUrl || (!file && effectiveUrl.startsWith('blob:'))) {
        throw new Error('Please select a valid video file or enter a stream URL.');
      }

      setUploadPhase('verifying');
      setUploadProgress(91);
      setUploadSpeed('Uploading cover thumbnail & saving metadata...');

      if (finalPoster.startsWith('data:image/')) {
        const thumbFile = await dataUrlToFile(finalPoster, `${finalVideoId}_thumb.jpg`);
        const uploadedThumb = await uploadFileResumableInChunks({
          file: thumbFile,
          videoId: finalVideoId,
          folder: 'thumbnails',
          visibility,
        });
        await verifyUploadedStorageObject(uploadedThumb.objectPath);
        finalPoster = `/api/media/asset?path=${encodeURIComponent(uploadedThumb.objectPath)}`;
        uploadedThumbStoragePath = uploadedThumb.objectPath;
      }

      const ladder = buildStreamLadder(finalVideoId, effectiveUrl, {
        width: sourceWidth,
        height: sourceHeight,
      });
      const uploaderId = auth.currentUser.uid;
      const hasTrimEdit = trimStart > 0.1 || trimEnd < Math.max(1, videoDuration - 0.5);
      const normalizedTrimStart = hasTrimEdit ? Math.max(0, Math.round(trimStart * 10) / 10) : undefined;
      const normalizedTrimEnd = hasTrimEdit ? Math.max(1, Math.round(trimEnd * 10) / 10) : undefined;
      const mergedHashtags = parsedHashtags.length > 0 ? parsedHashtags : undefined;
      const mergedTags = Array.from(
        new Set([
          ...(tags.length > 0 ? tags : [category]),
          ...parsedHashtags.map((h) => h.replace(/^#/, '')),
        ])
      );
      const initialTranscodingStatus: 'pending' | 'ready' = uploadedSourcePath ? 'pending' : 'ready';

      setUploadPhase('processing');
      setUploadProgress(94);
      setUploadSpeed('Saving metadata to Firestore...');
      let hadTranscoderWarning = false;

      if (publishTarget === 'reel') {
        const selectedChannel = channels.find((c) => c.id === channelId);
        const appliedCssFilter =
          !recordedBakedFilter && activeFilterPreset.css !== 'none'
            ? activeFilterPreset.css
            : undefined;
        const appliedFilterPreset =
          activeFilterPreset.id !== 'normal' ? activeFilterPreset.id : undefined;

        const newReel: ReelItem = {
          id: finalVideoId,
          ownerId: uploaderId,
          uploaderId,
          title: finalTitle,
          description: description.trim() || `${finalTitle} on Vio streaming Reels`,
          videoUrl: effectiveUrl,
          poster: finalPoster,
          channelId: channelId,
          views: 0,
          likes: 0,
          commentsCount: 0,
          audioTrack: isMutedAudio
            ? 'Muted Audio · Original'
            : `Original Sound · ${selectedChannel?.name || 'Vio Creator'}`,
          audioArtist: selectedChannel?.name || 'Vio Creator',
          tags: mergedTags.length > 0 ? mergedTags : [category, 'Reels'],
          ...(mergedHashtags ? { hashtags: mergedHashtags } : {}),
          category,
          language: videoLanguage,
          monetizationEnabled,
          filterStyle: appliedCssFilter,
          filterPreset: appliedFilterPreset,
          duration: trimmedDuration,
          ...(normalizedTrimStart !== undefined ? { trimStart: normalizedTrimStart } : {}),
          ...(normalizedTrimEnd !== undefined ? { trimEnd: normalizedTrimEnd } : {}),
          cropAspect,
          cropFit,
          isMutedAudio,
          ...(uploadedSourcePath ? { sourceObjectPath: uploadedSourcePath, storagePath: uploadedSourcePath } : {}),
          ...(uploadedThumbStoragePath ? { thumbnailStoragePath: uploadedThumbStoragePath } : {}),
          visibility,
          createdAt: 'Just now',
          transcodingStatus: initialTranscodingStatus,
          streamQualities: ladder,
        };

        await addReelDoc(newReel);

        let transcodeQueued = false;
        if (uploadedSourcePath) {
          setUploadProgress(97);
          setUploadSpeed('Triggering Google Cloud Transcoder HLS job...');
          try {
            const jobRes = await startVideoProcessing({
              videoId: finalVideoId,
              sourceObjectPath: uploadedSourcePath,
              collectionName: 'reels',
              sourceWidth,
              sourceHeight,
              trimStart: normalizedTrimStart,
              trimEnd: normalizedTrimEnd,
              isMutedAudio,
            });
            newReel.transcodingStatus = 'processing';
            newReel.hlsOutputPrefix = jobRes.hlsOutputPrefix;
            transcodeQueued = true;
          } catch (transcodeErr: any) {
            hadTranscoderWarning = true;
            setTranscoderWarning(
              transcodeErr?.message ||
                'Cloud Transcoder API is currently disabled on this GCP project. Raw uploaded source is saved.'
            );
          }
        }

        setUploadProgress(100);
        setUploadPhase('completed');
        setUploadSpeed(
          transcodeQueued
            ? 'Uploaded · Cloud Transcoder HLS processing started'
            : 'Uploaded to Cloud Storage & saved to Shorts Feed'
        );
        setEtaSeconds(0);
        setPublishSuccessMessage(
          transcodeQueued
            ? `Short / Reel "${finalTitle}" uploaded and queued for Cloud Transcoder HLS!`
            : `Short / Reel "${finalTitle}" uploaded and published!`
        );

        onPublishReel?.(newReel);
      } else {
        const appliedCssFilter =
          !recordedBakedFilter && activeFilterPreset.css !== 'none'
            ? activeFilterPreset.css
            : undefined;
        const appliedFilterPreset =
          activeFilterPreset.id !== 'normal' ? activeFilterPreset.id : undefined;

        const newVideo: VideoItem = {
          id: finalVideoId,
          ownerId: uploaderId,
          uploaderId,
          userId: uploaderId,
          title: finalTitle,
          description: description.trim(),
          url: effectiveUrl,
          poster: finalPoster,
          channelId: channelId,
          views: 0,
          likes: 0,
          dislikes: 0,
          publishedAt: 'Just now',
          duration: trimmedDuration,
          category: category,
          language: videoLanguage,
          monetizationEnabled,
          filterStyle: appliedCssFilter,
          filterPreset: appliedFilterPreset,
          tags: mergedTags.length > 0 ? mergedTags : [category],
          ...(mergedHashtags ? { hashtags: mergedHashtags } : {}),
          isLocal: false,
          fileSize: file ? formatFileSize(file.size) : totalBytes,
          visibility,
          hideLikes,
          commentsControl,
          notifySubscribers,
          allowRemix,
          ageRestricted,
          createdAt: Date.now(),
          streamQualities: ladder,
          hlsManifestUrl: '',
          backupStreams: [effectiveUrl],
          transcodingStatus: initialTranscodingStatus,
          ...(uploadedSourcePath ? { sourceObjectPath: uploadedSourcePath, storagePath: uploadedSourcePath } : {}),
          ...(uploadedThumbStoragePath ? { thumbnailStoragePath: uploadedThumbStoragePath } : {}),
          ...(normalizedTrimStart !== undefined ? { trimStart: normalizedTrimStart } : {}),
          ...(normalizedTrimEnd !== undefined ? { trimEnd: normalizedTrimEnd } : {}),
          cropAspect,
          cropFit,
          isMutedAudio,
          sourceWidth,
          sourceHeight,
        };

        await addVideoDoc(newVideo);

        let transcodeQueued = false;
        if (uploadedSourcePath) {
          setUploadProgress(97);
          setUploadSpeed('Triggering Google Cloud Transcoder HLS job...');
          try {
            const jobRes = await startVideoProcessing({
              videoId: finalVideoId,
              sourceObjectPath: uploadedSourcePath,
              collectionName: 'videos',
              sourceWidth,
              sourceHeight,
              trimStart: normalizedTrimStart,
              trimEnd: normalizedTrimEnd,
              isMutedAudio,
            });
            newVideo.transcodingStatus = 'processing';
            newVideo.hlsOutputPrefix = jobRes.hlsOutputPrefix;
            newVideo.transcoderJobName = jobRes.jobName;
            transcodeQueued = true;
          } catch (transcodeErr: any) {
            hadTranscoderWarning = true;
            setTranscoderWarning(
              transcodeErr?.message ||
                'Cloud Transcoder API is currently disabled on this GCP project. Raw uploaded source is saved.'
            );
          }
        }

        setUploadProgress(100);
        setUploadPhase('completed');
        setUploadSpeed(
          transcodeQueued
            ? 'Uploaded · Cloud Transcoder HLS processing started'
            : 'Uploaded to Cloud Storage & saved to VIO Feed'
        );
        setEtaSeconds(0);
        setPublishSuccessMessage(
          transcodeQueued
            ? `Video "${finalTitle}" uploaded and queued for 360p–1080p HLS transcoding!`
            : `Video "${finalTitle}" uploaded and published!`
        );

        onPublishVideo(newVideo);
      }

      publishedMediaIdRef.current = finalVideoId;
      resumableControllerRef.current = null;
      publishingLockRef.current = false;
      setIsPublishing(false);
      if (!hadTranscoderWarning) {
        closeTimeoutRef.current = window.setTimeout(() => {
          onClose();
        }, 1600);
      }
    } catch (err: unknown) {
      publishingLockRef.current = false;
      if (err instanceof StreamingServiceError && err.code === 'UPLOAD_PAUSED') {
        setIsPublishing(false);
        setUploadPhase('paused');
        setUploadSpeed('Paused · Click Resume to continue from last chunk');
        return;
      }

      console.error('Video upload/publish error:', err);
      setIsPublishing(false);
      setUploadPhase('failed');
      setUploadSpeed('Upload failed · Click Retry Upload');
      let readableError = 'Failed to upload video to Cloud Storage. Click "Retry Upload" to resume.';
      if (err instanceof Error && err.message) {
        if (err.message.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(err.message);
            readableError = parsed?.error
              ? `Firestore error (${parsed.operationType || 'write'}): ${parsed.error}`
              : err.message;
          } catch {
            readableError = err.message;
          }
        } else {
          readableError = err.message;
        }
      }
      setError(readableError);
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
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
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
              {hasSource
                ? title.trim() || 'Untitled video'
                : publishTarget === 'reel'
                ? 'Upload Shorts & Reels'
                : 'Upload Long Video'}
            </h2>
            {hasSource && (
              <span className="hidden sm:inline-flex items-center rounded-md bg-[var(--card-hover)] px-2 py-0.5 text-xs font-medium text-[var(--ink-medium)] capitalize shrink-0">
                {uploadPhase === 'completed' ? 'Published' : `${visibility} · ${publishTarget === 'reel' ? 'Short/Reel' : 'Long Video'}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Target Toggle: Upload Long Video vs Upload Shorts/Reels */}
            <div className="hidden sm:flex items-center rounded-full bg-[var(--card-hover)] p-0.5 text-xs font-medium">
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => handleSelectPublishTarget('video')}
                className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                  publishTarget === 'video'
                    ? 'bg-[var(--ink)] text-[var(--bg)] font-semibold'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
                }`}
              >
                Upload Long Video
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => handleSelectPublishTarget('reel')}
                className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                  publishTarget === 'reel'
                    ? 'bg-[#FF0000] text-white font-semibold'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
                }`}
              >
                Upload Shorts / Reels
              </button>
            </div>

            <button
              onClick={() => {
                if (!isPublishing) onClose();
              }}
              disabled={isPublishing}
              aria-label="Close upload dialog"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] transition-colors disabled:opacity-40 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* STAGE A: SMOOTH UPLOAD, GALLERY, CAMERA RECORDER & STREAM URL */}
        {!hasSource ? (
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 flex flex-col items-center">
            {!currentUser && (
              <div className="w-full max-w-2xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
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
              <div className="w-full max-w-2xl mb-4 flex items-center gap-2.5 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-400 border border-rose-500/25">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Prominent Dual Upload Mode Cards: Upload Long Video vs Upload Shorts/Reels */}
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => handleSelectPublishTarget('video')}
                className={`flex items-center gap-3 min-h-[54px] rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                  publishTarget === 'video'
                    ? 'border-[#3EA6FF] bg-[#3EA6FF]/12 shadow-xs'
                    : 'border-[var(--ink-faint)] bg-[var(--surface)] hover:bg-[var(--card-hover)]'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  publishTarget === 'video' ? 'bg-[#3EA6FF] text-black' : 'bg-[var(--card-hover)] text-[var(--ink)]'
                }`}>
                  <Video className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[var(--ink)]">Upload Long Video</div>
                  <div className="text-[11px] text-[var(--ink-medium)]">16:9 widescreen · MP4, MOV, WebM</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPublishTarget('reel')}
                className={`flex items-center gap-3 min-h-[54px] rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                  publishTarget === 'reel'
                    ? 'border-[#FF0000] bg-[#FF0000]/12 shadow-xs'
                    : 'border-[var(--ink-faint)] bg-[var(--surface)] hover:bg-[var(--card-hover)]'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  publishTarget === 'reel' ? 'bg-[#FF0000] text-white' : 'bg-[var(--card-hover)] text-[var(--ink)]'
                }`}>
                  <Clapperboard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[var(--ink)]">Upload Shorts / Reels</div>
                  <div className="text-[11px] text-[var(--ink-medium)]">9:16 vertical · Up to 3 min</div>
                </div>
              </button>
            </div>

            {/* 3-Tab Mode Selector: Gallery Upload | Record Video | Stream URL */}
            <div className="w-full max-w-2xl mb-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--ink-faint)] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setSourceTab('gallery');
                  setError(null);
                }}
                className={`min-h-[42px] flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  sourceTab === 'gallery'
                    ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)]'
                }`}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('upload.galleryTab', 'Upload from Gallery')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceTab('record');
                  setError(null);
                }}
                className={`min-h-[42px] flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  sourceTab === 'record'
                    ? 'bg-[#FF0000] text-white shadow-xs'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)]'
                }`}
              >
                <Camera className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('upload.recordTab', 'Record Video')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceTab('url');
                  setError(null);
                }}
                className={`min-h-[42px] flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  sourceTab === 'url'
                    ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                    : 'text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)]'
                }`}
              >
                <LinkIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('upload.urlTab', 'Stream URL')}</span>
              </button>
            </div>

            {/* TAB 1: GALLERY & DEVICE DROPZONE */}
            {sourceTab === 'gallery' && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-2xl flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed px-6 py-9 sm:py-12 cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#3EA6FF] bg-[#3EA6FF]/10 scale-[1.01]'
                    : 'border-[var(--ink-faint)] hover:border-[var(--ink-medium)] bg-[var(--surface)]/50'
                }`}
              >
                <div
                  className={`flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full mb-5 transition-transform ${
                    isDragging ? 'bg-[#3EA6FF]/20 scale-105' : 'bg-[var(--card-hover)]'
                  }`}
                >
                  <Upload className={`h-10 w-10 sm:h-11 sm:w-11 ${isDragging ? 'text-[#3EA6FF]' : 'text-[var(--ink-medium)]'}`} />
                </div>

                <p className="text-base font-bold text-[var(--ink)]">
                  {isDragging
                    ? 'Drop your video file here'
                    : publishTarget === 'reel'
                    ? 'Select Vertical Short / Reel (Up to 3 min)'
                    : t('upload.selectFromGallery', 'Choose Long Video from Gallery / Files')}
                </p>
                <p className="mt-1.5 text-xs text-[var(--ink-medium)] max-w-md">
                  {publishTarget === 'reel'
                    ? 'Upload vertical 9:16 Reels or Shorts up to 3 minutes (MP4, MOV, WebM, max 500 MB).'
                    : 'Drag & drop or tap below to pick HD films, tutorials, or Gaming clips. Supports MP4, MOV, WebM (up to 500 MB).'}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#FF0000] text-white px-6 py-2.5 text-sm font-bold hover:bg-[#CC0000] active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>{publishTarget === 'reel' ? 'Choose Short / Reel' : 'Open Gallery / Files'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSourceTab('record');
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-[var(--ink-faint)] bg-[var(--bg)] text-[var(--ink)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--card-hover)] transition-all cursor-pointer"
                  >
                    <Camera className="h-4 w-4 text-[#FF0000]" />
                    <span>{t('upload.recordTab', 'Record Video')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE CAMERA STUDIO WITH REAL-TIME FILTERS */}
            {sourceTab === 'record' && (
              <div className="w-full max-w-2xl rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] overflow-hidden shadow-lg">
                {/* Camera Preview / Recorded Clip Frame */}
                <div className="relative bg-black flex items-center justify-center overflow-hidden">
                  <div
                    className={`relative w-full ${
                      publishTarget === 'reel' ? 'max-w-[300px] aspect-[9/16] max-h-[400px]' : 'aspect-video max-h-[380px]'
                    } bg-black overflow-hidden`}
                  >
                    {recordingState === 'preview' && recordedPreviewUrl ? (
                      <video
                        key={recordedPreviewUrl}
                        src={recordedPreviewUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        style={{
                          filter: !recordedBakedFilter && activeFilterPreset.css !== 'none' ? activeFilterPreset.css : undefined,
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        ref={cameraVideoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                          filter: activeFilterPreset.css !== 'none' ? activeFilterPreset.css : undefined,
                          transform: cameraFacing === 'user' ? 'scaleX(-1)' : undefined,
                        }}
                        className="w-full h-full object-cover transition-all duration-200"
                      />
                    )}

                    {/* Top Camera Overlay */}
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-20">
                      <div className="flex items-center gap-2">
                        {recordingState === 'recording' || recordingState === 'paused' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF0000] px-3 py-1 text-xs font-mono font-bold text-white shadow-md tabular-nums">
                            <span className={`h-2 w-2 rounded-full bg-white ${recordingState === 'recording' ? 'animate-pulse' : ''}`} />
                            {recordingState === 'paused' ? 'PAUSED' : 'REC'} {formatTime(recordSeconds)}
                          </span>
                        ) : recordingState === 'preview' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-black shadow-md">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Clip Ready ({formatTime(recordSeconds)})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white border border-white/15">
                            <Camera className="h-3.5 w-3.5 text-[#FF0000]" />
                            <span>{publishTarget === 'reel' ? '9:16 Reels Camera' : '16:9 Studio Camera'}</span>
                          </span>
                        )}
                      </div>

                      {recordingState === 'idle' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCameraMicEnabled((m) => !m)}
                            title={cameraMicEnabled ? 'Mute microphone' : 'Enable microphone'}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 backdrop-blur-md border border-white/15 cursor-pointer"
                          >
                            {cameraMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-rose-400" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCameraFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                            title="Flip front/rear camera"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 backdrop-blur-md border border-white/15 cursor-pointer"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Camera Loading / Permission Error */}
                    {(cameraStarting || cameraError) && recordingState !== 'preview' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-6 text-center z-30">
                        {cameraStarting ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-[#FF0000] mb-2" />
                            <p className="text-xs font-semibold">Starting camera & microphone...</p>
                          </>
                        ) : (
                          <>
                            <Camera className="h-9 w-9 text-rose-400 mb-2" />
                            <p className="text-xs text-white/90 max-w-xs">{cameraError}</p>
                            <div className="mt-4 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={startCameraStream}
                                className="rounded-full bg-white text-black px-4 py-1.5 text-xs font-bold cursor-pointer"
                              >
                                Retry Camera
                              </button>
                              <button
                                type="button"
                                onClick={() => setSourceTab('gallery')}
                                className="rounded-full bg-[#FF0000] text-white px-4 py-1.5 text-xs font-bold cursor-pointer"
                              >
                                Open Gallery
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Video Filter Selector Strip */}
                <div className="p-3.5 border-t border-[var(--ink-faint)] bg-[var(--bg)]/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-[#FF0000]" />
                      {t('upload.filters', 'Video Filters')} ({activeFilterPreset.label})
                    </span>
                    <span className="text-[11px] text-[var(--ink-medium)]">
                      {recordingState === 'preview' ? 'Preview filter applied' : 'Live filter recorded to clip'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {VIDEO_FILTER_PRESETS.map((preset) => {
                      const isSel = selectedFilterId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={recordingState === 'recording'}
                          onClick={() => setSelectedFilterId(preset.id)}
                          className={`flex items-center gap-2 shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer disabled:opacity-60 ${
                            isSel
                              ? 'border-[#FF0000] bg-[#FF0000]/10 text-[#FF0000]'
                              : 'border-[var(--ink-faint)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--card-hover)]'
                          }`}
                        >
                          <span className={`h-3.5 w-3.5 rounded-full bg-gradient-to-tr ${preset.swatch} shrink-0`} />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Camera Action Bar */}
                <div className="px-4 py-3.5 border-t border-[var(--ink-faint)] flex flex-wrap items-center justify-between gap-3">
                  {recordingState === 'idle' && (
                    <>
                      <span className="text-xs text-[var(--ink-medium)]">
                        {cameraReady ? 'Ready to record with selected filter' : 'Waiting for camera...'}
                      </span>
                      <button
                        type="button"
                        disabled={!cameraReady}
                        onClick={handleStartRecording}
                        className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white px-6 py-2 text-xs font-bold shadow-md disabled:opacity-40 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="h-3 w-3 rounded-full bg-white" />
                        <span>{t('upload.startRecording', 'Start Recording')}</span>
                      </button>
                    </>
                  )}

                  {(recordingState === 'recording' || recordingState === 'paused') && (
                    <div className="w-full flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePauseRecording}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-faint)] bg-[var(--bg)] px-5 py-2 text-xs font-bold text-[var(--ink)] hover:bg-[var(--card-hover)] cursor-pointer"
                      >
                        {recordingState === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        <span>{recordingState === 'paused' ? 'Resume' : 'Pause'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="min-h-[42px] inline-flex items-center gap-2 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white px-6 py-2 text-xs font-bold shadow-md cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5 fill-white" />
                        <span>{t('upload.stopRecording', 'Stop & Preview')}</span>
                      </button>
                    </div>
                  )}

                  {recordingState === 'preview' && (
                    <div className="w-full flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleRetakeRecording}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-faint)] bg-[var(--bg)] px-5 py-2 text-xs font-bold text-[var(--ink)] hover:bg-[var(--card-hover)] cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Retake</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleUseRecordedClip}
                        className="min-h-[42px] inline-flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2 text-xs font-bold shadow-md cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t('upload.useRecorded', 'Use Recorded Clip')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: STREAM URL */}
            {sourceTab === 'url' && (
              <div className="w-full max-w-2xl rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">Import from Video / CDN URL</h3>
                  <button
                    type="button"
                    onClick={() => setSourceTab('gallery')}
                    className="text-xs font-medium text-[#3EA6FF] hover:underline"
                  >
                    Back to Gallery upload
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

            <p className="mt-5 text-[11px] text-[var(--ink-medium)] text-center max-w-md">
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
                        ? 'Sign in with Google or Email/Password to upload and publish your video.'
                        : 'Demo/local session active: Cloud Storage uploads require a real Firebase account. Sign in with Google to upload.'}
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-400 border border-rose-500/25">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {uploadPhase === 'failed' && currentUser && auth.currentUser?.uid && (
                      <button
                        type="button"
                        onClick={() => handlePublish()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#FF0000] text-white px-3.5 py-1.5 text-xs font-bold hover:bg-[#CC0000] cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Retry Upload</span>
                      </button>
                    )}
                    {(!currentUser || !auth.currentUser?.uid) && onOpenAuth && (
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="rounded-full bg-rose-600 text-white px-3 py-1 text-xs font-semibold shrink-0 hover:bg-rose-700 cursor-pointer"
                      >
                        Sign in
                      </button>
                    )}
                  </div>
                </div>
              )}

              {transcoderWarning && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 border border-amber-500/25">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{transcoderWarning}</span>
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

                      {/* Description / Caption Box */}
                      <div className="rounded-xl border border-[var(--ink-faint)] focus-within:border-[#3EA6FF] bg-[var(--surface)] px-3.5 py-2.5 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="yt-video-desc" className="text-xs font-medium text-[var(--ink-medium)]">
                            {publishTarget === 'reel' ? 'Caption (for Shorts & Reels)' : 'Description (optional)'}
                          </label>
                          <span className="text-[11px] text-[var(--ink-medium)] tabular-nums">
                            {description.length}/5000
                          </span>
                        </div>
                        <textarea
                          id="yt-video-desc"
                          rows={publishTarget === 'reel' ? 3 : 4}
                          maxLength={5000}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={
                            publishTarget === 'reel'
                              ? 'Write a catchy Shorts / Reels caption...'
                              : 'Tell viewers about your video (timestamps, credits, links)'
                          }
                          className="w-full bg-transparent text-base sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-medium)]/60 focus:outline-none resize-none"
                        />
                      </div>

                      {/* Hashtags Box (Highlighted for Shorts/Reels, supported for Long Videos too) */}
                      <div className="rounded-xl border border-[var(--ink-faint)] focus-within:border-[#FF0000] bg-[var(--surface)] px-3.5 py-2.5 space-y-2 transition-colors">
                        <div className="flex items-center justify-between">
                          <label htmlFor="yt-hashtags" className="text-xs font-medium text-[var(--ink-medium)] flex items-center gap-1.5">
                            <Hash className="h-3.5 w-3.5 text-[#FF0000]" />
                            <span>{publishTarget === 'reel' ? 'Shorts & Reels Hashtags' : 'Hashtags (optional)'}</span>
                          </label>
                          <span className="text-[11px] text-[var(--ink-medium)]">{parsedHashtags.length} added</span>
                        </div>
                        <input
                          id="yt-hashtags"
                          type="text"
                          value={hashtagsInput}
                          onChange={(e) => setHashtagsInput(e.target.value)}
                          placeholder="#shorts #reels #trending #gaming"
                          className="w-full bg-transparent text-base sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-medium)]/60 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {['#shorts', '#reels', '#viral', '#trending', '#gaming', '#music'].map((chip) => {
                            const active = parsedHashtags.includes(chip);
                            return (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => {
                                  if (active) {
                                    setHashtagsInput(
                                      parsedHashtags.filter((h) => h !== chip).join(' ')
                                    );
                                  } else {
                                    setHashtagsInput([...parsedHashtags, chip].join(' '));
                                  }
                                }}
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#FF0000]/15 text-[#FF0000] border border-[#FF0000]/40'
                                    : 'bg-[var(--card-hover)] text-[var(--ink-medium)] hover:text-[var(--ink)]'
                                }`}
                              >
                                {chip}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Thumbnail Picker + Frame Snapshot */}
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--ink)]">Thumbnail</h4>
                            <p className="text-xs text-[var(--ink-medium)]">
                              Select a frame, snapshot preview, or pick an image from Gallery.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {resolvedVideoUrl && (
                              <button
                                type="button"
                                onClick={handleCapturePreviewFrame}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-faint)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-[var(--ink)] hover:border-[#3EA6FF] hover:text-[#3EA6FF] transition-colors cursor-pointer"
                              >
                                <Aperture className="h-3.5 w-3.5" />
                                <span>Capture Frame</span>
                              </button>
                            )}
                            <span className="text-[11px] text-[var(--ink-medium)]">
                              {thumbGenerationStatus === 'generating'
                                ? 'Generating...'
                                : customThumbnailUrl
                                ? 'Custom cover'
                                : thumbGenerationStatus === 'generated'
                                ? 'Auto-generated'
                                : 'Default cover'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {/* Upload File Tile */}
                          <button
                            type="button"
                            onClick={() => thumbInputRef.current?.click()}
                            disabled={isUploadingThumb}
                            className={`aspect-video flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs transition-colors p-2 cursor-pointer ${
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
                              {isUploadingThumb ? 'Uploading...' : 'Gallery Cover'}
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
                                className={`relative aspect-video overflow-hidden rounded-xl border-2 transition-all bg-black cursor-pointer ${
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

                      {/* Video Filters Bar (Applies to Preview & Published Playback) */}
                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                            <Sliders className="h-3.5 w-3.5 text-[#FF0000]" />
                            {t('upload.filters', 'Video Filters')}
                          </span>
                          <span className="text-[11px] font-medium text-[var(--ink-medium)]">
                            {recordedBakedFilter ? 'Baked in camera clip' : activeFilterPreset.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {VIDEO_FILTER_PRESETS.map((preset) => {
                            const isSel = selectedFilterId === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                disabled={recordedBakedFilter}
                                onClick={() => setSelectedFilterId(preset.id)}
                                className={`flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer disabled:opacity-60 ${
                                  isSel
                                    ? 'border-[#FF0000] bg-[#FF0000]/10 text-[#FF0000]'
                                    : 'border-[var(--ink-faint)] bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--card-hover)]'
                                }`}
                              >
                                <span className={`h-3 w-3 rounded-full bg-gradient-to-tr ${preset.swatch}`} />
                                <span>{preset.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Category (incl. Gaming), Video Language & Channel */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="yt-category" className="block text-xs font-medium text-[var(--ink-medium)] mb-1.5">
                            Category (Gaming, Music...)
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
                          <label htmlFor="yt-language" className="block text-xs font-medium text-[var(--ink-medium)] mb-1.5 flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span>{t('upload.language', 'Video Language')}</span>
                          </label>
                          <select
                            id="yt-language"
                            value={videoLanguage}
                            onChange={(e) => setVideoLanguage(e.target.value)}
                            className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--ink)] focus:border-[#3EA6FF] focus:outline-none"
                          >
                            {CONTENT_LANGUAGES.map((lang) => (
                              <option key={lang} value={lang}>
                                {lang}
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
                                {ch.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: EDIT, TRIM, CROP, AUDIO & ELEMENTS */}
                  {activeStep === 'elements' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--ink)]">Edit &amp; Studio Elements</h3>
                        <p className="text-xs text-[var(--ink-medium)]">
                          Trim clip duration, crop aspect framing, mute/unmute audio, and manage Shorts/Long settings.
                        </p>
                      </div>

                      {/* Publish Format Cards */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[var(--ink)]">Publish format</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => handleSelectPublishTarget('video')}
                            className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                              publishTarget === 'video'
                                ? 'border-[#3EA6FF] bg-[#3EA6FF]/10'
                                : 'border-[var(--ink-faint)] bg-[var(--surface)] hover:bg-[var(--card-hover)]'
                            }`}
                          >
                            <div className="text-sm font-semibold text-[var(--ink)]">Long Video (16:9)</div>
                            <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                              Appears in Home feed, Watch view &amp; Studio.
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectPublishTarget('reel')}
                            className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                              publishTarget === 'reel'
                                ? 'border-[#FF0000] bg-[#FF0000]/10'
                                : 'border-[var(--ink-faint)] bg-[var(--surface)] hover:bg-[var(--card-hover)]'
                            }`}
                          >
                            <div className="text-sm font-semibold text-[var(--ink)]">Short / Reel (9:16 · Max 3 min)</div>
                            <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                              Appears in the vertical Reels feed &amp; Home Shorts shelf.
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* BASIC TRIMMING CONTROLS */}
                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                            <Scissors className="h-4 w-4 text-[#FF0000]" />
                            <span>Trim Clip</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-md ${
                                exceedsShortsMax
                                  ? 'bg-rose-500/15 text-rose-500'
                                  : 'bg-[var(--card-hover)] text-[var(--ink)]'
                              }`}
                            >
                              {formatTime(trimmedDuration)} {publishTarget === 'reel' ? '/ 3:00 max' : ''}
                            </span>
                            {(trimStart > 0 || trimEnd < videoDuration) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTrimStart(0);
                                  setTrimEnd(
                                    publishTarget === 'reel'
                                      ? Math.min(videoDuration, MAX_SHORTS_DURATION_SECONDS)
                                      : videoDuration
                                  );
                                }}
                                className="text-[11px] font-semibold text-[#3EA6FF] hover:underline cursor-pointer"
                              >
                                Reset trim
                              </button>
                            )}
                          </div>
                        </div>

                        {exceedsShortsMax && (
                          <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-400 flex items-center justify-between gap-2">
                            <span>Shorts &amp; Reels limit is 3 minutes (180s). Trim below 3:00 or switch to Long Video.</span>
                            <button
                              type="button"
                              onClick={() => setTrimEnd(Math.min(videoDuration, trimStart + MAX_SHORTS_DURATION_SECONDS))}
                              className="shrink-0 rounded-full bg-[#FF0000] text-white px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                            >
                              Auto-trim 3:00
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[var(--ink-medium)]">
                              <span>Start: <strong className="text-[var(--ink)] tabular-nums">{formatTime(trimStart)}</strong></span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setTrimStart(Math.max(0, trimStart - 1))}
                                  className="px-2 py-0.5 rounded bg-[var(--card-hover)] hover:text-[var(--ink)] cursor-pointer"
                                >
                                  -1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTrimStart(Math.min(trimEnd - 1, trimStart + 1))}
                                  className="px-2 py-0.5 rounded bg-[var(--card-hover)] hover:text-[var(--ink)] cursor-pointer"
                                >
                                  +1s
                                </button>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(1, Math.floor(videoDuration - 1))}
                              step={0.5}
                              value={trimStart}
                              onChange={(e) => {
                                const nextStart = Math.min(parseFloat(e.target.value), trimEnd - 1);
                                setTrimStart(Math.max(0, nextStart));
                                if (previewVideoRef.current) {
                                  previewVideoRef.current.currentTime = Math.max(0, nextStart);
                                }
                              }}
                              className="w-full accent-[#3EA6FF] cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[var(--ink-medium)]">
                              <span>End: <strong className="text-[var(--ink)] tabular-nums">{formatTime(trimEnd)}</strong></span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setTrimEnd(Math.max(trimStart + 1, trimEnd - 1))}
                                  className="px-2 py-0.5 rounded bg-[var(--card-hover)] hover:text-[var(--ink)] cursor-pointer"
                                >
                                  -1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTrimEnd(Math.min(videoDuration, trimEnd + 1))}
                                  className="px-2 py-0.5 rounded bg-[var(--card-hover)] hover:text-[var(--ink)] cursor-pointer"
                                >
                                  +1s
                                </button>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={Math.max(1, Math.ceil(videoDuration))}
                              step={0.5}
                              value={trimEnd}
                              onChange={(e) => {
                                const nextEnd = Math.max(trimStart + 1, parseFloat(e.target.value));
                                setTrimEnd(Math.min(videoDuration, nextEnd));
                              }}
                              className="w-full accent-[#FF0000] cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* CROPPING / ASPECT RATIO & AUDIO MUTE */}
                      <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] p-4 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                            <Crop className="h-4 w-4 text-[#3EA6FF]" />
                            <span>Crop &amp; Aspect Framing</span>
                          </div>
                          <div className="flex items-center rounded-lg bg-[var(--card-hover)] p-0.5 text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={() => setCropFit('contain')}
                              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                                cropFit === 'contain' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--ink-medium)]'
                              }`}
                            >
                              Fit (Full Frame)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCropFit('cover')}
                              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                                cropFit === 'cover' ? 'bg-[#FF0000] text-white' : 'text-[var(--ink-medium)]'
                              }`}
                            >
                              Fill / Crop
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(['original', '16:9', '9:16', '1:1', '4:5'] as const).map((ratio) => (
                            <button
                              key={ratio}
                              type="button"
                              onClick={() => setCropAspect(ratio)}
                              className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                                cropAspect === ratio
                                  ? 'border-[#3EA6FF] bg-[#3EA6FF]/15 text-[#3EA6FF]'
                                  : 'border-[var(--ink-faint)] bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--card-hover)]'
                              }`}
                            >
                              {ratio === 'original' ? 'Original' : ratio}
                            </button>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-[var(--ink-faint)] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            {isMutedAudio ? (
                              <VolumeX className="h-4 w-4 text-rose-500 shrink-0" />
                            ) : (
                              <Volume2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-semibold text-[var(--ink)]">Mute video audio track</div>
                              <div className="text-[11px] text-[var(--ink-medium)]">
                                {isMutedAudio ? 'Audio muted in preview & published playback' : 'Original audio enabled'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isMutedAudio}
                            onClick={() => setIsMutedAudio((m) => !m)}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
                              isMutedAudio ? 'bg-[#FF0000]' : 'bg-[var(--ink-faint)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                                isMutedAudio ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                              }`}
                            />
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
                            <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                            <div>
                              <div className="text-xs font-semibold">{t('upload.monetization', 'Enable Monetization')}</div>
                              <div className="text-[11px] text-[var(--ink-medium)]">Earn 30% creator ad & Super Thanks revenue split</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={monetizationEnabled}
                            onClick={() => setMonetizationEnabled(!monetizationEnabled)}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
                              monetizationEnabled ? 'bg-emerald-500' : 'bg-[var(--ink-faint)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                                monetizationEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

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
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
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
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
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
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
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
                            <div className="text-sm font-semibold text-[var(--ink)]">Video &amp; Format Quality</div>
                            <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                              Resolution {videoResolution} · Trimmed Duration {formatTime(trimmedDuration)} · Size {file ? formatFileSize(file.size) : totalBytes}
                            </div>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        </div>

                        {publishTarget === 'reel' && (
                          <div className="p-4 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--ink)]">Shorts / Reels 3-Minute Check</div>
                              <div className="text-xs text-[var(--ink-medium)] mt-0.5">
                                {exceedsShortsMax
                                  ? `Duration (${formatTime(trimmedDuration)}) exceeds 3:00 limit. Trim in Edit & Filters.`
                                  : `Duration (${formatTime(trimmedDuration)}) is valid for Shorts & Reels vertical feed.`}
                              </div>
                            </div>
                            {exceedsShortsMax ? (
                              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                            )}
                          </div>
                        )}

                        <div className="p-4 space-y-2">
                          <div className="text-sm font-semibold text-[var(--ink)]">Applied Edits Summary</div>
                          <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-medium">
                            <span className="rounded-md bg-[var(--card-hover)] px-2.5 py-1 text-[var(--ink)]">
                              Filter: {activeFilterPreset.label}
                            </span>
                            <span className="rounded-md bg-[var(--card-hover)] px-2.5 py-1 text-[var(--ink)]">
                              Crop: {cropAspect} ({cropFit})
                            </span>
                            <span className="rounded-md bg-[var(--card-hover)] px-2.5 py-1 text-[var(--ink)]">
                              Audio: {isMutedAudio ? 'Muted' : 'Original'}
                            </span>
                            <span className="rounded-md bg-[var(--card-hover)] px-2.5 py-1 text-[var(--ink)]">
                              Trim: {formatTime(trimStart)} – {formatTime(trimEnd)}
                            </span>
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

                {/* RIGHT COLUMN: STICKY VIDEO / 9:16 REELS PREVIEW CARD */}
                <div className="lg:col-span-5 lg:sticky lg:top-0 order-first lg:order-last">
                  <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] overflow-hidden">
                    {/* Live Playable Preview (Supports 9:16 Vertical Shorts/Reels & Long Video Aspect Crop) */}
                    <div className="relative bg-black flex items-center justify-center p-2">
                      <div
                        className={`relative overflow-hidden bg-black rounded-lg transition-all duration-200 ${
                          cropAspect === '9:16' || (cropAspect === 'original' && publishTarget === 'reel')
                            ? 'w-[190px] sm:w-[220px] aspect-[9/16]'
                            : cropAspect === '1:1'
                            ? 'w-[240px] aspect-square'
                            : cropAspect === '4:5'
                            ? 'w-[220px] aspect-[4/5]'
                            : 'w-full aspect-video'
                        }`}
                      >
                        {resolvedVideoUrl ? (
                          <video
                            ref={previewVideoRef}
                            key={resolvedVideoUrl}
                            src={resolvedVideoUrl}
                            poster={activePoster}
                            controls
                            playsInline
                            muted={isMutedAudio || previewMuted}
                            onTimeUpdate={(e) => {
                              const v = e.currentTarget;
                              if (trimEnd > 0 && v.currentTime >= trimEnd) {
                                v.currentTime = trimStart;
                                v.pause();
                              }
                            }}
                            style={{
                              filter: !recordedBakedFilter && activeFilterPreset.css !== 'none' ? activeFilterPreset.css : undefined,
                            }}
                            className={`h-full w-full transition-all duration-200 ${
                              cropFit === 'cover' ? 'object-cover' : 'object-contain'
                            }`}
                          />
                        ) : (
                          <img
                            src={activePoster}
                            alt="Video preview"
                            className={`h-full w-full ${cropFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                          />
                        )}

                        {/* Preview Audio Toggle Badge */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isMutedAudio) {
                              setIsMutedAudio(false);
                              setPreviewMuted(false);
                            } else {
                              setPreviewMuted((m) => !m);
                            }
                          }}
                          title={isMutedAudio || previewMuted ? 'Unmute preview audio' : 'Mute preview audio'}
                          className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-semibold text-white border border-white/15 backdrop-blur-md cursor-pointer"
                        >
                          {isMutedAudio || previewMuted ? (
                            <VolumeX className="h-3 w-3 text-rose-400" />
                          ) : (
                            <Volume2 className="h-3 w-3 text-emerald-400" />
                          )}
                          <span>{isMutedAudio ? 'Muted' : previewMuted ? 'Preview muted' : 'Audio on'}</span>
                        </button>

                        {/* 9:16 Shorts / Reels Overlay Preview */}
                        {publishTarget === 'reel' && (
                          <div className="pointer-events-none absolute bottom-10 inset-x-2.5 z-10 text-left">
                            <p className="text-[11px] font-bold text-white drop-shadow line-clamp-1">
                              {title.trim() || 'Short / Reel Preview'}
                            </p>
                            {parsedHashtags.length > 0 && (
                              <p className="text-[10px] text-sky-300 font-medium truncate">
                                {parsedHashtags.slice(0, 4).join(' ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preview Card Metadata */}
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
                          className="p-2 rounded-full hover:bg-[var(--card-hover)] text-[var(--ink-medium)] hover:text-[var(--ink)] shrink-0 transition-colors cursor-pointer"
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
                          <div className="text-[11px] text-[var(--ink-medium)]">Video quality &amp; trim</div>
                          <div className="text-xs font-medium text-[var(--ink)] mt-0.5 tabular-nums">
                            {videoResolution} · {formatTime(trimmedDuration)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-[var(--card-hover)] px-1.5 py-0.5 text-[10px] font-bold">
                            {publishTarget === 'reel' ? '9:16' : 'HD'}
                          </span>
                          <span className="rounded bg-[var(--card-hover)] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            {cropFit}
                          </span>
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
                      : uploadPhase === 'failed'
                      ? 'bg-rose-500'
                      : uploadPhase === 'paused'
                      ? 'bg-amber-500'
                      : uploadPhase === 'validating' ||
                        uploadPhase === 'uploading' ||
                        uploadPhase === 'verifying' ||
                        uploadPhase === 'processing'
                      ? 'bg-[#FF0000]'
                      : 'bg-[#3EA6FF]'
                  }`}
                  style={{
                    width: `${
                      uploadPhase === 'validating' ||
                      uploadPhase === 'uploading' ||
                      uploadPhase === 'paused' ||
                      uploadPhase === 'verifying' ||
                      uploadPhase === 'processing' ||
                      uploadPhase === 'completed'
                        ? uploadProgress
                        : uploadPhase === 'failed'
                        ? Math.max(uploadProgress, 20)
                        : ((currentStepIndex + 1) / STEPS.length) * 100
                    }%`,
                  }}
                />
              </div>

              <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left Live Upload / Processing Status */}
                <div className="flex items-center gap-2.5 text-xs text-[var(--ink-medium)] min-w-0">
                  {uploadPhase === 'validating' ||
                  uploadPhase === 'uploading' ||
                  uploadPhase === 'verifying' ||
                  uploadPhase === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#FF0000] shrink-0" />
                  ) : uploadPhase === 'paused' ? (
                    <Pause className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : uploadPhase === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : uploadPhase === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#3EA6FF] shrink-0" />
                  )}

                  <span className="truncate font-medium text-[var(--ink)]">
                    {uploadPhase === 'validating' && 'Validating permissions & file format...'}
                    {uploadPhase === 'uploading' &&
                      `Uploading ${uploadProgress}% (${uploadedBytes} / ${totalBytes}) · ${uploadSpeed}${
                        etaSeconds > 0 ? ` · ${etaSeconds}s left` : ''
                      }`}
                    {uploadPhase === 'paused' &&
                      `Paused at ${uploadProgress}% (${uploadedBytes} / ${totalBytes}) · Ready to resume`}
                    {uploadPhase === 'verifying' && `Verifying object & uploading thumbnail (${uploadProgress}%)...`}
                    {uploadPhase === 'processing' && `Saving & starting Cloud Transcoder (${uploadProgress}%)...`}
                    {uploadPhase === 'completed' && `${uploadSpeed || 'Upload complete · Saved to Vio streaming'}`}
                    {uploadPhase === 'failed' && 'Upload interrupted · Click Retry Upload to resume'}
                    {(uploadPhase === 'staged' || uploadPhase === 'idle') &&
                      `${uploadSpeed} · ${file ? formatFileSize(file.size) : totalBytes}`}
                  </span>
                </div>

                {/* Right Stepper & Publish / Pause / Resume / Retry Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  {isPublishing && uploadPhase === 'uploading' && (
                    <button
                      type="button"
                      onClick={handlePauseUpload}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-3.5 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pause</span>
                    </button>
                  )}

                  {(isPublishing || uploadPhase === 'paused') && resumableControllerRef.current && (
                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 px-3.5 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {uploadPhase === 'paused' && !isPublishing && currentUser && auth.currentUser?.uid && (
                    <button
                      type="button"
                      onClick={() => handlePublish()}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 px-4 py-1.5 text-xs font-bold text-black shadow-sm cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Resume Upload</span>
                    </button>
                  )}

                  {uploadPhase === 'failed' && !isPublishing && currentUser && auth.currentUser?.uid && (
                    <button
                      type="button"
                      onClick={() => handlePublish()}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[#FF0000] hover:bg-[#CC0000] px-4 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retry Upload</span>
                    </button>
                  )}

                  {currentStepIndex > 0 && (
                    <button
                      type="button"
                      disabled={isPublishing}
                      onClick={handlePrevStep}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors disabled:opacity-40 cursor-pointer"
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
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-faint)] px-4 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <Zap className="h-3.5 w-3.5 text-[#FF0000]" />
                        <span>
                          {!currentUser
                            ? signingInGoogle
                              ? 'Signing in...'
                              : 'Sign in & Publish'
                            : publishTarget === 'reel'
                            ? 'Publish Short'
                            : 'Quick Publish'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isPublishing}
                        onClick={handleNextStep}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] text-[var(--bg)] px-5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
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
                      className={`min-h-[40px] inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-xs font-semibold text-white transition-all cursor-pointer ${
                        isPublishing || signingInGoogle
                          ? 'bg-[var(--ink-faint)] text-[var(--ink-medium)] cursor-not-allowed'
                          : 'bg-[#FF0000] hover:bg-[#CC0000] active:scale-95'
                      }`}
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>
                            {uploadPhase === 'validating'
                              ? 'Validating...'
                              : uploadPhase === 'verifying'
                              ? 'Verifying...'
                              : uploadPhase === 'processing'
                              ? 'Processing...'
                              : `Uploading (${uploadProgress}%)`}
                          </span>
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
                            ? 'Publish Short'
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
