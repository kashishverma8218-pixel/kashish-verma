import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  RotateCcw,
  RotateCw,
  Camera,
  Sliders,
  Bookmark as BookmarkIcon,
  Check,
  Info,
  Tv,
  ListPlus,
  Loader2,
  AlertCircle,
  Share2,
  Copy,
  Eye,
  EyeOff,
  Captions,
  Upload,
  FileText,
  Plus,
  Trash2,
  X,
  Signal,
  Wifi,
  Globe2,
  Server,
  ListOrdered,
  ChevronRight,
  Settings,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { VideoItem, Bookmark, VideoFilters, AspectRatioMode, VideoStreamQuality, VideoChapter } from '../types/video';
import { formatTime } from '../utils/formatTime';
import { useVideoKeyboardShortcuts } from '../utils/useVideoKeyboardShortcuts';
import {
  parseSubtitleFile,
  getPresetSubtitleTracks,
  SubtitleCue,
  SubtitleTrack,
} from '../utils/subtitleParser';
import {
  buildStreamLadder,
  calculateAdaptiveBitrate,
  CDN_STREAM_MIRRORS,
  DEFAULT_PLAYABLE_VIDEO_URL,
  sanitizePlayableVideoUrl,
} from '../services/streamingService';
import { CloudInfrastructureModal } from './CloudInfrastructureModal';
import { ChapterOverlay } from './ChapterOverlay';
import {
  parseChaptersFromDescription,
  getCurrentChapter,
  getNextChapter,
  getPrevChapter,
} from '../utils/chapterParser';

interface VideoPlayerProps {
  video: VideoItem;
  bookmarks: Bookmark[];
  onAddBookmark: (time: number, thumbnailUrl?: string) => void;
  onOpenFilters: () => void;
  onOpenInfo: () => void;
  filters: VideoFilters;
  aspectRatio: AspectRatioMode;
  setAspectRatio: (mode: AspectRatioMode) => void;
  onNextVideo?: () => void;
  onPrevVideo?: () => void;
  hasNextVideo?: boolean;
  hasPrevVideo?: boolean;
  externalSeekTime?: number | null;
  onExternalSeekConsumed?: () => void;
  onTimeUpdate?: (time: number) => void;
  ambientMode?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  bookmarks,
  onAddBookmark,
  onOpenFilters,
  onOpenInfo,
  filters,
  aspectRatio,
  setAspectRatio,
  onNextVideo,
  onPrevVideo,
  hasNextVideo,
  hasPrevVideo,
  externalSeekTime,
  onExternalSeekConsumed,
  onTimeUpdate,
  ambientMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  // Core Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(video.duration || 0);
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [showTimeRemaining, setShowTimeRemaining] = useState<boolean>(false);

  // UI Interactivity State: Never auto-hide controls permanently on mobile
  const [isCleanMode, setIsCleanMode] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);
  const [aspectMenuOpen, setAspectMenuOpen] = useState<boolean>(false);
  const [volumeSliderOpen, setVolumeSliderOpen] = useState<boolean>(false);
  const [naturalVideoHeight, setNaturalVideoHeight] = useState<number>(0);
  const lastTouchTimeRef = useRef<number>(0);
  const tapTimerRef = useRef<number | null>(null);
  const lastTapSpotRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'play' | 'pause' | 'seek-forward' | 'seek-backward' | 'snapshot' | 'bookmark';
    timestamp: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshotToast, setSnapshotToast] = useState<{
    dataUrl: string;
    time: number;
  } | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [enableCors, setEnableCors] = useState<boolean>(false);
  const FALLBACK_VIDEO_SRC = DEFAULT_PLAYABLE_VIDEO_URL;
  const resolvedVideoUrl = useMemo(
    () => sanitizePlayableVideoUrl(video.url, video.id, 'video', false),
    [video.url, video.id]
  );
  const [currentSrc, setCurrentSrc] = useState<string>(resolvedVideoUrl);
  // Adaptive Bitrate (ABR) & Cloud Streaming State
  const [selectedQuality, setSelectedQuality] = useState<string>(() => {
    return localStorage.getItem('vio_pref_quality') || 'Auto';
  });
  const [effectiveQualityLabel, setEffectiveQualityLabel] = useState<string>('720p HD');
  const [qualityMenuOpen, setQualityMenuOpen] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [reconnectToast, setReconnectToast] = useState<string | null>(null);
  const [showInfraModal, setShowInfraModal] = useState<boolean>(false);
  const [showTelemetry, setShowTelemetry] = useState<boolean>(false);
  const [bufferHealthSec, setBufferHealthSec] = useState<number>(0);
  const [failoverIndex, setFailoverIndex] = useState<number>(0);

  // Only list qualities genuinely supported by the video metadata / explicit streamQualities
  const streamLadder: VideoStreamQuality[] = useMemo(() => {
    if (video.streamQualities && video.streamQualities.length > 0) {
      return video.streamQualities;
    }
    const baseLadder = buildStreamLadder(video.id, currentSrc || resolvedVideoUrl || FALLBACK_VIDEO_SRC);
    if (naturalVideoHeight > 0) {
      const supported = baseLadder.filter((tier) => {
        const parts = tier.resolution.split('x');
        const h = parseInt(parts[1] || '0', 10);
        return h > 0 && h <= naturalVideoHeight;
      });
      if (supported.length > 0) {
        return supported;
      }
      return [
        {
          label: `${naturalVideoHeight}p`,
          resolution: `${Math.round((naturalVideoHeight * 16) / 9)}x${naturalVideoHeight}`,
          bitrateKbps: naturalVideoHeight >= 720 ? 3000 : 1200,
          fps: 30,
          url: currentSrc || resolvedVideoUrl || FALLBACK_VIDEO_SRC,
          isMaster: true,
        },
      ];
    }
    return baseLadder;
  }, [video.streamQualities, video.id, resolvedVideoUrl, currentSrc, naturalVideoHeight, FALLBACK_VIDEO_SRC]);

  // Subtitles / Closed Captions State
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(() => {
    return localStorage.getItem('vio_streaming_subtitles_enabled') === 'true';
  });
  const [availableTracks, setAvailableTracks] = useState<SubtitleTrack[]>(() => {
    return getPresetSubtitleTracks(video.id);
  });
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(() => {
    const saved = localStorage.getItem('vio_streaming_subtitle_track');
    const presets = getPresetSubtitleTracks(video.id);
    if (saved && presets.some((t) => t.id === saved)) return saved;
    return presets[0]?.id || null;
  });
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0); // in seconds
  const [subtitleFontSize, setSubtitleFontSize] = useState<'sm' | 'base' | 'lg'>(() => {
    return (localStorage.getItem('vio_streaming_subtitle_size') as 'sm' | 'base' | 'lg') || 'base';
  });
  const [subtitleColor, setSubtitleColor] = useState<'white' | 'yellow' | 'cyan'>(() => {
    return (localStorage.getItem('vio_streaming_subtitle_color') as 'white' | 'yellow' | 'cyan') || 'white';
  });
  const [subtitleBg, setSubtitleBg] = useState<'black-80' | 'black-solid' | 'transparent'>(() => {
    return (localStorage.getItem('vio_streaming_subtitle_bg') as 'black-80' | 'black-solid' | 'transparent') || 'black-80';
  });
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState<boolean>(false);
  const [subtitleToast, setSubtitleToast] = useState<string | null>(null);
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);
  const [pastedUrlOrText, setPastedUrlOrText] = useState<string>('');
  const [isParsingUrl, setIsParsingUrl] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video Chapters State & Navigation
  const [chaptersOverlayOpen, setChaptersOverlayOpen] = useState<boolean>(false);

  const chapters: VideoChapter[] = useMemo(() => {
    if (video.chapters && video.chapters.length > 0) {
      return video.chapters;
    }
    return parseChaptersFromDescription(video.description || '', duration);
  }, [video.description, video.chapters, duration]);

  const activeChapter = useMemo(() => {
    return getCurrentChapter(chapters, currentTime);
  }, [chapters, currentTime]);

  const hoverChapter = useMemo(() => {
    return hoverTime !== null ? getCurrentChapter(chapters, hoverTime) : null;
  }, [chapters, hoverTime]);

  const handleSelectChapter = useCallback((chapter: VideoChapter) => {
    if (videoRef.current) {
      videoRef.current.currentTime = chapter.startTime;
      setCurrentTime(chapter.startTime);
      if (!isPlaying) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
    setActionFeedback({
      type: 'seek-forward',
      timestamp: Date.now(),
    });
    setSubtitleToast(`Chapter: ${chapter.title}`);
    setTimeout(() => {
      setSubtitleToast((curr) => (curr?.startsWith('Chapter:') ? null : curr));
    }, 2500);
  }, [isPlaying]);

  const handleNextChapter = useCallback(() => {
    const next = getNextChapter(chapters, currentTime);
    if (next) {
      handleSelectChapter(next);
    }
  }, [chapters, currentTime, handleSelectChapter]);

  const handlePrevChapter = useCallback(() => {
    const prev = getPrevChapter(chapters, currentTime);
    if (prev) {
      handleSelectChapter(prev);
    }
  }, [chapters, currentTime, handleSelectChapter]);

  // Handle external seek requests (e.g. deep-link ?t=, chapter clicks, or bookmark jumps)
  useEffect(() => {
    if (typeof externalSeekTime === 'number' && videoRef.current) {
      if (videoRef.current.readyState >= 1) {
        videoRef.current.currentTime = externalSeekTime;
        setCurrentTime(externalSeekTime);
        onTimeUpdate?.(externalSeekTime);
        if (!isPlaying) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
        onExternalSeekConsumed?.();
      } else {
        pendingSeekRef.current = externalSeekTime;
      }
    }
  }, [externalSeekTime, onExternalSeekConsumed, isPlaying, onTimeUpdate]);

  // Sync subtitle tracks when video changes
  useEffect(() => {
    const presets = getPresetSubtitleTracks(video.id);
    setAvailableTracks((prev) => {
      const customTracks = prev.filter((t) => t.isCustom);
      return [...customTracks, ...presets];
    });

    setSelectedTrackId((prev) => {
      if (prev && prev.startsWith('custom-')) return prev;
      return presets[0]?.id || null;
    });
    setActiveCue(null);
    setSubtitleOffset(0);
  }, [video.id]);

  // Real-time active cue matcher synchronized with currentTime + offset
  useEffect(() => {
    if (!subtitlesEnabled || !selectedTrackId) {
      setActiveCue(null);
      return;
    }

    const currentTrack = availableTracks.find((t) => t.id === selectedTrackId);
    if (!currentTrack || !currentTrack.cues || currentTrack.cues.length === 0) {
      setActiveCue(null);
      return;
    }

    const adjustedTime = currentTime + subtitleOffset;
    const matching = currentTrack.cues.find(
      (cue) => adjustedTime >= cue.startTime && adjustedTime <= cue.endTime
    );

    setActiveCue(matching || null);
  }, [currentTime, subtitlesEnabled, selectedTrackId, availableTracks, subtitleOffset]);

  const showSubToast = (msg: string) => {
    setSubtitleToast(msg);
    setTimeout(() => {
      setSubtitleToast((curr) => (curr === msg ? null : curr));
    }, 2500);
  };

  // Toggle Subtitles ON/OFF
  const toggleSubtitles = useCallback(() => {
    setSubtitlesEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('vio_streaming_subtitles_enabled', String(next));
      if (next) {
        const track = availableTracks.find((t) => t.id === selectedTrackId) || availableTracks[0];
        if (track && !selectedTrackId) setSelectedTrackId(track.id);
        showSubToast(`Subtitles: ${track ? track.label : 'On'}`);
      } else {
        showSubToast('Subtitles: Off');
      }
      return next;
    });
  }, [availableTracks, selectedTrackId]);

  // Select a specific track (or 'off')
  const handleSelectTrack = (trackId: string | null) => {
    if (!trackId) {
      setSubtitlesEnabled(false);
      localStorage.setItem('vio_streaming_subtitles_enabled', 'false');
      showSubToast('Subtitles: Off');
    } else {
      setSelectedTrackId(trackId);
      setSubtitlesEnabled(true);
      localStorage.setItem('vio_streaming_subtitles_enabled', 'true');
      localStorage.setItem('vio_streaming_subtitle_track', trackId);
      const track = availableTracks.find((t) => t.id === trackId);
      showSubToast(`Subtitles: ${track?.label || 'Selected'}`);
    }
    setSubtitleMenuOpen(false);
  };

  // Ensure selected quality stays valid if supported streamLadder shrinks for lower-res videos
  useEffect(() => {
    if (selectedQuality !== 'Auto' && streamLadder.length > 0) {
      const stillSupported = streamLadder.some((t) => t.label === selectedQuality);
      if (!stillSupported) {
        setSelectedQuality('Auto');
        setEffectiveQualityLabel(streamLadder[0].label);
      }
    } else if (streamLadder.length > 0 && !streamLadder.some((t) => t.label === effectiveQualityLabel)) {
      setEffectiveQualityLabel(streamLadder[0].label);
    }
  }, [streamLadder, selectedQuality, effectiveQualityLabel]);

  // Buffer health & adaptive bitrate monitor
  useEffect(() => {
    const timer = setInterval(() => {
      if (!videoRef.current || streamLadder.length === 0) return;
      const vid = videoRef.current;
      if (vid.buffered && vid.buffered.length > 0) {
        let maxBuffered = 0;
        for (let i = 0; i < vid.buffered.length; i++) {
          if (vid.buffered.start(i) <= vid.currentTime && vid.currentTime <= vid.buffered.end(i)) {
            maxBuffered = vid.buffered.end(i) - vid.currentTime;
            break;
          }
        }
        setBufferHealthSec(Math.round(maxBuffered * 10) / 10);

        if (selectedQuality === 'Auto') {
          const optimal = calculateAdaptiveBitrate(maxBuffered, effectiveQualityLabel, streamLadder);
          if (optimal && optimal.label !== effectiveQualityLabel) {
            setEffectiveQualityLabel(optimal.label);
          }
        }
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [selectedQuality, effectiveQualityLabel, streamLadder]);

  const handleQualityChange = (qualityLabel: string) => {
    setSelectedQuality(qualityLabel);
    localStorage.setItem('vio_pref_quality', qualityLabel);
    setQualityMenuOpen(false);

    if (qualityLabel === 'Auto') {
      const optimal = calculateAdaptiveBitrate(bufferHealthSec, effectiveQualityLabel, streamLadder);
      const nextLabel = optimal?.label || streamLadder[0]?.label || 'Auto';
      setEffectiveQualityLabel(nextLabel);
      showSubToast(`Adaptive Bitrate: Auto (${nextLabel})`);
    } else {
      const matchedTier = streamLadder.find((t) => t.label === qualityLabel);
      if (matchedTier && matchedTier.url && matchedTier.url !== currentSrc && videoRef.current) {
        const resumeTime = videoRef.current.currentTime || 0;
        const wasPlaying = !videoRef.current.paused;
        setCurrentSrc(matchedTier.url);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = resumeTime;
            if (wasPlaying) videoRef.current.play().catch(() => {});
          }
        }, 50);
      }
      setEffectiveQualityLabel(qualityLabel);
      showSubToast(`Quality set to ${qualityLabel}`);
    }
  };

  const handleStreamError = useCallback(() => {
    if (!videoRef.current) return;
    const timeBeforeError = videoRef.current.currentTime || 0;
    const wasPlaying = isPlaying;

    const rawMirrors = [
      ...(video.backupStreams || []),
      ...(CDN_STREAM_MIRRORS[video.id] || []),
      DEFAULT_PLAYABLE_VIDEO_URL,
      'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    ].map((u) => sanitizePlayableVideoUrl(u, video.id, 'video', true));

    const uniqueMirrors = Array.from(new Set(rawMirrors)).filter(Boolean);
    const candidateMirrors = uniqueMirrors.filter((u) => u !== currentSrc);

    if (failoverIndex >= candidateMirrors.length || candidateMirrors.length === 0) {
      setReconnecting(false);
      setErrorMessage('This video stream could not be loaded. Click below to retry via Edge CDN.');
      return;
    }

    const nextMirror = candidateMirrors[failoverIndex] || DEFAULT_PLAYABLE_VIDEO_URL;
    setFailoverIndex((prev) => prev + 1);
    setReconnecting(true);
    setReconnectToast(`Reconnecting stream via Cloud Edge CDN (${Math.floor(timeBeforeError)}s)...`);

    setTimeout(() => {
      if (videoRef.current) {
        setCurrentSrc(nextMirror);
        videoRef.current.load();
        videoRef.current.currentTime = timeBeforeError;
        if (wasPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
      setReconnecting(false);
      setErrorMessage(null);
      setReconnectToast(`Stream reconnected via Edge CDN (${Math.floor(timeBeforeError)}s)`);
      setTimeout(() => setReconnectToast(null), 3000);
    }, 600);
  }, [failoverIndex, video.backupStreams, video.id, isPlaying, currentSrc]);

  // Upload local .srt or .vtt file
  const handleSubtitleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        const cues = parseSubtitleFile(content, file.name);
        if (cues.length === 0) {
          showSubToast('No valid subtitle cues found in file.');
          return;
        }

        const newTrack: SubtitleTrack = {
          id: `custom-${Date.now()}`,
          label: `${file.name.replace(/\.(srt|vtt)$/i, '')} (Custom)`,
          language: 'custom',
          cues,
          isCustom: true,
          filename: file.name,
        };

        setAvailableTracks((prev) => [newTrack, ...prev.filter((t) => t.filename !== file.name)]);
        setSelectedTrackId(newTrack.id);
        setSubtitlesEnabled(true);
        localStorage.setItem('vio_streaming_subtitles_enabled', 'true');
        showSubToast(`Loaded: ${file.name} (${cues.length} cues)`);
      } catch (err) {
        console.error('Failed to parse subtitle file:', err);
        showSubToast('Could not parse subtitle file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Load from URL or pasted text
  const handleLoadUrlOrText = async () => {
    const input = pastedUrlOrText.trim();
    if (!input) return;

    setIsParsingUrl(true);
    try {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        const res = await fetch(input);
        const text = await res.text();
        const cues = parseSubtitleFile(text, input);
        if (cues.length > 0) {
          const rawName = input.split('/').pop()?.split('?')[0] || 'remote_subtitles.srt';
          const newTrack: SubtitleTrack = {
            id: `custom-${Date.now()}`,
            label: `${rawName.replace(/\.(srt|vtt)$/i, '')} (URL)`,
            language: 'custom',
            cues,
            isCustom: true,
            filename: rawName,
          };
          setAvailableTracks((prev) => [newTrack, ...prev]);
          setSelectedTrackId(newTrack.id);
          setSubtitlesEnabled(true);
          localStorage.setItem('vio_streaming_subtitles_enabled', 'true');
          showSubToast(`Loaded ${cues.length} cues from URL`);
          setShowUrlModal(false);
          setPastedUrlOrText('');
        } else {
          showSubToast('No subtitle cues found at URL.');
        }
      } else {
        const cues = parseSubtitleFile(input, 'pasted.srt');
        if (cues.length > 0) {
          const newTrack: SubtitleTrack = {
            id: `custom-${Date.now()}`,
            label: `Pasted Subtitles (${cues.length} cues)`,
            language: 'custom',
            cues,
            isCustom: true,
          };
          setAvailableTracks((prev) => [newTrack, ...prev]);
          setSelectedTrackId(newTrack.id);
          setSubtitlesEnabled(true);
          localStorage.setItem('vio_streaming_subtitles_enabled', 'true');
          showSubToast(`Loaded ${cues.length} cues`);
          setShowUrlModal(false);
          setPastedUrlOrText('');
        } else {
          showSubToast('Could not parse pasted subtitle text.');
        }
      }
    } catch (err) {
      showSubToast('Network or format error loading subtitle.');
    } finally {
      setIsParsingUrl(false);
    }
  };

  const handleDeleteCustomTrack = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAvailableTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (selectedTrackId === trackId) {
      const fallback = availableTracks.find((t) => t.id !== trackId);
      setSelectedTrackId(fallback ? fallback.id : null);
    }
    showSubToast('Custom subtitle track removed.');
  };

  useEffect(() => {
    setCurrentSrc(resolvedVideoUrl);
    setFailoverIndex(0);
    setNaturalVideoHeight(0);
    setErrorMessage(null);
  }, [video.id, resolvedVideoUrl]);

  const handleCopyVideoLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?v=${video.id}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Filter CSS Generator
  const filterStyle: React.CSSProperties = {
    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px) invert(${filters.invert}%)`,
  };

  // Container Aspect Ratio and Responsive Constraint mapping
  const getContainerAspectClasses = () => {
    if (isFullscreen) {
      return 'w-full h-full max-h-screen';
    }
    switch (aspectRatio) {
      case '16:9':
        return 'w-full aspect-video max-h-[75vh]';
      case '4:3':
        return 'w-full aspect-[4/3] max-h-[75vh]';
      case '21:9':
        return 'w-full aspect-[21/9] max-h-[75vh]';
      case '9:16':
        return 'w-full aspect-[9/16] max-h-[80vh] max-w-sm mx-auto';
      case 'cover':
        return 'w-full aspect-video max-h-[75vh]';
      case 'auto':
      default:
        return 'w-full aspect-video max-h-[75vh]';
    }
  };

  // Video Element Object-Fit mapping
  const getVideoElementClasses = () => {
    if (isFullscreen) {
      return 'w-full h-full max-h-screen object-contain';
    }
    switch (aspectRatio) {
      case 'cover':
        return 'w-full h-full object-cover';
      case '16:9':
      case '4:3':
      case '21:9':
      case '9:16':
      case 'auto':
      default:
        return 'w-full h-full object-contain';
    }
  };

  const getAspectRatioClasses = getVideoElementClasses;

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        triggerFeedback('play');
      }).catch((err) => {
        console.warn('Playback interrupted:', err);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerFeedback('pause');
    }
  }, []);

  // Visual feedback helper
  const triggerFeedback = (type: 'play' | 'pause' | 'seek-forward' | 'seek-backward' | 'snapshot' | 'bookmark') => {
    setActionFeedback({ type, timestamp: Date.now() });
    setTimeout(() => {
      setActionFeedback((curr) => (curr?.type === type ? null : curr));
    }, 600);
  };

  // Autohide controls logic (3 seconds)
  const scheduleAutoHide = useCallback((playingOverride?: boolean) => {
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    const playingNow = playingOverride ?? isPlaying;
    if (playingNow && !speedMenuOpen && !aspectMenuOpen && !qualityMenuOpen && !subtitleMenuOpen && !volumeSliderOpen && !isSeeking) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
        setVolumeSliderOpen(false);
      }, 3000);
    }
  }, [isPlaying, speedMenuOpen, aspectMenuOpen, qualityMenuOpen, subtitleMenuOpen, volumeSliderOpen, isSeeking]);

  const handleUserActivity = useCallback(() => {
    if (isCleanMode) return;
    setShowControls(true);
    scheduleAutoHide();
  }, [isCleanMode, scheduleAutoHide]);

  // Trigger 3-second auto-hide automatically when playback starts
  useEffect(() => {
    if (isPlaying && showControls) {
      scheduleAutoHide(true);
    } else if (!isPlaying && hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    return () => {
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [isPlaying, showControls, scheduleAutoHide]);

  // Volume handler
  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
    handleUserActivity();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        handleVolumeChange(0.7);
      }
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
    handleUserActivity();
  };

  // Seek relative
  const seekRelative = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    triggerFeedback(seconds > 0 ? 'seek-forward' : 'seek-backward');
    handleUserActivity();
  }, [handleUserActivity]);

  // Playback Rate
  const changeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setSpeedMenuOpen(false);
    handleUserActivity();
  };

  // Fullscreen (with Safari/iOS & mobile orientation support)
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    const el = containerRef.current as any;
    const vidEl = videoRef.current as any;
    const doc = document as any;

    try {
      const activeFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (!activeFullscreen) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (vidEl?.webkitEnterFullscreen) {
          vidEl.webkitEnterFullscreen();
        }
        setIsFullscreen(true);
        try {
          await (screen.orientation as any)?.lock?.('landscape');
        } catch {
          // Orientation lock unsupported in desktop or certain browsers
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
        try {
          (screen.orientation as any)?.unlock?.();
        } catch {
          // ignore
        }
      }
    } catch (err) {
      if (vidEl?.webkitEnterFullscreen) {
        try {
          vidEl.webkitEnterFullscreen();
          setIsFullscreen(true);
        } catch {
          console.error('Fullscreen request failed:', err);
        }
      } else {
        console.error('Fullscreen request failed:', err);
      }
    }
    handleUserActivity();
  }, [handleUserActivity]);

  // Picture in Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoRef.current !== document.pictureInPictureElement) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP not supported or failed:', err);
    }
  };

  // Capture High-Res Snapshot Frame
  const takeSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    if (vid.readyState < 2) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 1280;
      canvas.height = vid.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Apply video filters to context if supported
      ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) invert(${filters.invert}%)`;
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');
      setSnapshotToast({ dataUrl, time: vid.currentTime });
      triggerFeedback('snapshot');

      // Auto dismiss snapshot toast after 6s
      setTimeout(() => {
        setSnapshotToast(null);
      }, 6000);
    } catch (e) {
      console.error('Snapshot failed (CORS or canvas tainted):', e);
    }
  }, [filters]);

  // Download snapshot
  const downloadSnapshot = () => {
    if (!snapshotToast) return;
    const link = document.createElement('a');
    const safeTitle = video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}_frame_${Math.floor(snapshotToast.time)}s.png`;
    link.href = snapshotToast.dataUrl;
    link.click();
  };

  // Add Bookmark helper with frame thumbnail
  const handleAddBookmarkClick = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    let thumbUrl: string | undefined = undefined;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
      }
    } catch {
      // CORS safe fallback
    }
    onAddBookmark(time, thumbUrl);
    triggerFeedback('bookmark');
  };

  // Scrubbing & Seeking calculation (mouse + touch)
  const calculateSeekFromClientX = (clientX: number) => {
    if (!progressTrackRef.current || !duration) return 0;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return { pos, time: pos * duration };
  };

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsSeeking(true);
    const { pos, time } = calculateSeekFromClientX(e.clientX) || { pos: 0, time: 0 };
    setHoverPosition(pos * 100);
    setHoverTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
    handleUserActivity();
  };

  const handleSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current || !duration) return;
    const { pos, time } = calculateSeekFromClientX(e.clientX) || { pos: 0, time: 0 };
    setHoverPosition(pos * 100);
    setHoverTime(time);

    if (isSeeking && videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleTouchSeekStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    setIsSeeking(true);
    const { pos, time } = calculateSeekFromClientX(touch.clientX) || { pos: 0, time: 0 };
    setHoverPosition(pos * 100);
    setHoverTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
    handleUserActivity();
  };

  const handleTouchSeekMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch || !progressTrackRef.current || !duration) return;
    const { pos, time } = calculateSeekFromClientX(touch.clientX) || { pos: 0, time: 0 };
    setHoverPosition(pos * 100);
    setHoverTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
    setHoverTime(null);
    scheduleAutoHide();
  };

  // Keyboard Shortcuts Listener
  useVideoKeyboardShortcuts({
    togglePlay,
    seekRelative,
    toggleFullscreen,
    toggleMute,
    handleVolumeChange,
    currentVolume: volume,
    takeSnapshot,
    handleAddBookmark: handleAddBookmarkClick,
    toggleSubtitles,
    onNextChapter: handleNextChapter,
    onPrevChapter: handlePrevChapter,
    toggleChapters: () => setChaptersOverlayOpen((prev) => !prev),
    duration,
    onSeekPercent: (pct) => {
      if (videoRef.current && duration) {
        videoRef.current.currentTime = pct * duration;
      }
    },
    enabled: true,
  });

  // Fullscreen change listener (desktop + iOS/webkit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs) {
        try {
          (screen.orientation as any)?.unlock?.();
        } catch {
          // ignore
        }
      }
    };
    const vidEl = videoRef.current;
    const onWebkitEndFs = () => setIsFullscreen(false);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    vidEl?.addEventListener('webkitendfullscreen', onWebkitEndFs);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      vidEl?.removeEventListener('webkitendfullscreen', onWebkitEndFs);
    };
  }, []);

  // Close player menus on outside click/touch
  useEffect(() => {
    if (!speedMenuOpen && !aspectMenuOpen && !qualityMenuOpen && !subtitleMenuOpen && !volumeSliderOpen) {
      return;
    }
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-player-menu]')) {
        setSpeedMenuOpen(false);
        setAspectMenuOpen(false);
        setQualityMenuOpen(false);
        setSubtitleMenuOpen(false);
        setVolumeSliderOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [speedMenuOpen, aspectMenuOpen, qualityMenuOpen, subtitleMenuOpen, volumeSliderOpen]);

  // Reset state on video change
  useEffect(() => {
    setCurrentTime(0);
    setBufferedEnd(0);
    setIsBuffering(false);
    setErrorMessage(null);
    setShowControls(true);
    if (videoRef.current && (video.url || currentSrc)) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.load();
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [video.id, video.url]);

  // Mobile tap (show/hide controls + 3s auto-hide, double-tap left/right 10s seek) & desktop click
  const handleVideoTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    lastTouchTimeRef.current = Date.now();
    const touch = e.changedTouches[0];
    if (!touch || !containerRef.current) return;

    const now = Date.now();
    const rect = containerRef.current.getBoundingClientRect();
    const tapX = touch.clientX - rect.left;

    if (now - lastTapSpotRef.current.time < 280) {
      // Double tap detected
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapSpotRef.current = { time: 0, x: 0 };
      if (tapX < rect.width * 0.35) {
        seekRelative(-10);
      } else if (tapX > rect.width * 0.65) {
        seekRelative(10);
      } else {
        togglePlay();
      }
    } else {
      lastTapSpotRef.current = { time: now, x: tapX };
      tapTimerRef.current = window.setTimeout(() => {
        tapTimerRef.current = null;
        if (isCleanMode) {
          setIsCleanMode(false);
          setShowControls(true);
          scheduleAutoHide();
          return;
        }
        setShowControls((prev) => {
          const next = !prev;
          if (next) {
            scheduleAutoHide();
          } else {
            setQualityMenuOpen(false);
            setSpeedMenuOpen(false);
            setAspectMenuOpen(false);
            setSubtitleMenuOpen(false);
            setVolumeSliderOpen(false);
          }
          return next;
        });
      }, 240);
    }
  };

  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    // Ignore synthesized click shortly after touch event
    if (Date.now() - lastTouchTimeRef.current < 500) {
      return;
    }
    setQualityMenuOpen(false);
    setSpeedMenuOpen(false);
    setAspectMenuOpen(false);
    setSubtitleMenuOpen(false);
    setVolumeSliderOpen(false);
    togglePlay();
    handleUserActivity();
  };

  const handleVideoDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.35) {
      seekRelative(-10);
    } else if (clickX > rect.width * 0.65) {
      seekRelative(10);
    } else {
      toggleFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onMouseEnter={() => {
        setShowControls(true);
        scheduleAutoHide();
      }}
      onMouseLeave={() => {
        if (isPlaying && !speedMenuOpen && !qualityMenuOpen && !subtitleMenuOpen && !aspectMenuOpen) {
          setShowControls(false);
        }
      }}
      onMouseUp={handleSeekEnd}
      className={`group relative select-none overflow-hidden bg-black transition-all ${
        isFullscreen ? 'h-screen w-screen' : 'w-full rounded-xl sm:rounded-2xl shadow-2xl ring-1 ring-black/15 dark:ring-white/10'
      }`}
    >
      {/* Subtle Cinema Ambient Glow when enabled */}
      {ambientMode && video.poster && !isFullscreen && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-4 -z-10 opacity-35 blur-3xl scale-110 transition-opacity duration-700"
          style={{
            backgroundImage: `url(${video.poster})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Video Element */}
      <div
        onClick={handleVideoAreaClick}
        onDoubleClick={handleVideoDoubleClick}
        onTouchEnd={handleVideoTouchEnd}
        className={`relative flex w-full items-center justify-center overflow-hidden cursor-pointer ${getContainerAspectClasses()}`}
      >
        <video
          ref={videoRef}
          src={currentSrc || FALLBACK_VIDEO_SRC}
          poster={video.poster}
          playsInline
          loop={isLooping}
          crossOrigin={enableCors ? 'anonymous' : undefined}
          style={filterStyle}
          className={`transition-all duration-150 ${getVideoElementClasses()}`}
          onTimeUpdate={() => {
            if (videoRef.current && !isSeeking) {
              const t = videoRef.current.currentTime;
              setCurrentTime(t);
              onTimeUpdate?.(t);
            }
          }}
          onProgress={() => {
            if (videoRef.current && videoRef.current.buffered.length > 0) {
              const last = videoRef.current.buffered.length - 1;
              setBufferedEnd(videoRef.current.buffered.end(last));
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setIsMuted(videoRef.current.muted);
              setVolume(videoRef.current.volume);
              if (videoRef.current.videoHeight > 0) {
                setNaturalVideoHeight(videoRef.current.videoHeight);
              }
              if (pendingSeekRef.current !== null) {
                const targetTime = Math.min(pendingSeekRef.current, videoRef.current.duration || pendingSeekRef.current);
                videoRef.current.currentTime = targetTime;
                setCurrentTime(targetTime);
                onTimeUpdate?.(targetTime);
                pendingSeekRef.current = null;
                onExternalSeekConsumed?.();
              }
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            setErrorMessage(null);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (hasNextVideo && onNextVideo) {
              onNextVideo();
            }
          }}
          onError={() => {
            if (enableCors) {
              setEnableCors(false);
              return;
            }
            handleStreamError();
          }}
        />

        {/* Central Activity Indicator / Ripple */}
        {actionFeedback && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white shadow-2xl animate-ping opacity-90 duration-500">
              {actionFeedback.type === 'play' && <Play className="h-10 w-10 fill-white ml-1" />}
              {actionFeedback.type === 'pause' && <Pause className="h-10 w-10 fill-white" />}
              {actionFeedback.type === 'seek-backward' && <RotateCcw className="h-10 w-10" />}
              {actionFeedback.type === 'seek-forward' && <RotateCw className="h-10 w-10" />}
              {actionFeedback.type === 'snapshot' && <Camera className="h-10 w-10 text-sky-400" />}
              {actionFeedback.type === 'bookmark' && <BookmarkIcon className="h-10 w-10 text-amber-400 fill-amber-400" />}
            </div>
          </div>
        )}

        {/* Buffering Spinner */}
        {isBuffering && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
            <Loader2 className="h-12 w-12 animate-spin text-red-500" />
          </div>
        )}

        {/* Active Stream Reconnecting Indicator Pill */}
        {reconnecting && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-amber-300 text-xs font-semibold backdrop-blur-md border border-amber-500/30 shadow-xl animate-in fade-in">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
            <span>Reconnecting stream via Cloud Edge CDN...</span>
          </div>
        )}

        {reconnectToast && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-emerald-300 text-xs font-semibold backdrop-blur-md border border-emerald-500/30 shadow-xl animate-in fade-in">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>{reconnectToast}</span>
          </div>
        )}

        {/* Resilient Error Recovery Overlay */}
        {errorMessage && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center text-white backdrop-blur-sm animate-in fade-in">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 ring-1 ring-amber-500/20">
              <Signal className="h-7 w-7" />
            </div>
            <h4 className="text-base font-bold">Cloud Stream Optimization</h4>
            <p className="mt-1 max-w-md text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleStreamError}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Signal className="h-3.5 w-3.5" />
                <span>Reconnect via CDN Edge</span>
              </button>
            </div>
          </div>
        )}

        {/* Real-time Subtitle / Closed Caption Overlay */}
        {subtitlesEnabled && activeCue && !isCleanMode && (
          <div
            className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4 transition-all duration-150 ${
              showControls ? 'bottom-20 sm:bottom-24' : 'bottom-6 sm:bottom-8'
            }`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[80%] text-center font-medium leading-relaxed select-none transition-all ${
                subtitleColor === 'yellow'
                  ? 'text-yellow-300'
                  : subtitleColor === 'cyan'
                  ? 'text-cyan-300'
                  : 'text-white'
              } ${
                subtitleFontSize === 'sm'
                  ? 'text-xs sm:text-sm px-2.5 py-1'
                  : subtitleFontSize === 'lg'
                  ? 'text-base sm:text-lg md:text-xl font-bold px-4 py-2'
                  : 'text-sm sm:text-base md:text-lg px-3.5 py-1.5'
              } ${
                subtitleBg === 'black-solid'
                  ? 'bg-black rounded-xl shadow-2xl'
                  : subtitleBg === 'transparent'
                  ? 'bg-transparent [text-shadow:_0_2px_4px_rgb(0_0_0_/_95%),_0_0_10px_rgb(0_0_0_/_90%)]'
                  : 'bg-black/80 backdrop-blur-xs rounded-xl shadow-2xl ring-1 ring-white/10'
              }`}
            >
              {activeCue.text.split('\n').map((line, idx) => (
                <span key={idx} className="block">
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hidden File Input for External .srt and .vtt Subtitles */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,text/plain"
          onChange={handleSubtitleFileUpload}
          className="hidden"
        />
      </div>

      {/* Subtitle Toast Feedback */}
      {subtitleToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <Captions className="h-4 w-4 text-sky-400 shrink-0" />
          <span>{subtitleToast}</span>
        </div>
      )}

      {/* Snapshot Toast Preview */}
      {snapshotToast && (
        <div className="absolute top-16 right-4 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/95 p-2.5 shadow-2xl backdrop-blur-md text-white">
          <img
            src={snapshotToast.dataUrl}
            alt="Frame preview"
            className="h-12 w-20 rounded-lg object-cover ring-1 ring-white/20"
          />
          <div className="text-xs">
            <div className="font-semibold text-slate-200">Frame Snapshot Saved</div>
            <div className="text-slate-400">{formatTime(snapshotToast.time)}</div>
          </div>
          <button
            onClick={downloadSnapshot}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500 transition-colors shrink-0"
          >
            Download PNG
          </button>
        </div>
      )}

      {/* YouTube-style Center Transport Controls (Visible when controls are open on mobile & desktop) */}
      {showControls && !isCleanMode && !errorMessage && !isBuffering && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-5 sm:gap-12 [@media(max-height:500px)]:gap-6 animate-in fade-in duration-150">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              seekRelative(-10);
            }}
            aria-label="Rewind 10 seconds"
            title="Rewind 10 seconds"
            className="pointer-events-auto flex h-11 w-11 sm:h-14 sm:w-14 [@media(max-height:500px)]:h-10 [@media(max-height:500px)]:w-10 flex-col items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md ring-1 ring-white/20 hover:bg-black/75 active:scale-90 transition-all shadow-xl"
          >
            <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-[9px] font-mono font-bold leading-none mt-0.5">10s</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
              handleUserActivity();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="pointer-events-auto flex h-14 w-14 sm:h-[72px] sm:w-[72px] [@media(max-height:500px)]:h-12 [@media(max-height:500px)]:w-12 items-center justify-center rounded-full bg-black/65 hover:bg-[#FF0000] text-white backdrop-blur-md ring-2 ring-white/25 active:scale-90 transition-all shadow-2xl"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 sm:h-8 sm:w-8 fill-white" />
            ) : (
              <Play className="h-7 w-7 sm:h-8 sm:w-8 fill-white ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              seekRelative(10);
            }}
            aria-label="Forward 10 seconds"
            title="Forward 10 seconds"
            className="pointer-events-auto flex h-11 w-11 sm:h-14 sm:w-14 [@media(max-height:500px)]:h-10 [@media(max-height:500px)]:w-10 flex-col items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md ring-1 ring-white/20 hover:bg-black/75 active:scale-90 transition-all shadow-xl"
          >
            <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-[9px] font-mono font-bold leading-none mt-0.5">10s</span>
          </button>
        </div>
      )}

      {/* Top Overlay Bar (Compact on mobile, full on desktop) */}
      <div
        className={`flex absolute top-0 inset-x-0 z-30 items-center justify-between px-3 py-2 sm:p-4 [@media(max-height:500px)]:py-1.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls && !isCleanMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
              {video.title}
            </h3>
            {video.author && (
              <p className="text-xs text-slate-300 truncate">{video.author}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Technical Info */}
          <button
            onClick={onOpenInfo}
            title="Video Information"
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>

          {/* Video Color Filters */}
          <button
            onClick={onOpenFilters}
            title="Color Grading & Adjustments"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Sliders className="h-4 w-4" />
          </button>

          {/* Subtitles Quick Launcher */}
          <button
            onClick={() => setSubtitleMenuOpen(!subtitleMenuOpen)}
            title={`Subtitles / Captions (C) - ${subtitlesEnabled ? 'On' : 'Off'}`}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              subtitlesEnabled
                ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Captions className="h-4 w-4" />
          </button>

          {/* Quick Aspect Ratio (Responsive on mobile & desktop) */}
          <div data-player-menu className="relative">
            <button
              onClick={() => {
                setAspectMenuOpen(!aspectMenuOpen);
                setQualityMenuOpen(false);
                setSpeedMenuOpen(false);
                setSubtitleMenuOpen(false);
              }}
              title="Aspect Ratio"
              aria-label="Aspect Ratio"
              className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg bg-white/10 text-xs font-medium text-white hover:bg-white/20 transition-colors"
            >
              <Tv className="h-3.5 w-3.5" />
              <span className="hidden sm:inline uppercase">{aspectRatio}</span>
            </button>

            {aspectMenuOpen && (
              <div className="absolute right-0 top-10 z-40 w-36 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900/95 py-1.5 shadow-2xl backdrop-blur-md text-white text-xs">
                {(['auto', '16:9', '4:3', '21:9', '9:16', 'cover'] as AspectRatioMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setAspectRatio(mode);
                      setAspectMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 hover:bg-white/10 ${
                      aspectRatio === mode ? 'text-[#FF4E45] font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span className="capitalize">{mode}</span>
                    {aspectRatio === mode && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy Video Link Button */}
          <button
            onClick={handleCopyVideoLink}
            title="Copy Video Link"
            className={`hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all ${
              copyToast
                ? 'bg-emerald-600 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {copyToast ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copyToast ? 'Copied!' : 'Copy Link'}</span>
          </button>

          {/* Snapshot Button */}
          <button
            onClick={takeSnapshot}
            title="Capture Current Frame (S)"
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 z-30 px-2.5 sm:px-4 pb-2.5 sm:pb-4 pt-8 sm:pt-10 [@media(max-height:500px)]:pt-4 [@media(max-height:500px)]:pb-1.5 bg-gradient-to-t from-black/95 via-black/65 to-transparent transition-opacity duration-300 ${
          showControls && !isCleanMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Timeline Progress Bar (Mouse + Touch Scrubbing) */}
        <div
          ref={progressTrackRef}
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseLeave={() => setHoverTime(null)}
          onTouchStart={handleTouchSeekStart}
          onTouchMove={handleTouchSeekMove}
          onTouchEnd={handleSeekEnd}
          className="group/seek relative mb-2 sm:mb-3 [@media(max-height:500px)]:mb-1.5 flex h-7 sm:h-6 w-full cursor-pointer items-center touch-none"
        >
          {/* Base Track */}
          <div className="relative h-1.5 w-full rounded-full bg-white/25 transition-all group-hover/seek:h-2.5">
            {/* Buffered Bar */}
            {duration > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/35 transition-all"
                style={{ width: `${Math.min(100, (bufferedEnd / duration) * 100)}%` }}
              />
            )}

            {/* Played Bar */}
            {duration > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#FF0000] shadow-[0_0_10px_rgba(255,0,0,0.65)]"
                style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
              />
            )}

            {/* Bookmark Ticks */}
            {bookmarks
              .filter((b) => b.videoId === video.id)
              .map((bm) => (
                <div
                  key={bm.id}
                  title={`Bookmark: ${bm.label} (${formatTime(bm.time)})`}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm bg-amber-400 ring-1 ring-black/50 z-10"
                  style={{ left: `${(bm.time / (duration || 1)) * 100}%` }}
                />
              ))}

            {/* Chapter Divider Notches */}
            {chapters.length > 1 && duration > 0 && chapters.map((ch) => {
              if (ch.startTime <= 0) return null;
              const pct = (ch.startTime / duration) * 100;
              if (pct >= 99.5) return null;
              return (
                <div
                  key={ch.id}
                  title={`Chapter: ${ch.title} (${ch.timestamp})`}
                  className="absolute top-0 bottom-0 w-0.5 bg-black/60 pointer-events-none z-10"
                  style={{ left: `${pct}%` }}
                />
              );
            })}

            {/* Scrub Thumb (Always visible on mobile/scrubbing so touch users see handle) */}
            {duration > 0 && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 sm:h-3.5 sm:w-3.5 rounded-full bg-[#FF0000] shadow-md ring-2 ring-white/90 transition-transform ${
                  isSeeking ? 'scale-125' : 'scale-100 sm:scale-0 sm:group-hover/seek:scale-100'
                }`}
                style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }}
              />
            )}
          </div>

          {/* Hover / Touch Seek Time Tooltip with Chapter Title */}
          {hoverTime !== null && (
            <div
              className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded-md bg-slate-900/95 px-2.5 py-1 text-[11px] font-mono text-white shadow-xl ring-1 ring-white/15 flex flex-col items-center max-w-[220px]"
              style={{ left: `${Math.max(10, Math.min(90, hoverPosition))}%` }}
            >
              <span className="font-semibold">{formatTime(hoverTime)}</span>
              {hoverChapter && (
                <span className="text-[10px] text-amber-300 font-sans font-medium truncate max-w-[200px]">
                  {hoverChapter.title}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-1 text-white">
          {/* Left Controls: Play, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-0.5 sm:gap-2 min-w-0">
            {/* Prev Video (if in playlist) */}
            {hasPrevVideo && (
              <button
                onClick={onPrevVideo}
                title="Previous Video"
                aria-label="Previous Video"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <SkipBack className="h-4 w-4" />
              </button>
            )}

            {/* Play/Pause */}
            <button
              onClick={() => {
                togglePlay();
                handleUserActivity();
              }}
              aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF0000] text-white shadow-md hover:bg-[#CC0000] active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white ml-0.5" />}
            </button>

            {/* Rewind 10s (Visible on mobile & desktop) */}
            <button
              onClick={() => seekRelative(-10)}
              title="Rewind 10s (J)"
              aria-label="Rewind 10 seconds"
              className="flex items-center justify-center h-9 px-1.5 sm:px-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="ml-0.5 text-[10px] font-mono font-bold">10</span>
            </button>

            {/* Forward 10s (Visible on mobile & desktop) */}
            <button
              onClick={() => seekRelative(10)}
              title="Fast Forward 10s (L)"
              aria-label="Forward 10 seconds"
              className="flex items-center justify-center h-9 px-1.5 sm:px-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <RotateCw className="h-4 w-4" />
              <span className="ml-0.5 text-[10px] font-mono font-bold">10</span>
            </button>

            {/* Next Video */}
            {hasNextVideo && (
              <button
                onClick={onNextVideo}
                title="Next Video"
                aria-label="Next Video"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            )}

            {/* Touch-friendly Volume & Mute Control */}
            <div data-player-menu className="relative group/vol flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 640) {
                    setVolumeSliderOpen((prev) => !prev);
                    setQualityMenuOpen(false);
                    setSpeedMenuOpen(false);
                    setSubtitleMenuOpen(false);
                    setAspectMenuOpen(false);
                    handleUserActivity();
                  } else {
                    toggleMute();
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setVolumeSliderOpen((prev) => !prev);
                }}
                title="Mute / Volume (M)"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>

              {/* Desktop inline volume slider */}
              <div className="hidden sm:flex items-center w-16 md:w-20">
                <input
                  type="range"
                  aria-label="Volume"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-1 w-full accent-[#FF0000] cursor-pointer"
                />
              </div>

              {/* Mobile expandable volume + mute popover */}
              {volumeSliderOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="sm:hidden absolute left-0 bottom-11 z-50 flex items-center gap-2.5 max-w-[calc(100vw-2rem)] rounded-xl border border-white/15 bg-slate-900/95 px-3 py-2 shadow-2xl backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4 text-rose-400" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    aria-label="Mobile Volume"
                    min="0"
                    max="1"
                    step="0.02"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="h-1.5 w-24 accent-[#FF0000]"
                  />
                  <span className="text-[10px] font-mono text-white w-8 text-right tabular-nums">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Time Display */}
            <button
              onClick={() => setShowTimeRemaining(!showTimeRemaining)}
              title="Click to toggle elapsed / remaining time"
              className="text-[11px] sm:text-xs font-mono text-slate-200 hover:text-white transition-colors whitespace-nowrap px-1 shrink-0 tabular-nums"
            >
              {formatTime(currentTime)}{' '}
              <span className="text-slate-400">/</span>{' '}
              {showTimeRemaining && duration > 0
                ? `-${formatTime(Math.max(0, duration - currentTime))}`
                : formatTime(duration)}
            </button>

            {/* Active Chapter Pill (Click to open chapter list overlay) */}
            {chapters.length > 0 && activeChapter && (
              <button
                onClick={() => setChaptersOverlayOpen(!chaptersOverlayOpen)}
                title={`Current Chapter: ${activeChapter.title} (Click to open chapter list)`}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 hover:bg-white/20 text-amber-200 border border-white/10 transition-all max-w-[200px] truncate"
              >
                <ListOrdered className="h-3.5 w-3.5 flex-shrink-0 text-[#FF0000]" />
                <span className="truncate">{activeChapter.title}</span>
                <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-70" />
              </button>
            )}
          </div>

          {/* Right Controls: Bookmark, Chapters, Speed, Quality/Settings, CC, PiP, Fullscreen */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            {/* Chapter List Overlay Button */}
            {chapters.length > 0 && (
              <button
                onClick={() => setChaptersOverlayOpen(!chaptersOverlayOpen)}
                title="Video Chapters (Click to view full chapter list)"
                className={`flex items-center gap-1 h-9 px-2 text-xs font-medium rounded-lg transition-colors ${
                  chaptersOverlayOpen
                    ? 'bg-[#FF0000] text-white shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListOrdered className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden lg:inline">Chapters</span>
                <span className="text-[10px] px-1 rounded-full bg-white/20">
                  {chapters.length}
                </span>
              </button>
            )}

            {/* Quick Bookmark Current Frame */}
            <button
              onClick={handleAddBookmarkClick}
              title="Add Bookmark at this time (B)"
              className="hidden sm:flex items-center gap-1 h-9 px-2.5 text-xs font-medium rounded-lg text-slate-300 hover:text-amber-400 hover:bg-white/10 transition-colors"
            >
              <BookmarkIcon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Bookmark</span>
            </button>

            {/* Playback Speed Menu */}
            <div data-player-menu className="relative">
              <button
                onClick={() => {
                  setSpeedMenuOpen(!speedMenuOpen);
                  setQualityMenuOpen(false);
                  setSubtitleMenuOpen(false);
                  setAspectMenuOpen(false);
                  setVolumeSliderOpen(false);
                }}
                aria-label="Playback Speed"
                className="h-9 px-2 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                {playbackRate}x
              </button>

              {speedMenuOpen && (
                <div className="absolute right-0 bottom-11 z-40 w-28 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900/95 py-1.5 shadow-2xl backdrop-blur-md text-white text-xs">
                  <div className="px-3 py-1 font-semibold text-slate-400 border-b border-white/10 text-[10px] uppercase tracking-wider">
                    Playback Speed
                  </div>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-white/10 ${
                        playbackRate === rate ? 'text-sky-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality / Settings Menu (Only supported resolutions) */}
            <div data-player-menu className="relative">
              <button
                onClick={() => {
                  setQualityMenuOpen(!qualityMenuOpen);
                  setSpeedMenuOpen(false);
                  setSubtitleMenuOpen(false);
                  setAspectMenuOpen(false);
                  setVolumeSliderOpen(false);
                }}
                title="Quality & Video Settings"
                aria-label="Quality Settings"
                className={`flex items-center gap-1 h-9 px-2 rounded-lg text-xs font-semibold transition-all ${
                  selectedQuality === 'Auto'
                    ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25'
                    : 'text-white bg-white/15 hover:bg-white/25'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {selectedQuality === 'Auto' ? `Auto (${effectiveQualityLabel.replace(' HD', '')})` : selectedQuality.replace(' HD', '')}
                </span>
                <span className="sm:hidden text-[11px]">
                  {selectedQuality === 'Auto' ? 'Auto' : selectedQuality.split(' ')[0]}
                </span>
              </button>

              {qualityMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-11 z-50 w-60 max-w-[calc(100vw-1.5rem)] max-h-[65vh] overflow-y-auto rounded-2xl border border-white/15 bg-slate-900/98 p-2.5 shadow-2xl backdrop-blur-xl text-white text-xs animate-in zoom-in-95 duration-150 space-y-2"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    <div className="flex items-center gap-1.5">
                      <Signal className="h-3 w-3 text-emerald-400" />
                      <span>Adaptive Bitrate (ABR)</span>
                    </div>
                    <button
                      onClick={() => {
                        setQualityMenuOpen(false);
                        setShowInfraModal(true);
                      }}
                      title="View Cloud Infrastructure & Edge CDN"
                      className="text-sky-400 hover:underline flex items-center gap-0.5 normal-case"
                    >
                      <Server className="h-2.5 w-2.5" />
                      <span>Cloud CDN</span>
                    </button>
                  </div>

                  {/* Auto Mode */}
                  <button
                    onClick={() => handleQualityChange('Auto')}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors ${
                      selectedQuality === 'Auto'
                        ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>Auto (Adaptive)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                          {effectiveQualityLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Dynamic ladder based on buffer ({bufferHealthSec}s)
                      </div>
                    </div>
                    {selectedQuality === 'Auto' && <Check className="h-3.5 w-3.5" />}
                  </button>

                  {/* Manual Ladder options */}
                  <div className="pt-1 border-t border-white/10 space-y-0.5">
                    {streamLadder.map((tier) => (
                      <button
                        key={tier.label}
                        onClick={() => handleQualityChange(tier.label)}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          selectedQuality === tier.label
                            ? 'bg-sky-500/15 text-sky-400 font-bold'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{tier.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {tier.bitrateKbps >= 1000 ? `${(tier.bitrateKbps / 1000).toFixed(1)} Mbps` : `${tier.bitrateKbps} kbps`}
                          </span>
                        </div>
                        {selectedQuality === tier.label && <Check className="h-3.5 w-3.5 text-sky-400" />}
                      </button>
                    ))}
                  </div>

                  {/* Telemetry Footer */}
                  <div className="pt-1 border-t border-white/10 px-1 text-[10px] text-slate-400 flex items-center justify-between font-mono">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      tokyo-edge-01
                    </span>
                    <span className="text-emerald-400">{bufferHealthSec}s buffered</span>
                  </div>
                </div>
              )}
            </div>

            {/* Subtitles / Closed Captions (CC) Menu & Toggle */}
            <div data-player-menu className="relative">
              <button
                onClick={() => {
                  setSubtitleMenuOpen(!subtitleMenuOpen);
                  setQualityMenuOpen(false);
                  setSpeedMenuOpen(false);
                  setAspectMenuOpen(false);
                  setVolumeSliderOpen(false);
                }}
                title={`Subtitles / Captions (C) - ${subtitlesEnabled ? 'On' : 'Off'}`}
                aria-label="Subtitles and Captions"
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                  subtitlesEnabled
                    ? 'text-sky-400 bg-sky-500/20 ring-1 ring-sky-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Captions className="h-4 w-4" />
                {subtitlesEnabled && (
                  <span className="absolute bottom-1 right-1.5 h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                )}
              </button>

              {/* Subtitles Dropdown Menu */}
              {subtitleMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-11 z-50 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] max-h-[65vh] overflow-y-auto rounded-2xl border border-white/15 bg-slate-900/98 p-3 shadow-2xl backdrop-blur-xl text-white text-xs animate-in zoom-in-95 duration-150 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Captions className="h-4 w-4 text-sky-400" />
                      <span className="font-bold text-sm">Subtitles & Captions</span>
                    </div>
                    <button
                      onClick={() => setSubtitleMenuOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Quick Toggle On/Off */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xs font-semibold">Subtitles Display</span>
                    <button
                      onClick={toggleSubtitles}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        subtitlesEnabled ? 'bg-sky-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                          subtitlesEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Track Selection List */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      Available Tracks
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                      {/* Disable Subtitles Option */}
                      <button
                        onClick={() => handleSelectTrack(null)}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          !subtitlesEnabled
                            ? 'bg-sky-500/15 text-sky-400 font-bold'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>Off (Disable)</span>
                        {!subtitlesEnabled && <Check className="h-3.5 w-3.5" />}
                      </button>

                      {/* Language & Custom Tracks */}
                      {availableTracks.map((track) => {
                        const isSelected = subtitlesEnabled && selectedTrackId === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => handleSelectTrack(track.id)}
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-sky-500/15 text-sky-400 font-bold'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate">{track.label}</span>
                              {track.isCustom && (
                                <span className="rounded bg-purple-500/20 text-purple-300 text-[9px] font-semibold px-1.5 py-0.2 shrink-0">
                                  Custom
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSelected && <Check className="h-3.5 w-3.5 text-sky-400" />}
                              {track.isCustom && (
                                <button
                                  onClick={(e) => handleDeleteCustomTrack(track.id, e)}
                                  title="Delete custom track"
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:text-rose-400 text-slate-400 transition-opacity"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Upload & External Subtitle Actions */}
                  <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-semibold transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5 text-sky-400" />
                      <span>Upload .SRT/.VTT</span>
                    </button>
                    <button
                      onClick={() => setShowUrlModal(true)}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-semibold transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-purple-400" />
                      <span>Paste / URL</span>
                    </button>
                  </div>

                  {/* Timing Sync & Customization Settings */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    {/* Audio Sync Offset */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">
                        Audio Sync: {subtitleOffset === 0 ? '0.0s' : `${subtitleOffset > 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSubtitleOffset((prev) => parseFloat((prev - 0.5).toFixed(1)))}
                          title="-0.5s Earlier"
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px]"
                        >
                          -0.5s
                        </button>
                        <button
                          onClick={() => setSubtitleOffset(0)}
                          title="Reset Sync"
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-slate-300"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setSubtitleOffset((prev) => parseFloat((prev + 0.5).toFixed(1)))}
                          title="+0.5s Later"
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px]"
                        >
                          +0.5s
                        </button>
                      </div>
                    </div>

                    {/* Font Size & Color Customization */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-400 block mb-1">Text Size</span>
                        <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                          {(['sm', 'base', 'lg'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setSubtitleFontSize(s);
                                localStorage.setItem('vio_streaming_subtitle_size', s);
                              }}
                              className={`flex-1 py-0.5 rounded text-center capitalize transition-colors ${
                                subtitleFontSize === s ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {s === 'sm' ? 'S' : s === 'base' ? 'M' : 'L'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block mb-1">Text Color</span>
                        <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                          {(['white', 'yellow', 'cyan'] as const).map((c) => (
                            <button
                              key={c}
                              onClick={() => {
                                setSubtitleColor(c);
                                localStorage.setItem('vio_streaming_subtitle_color', c);
                              }}
                              className={`flex-1 py-0.5 rounded text-center capitalize transition-colors ${
                                subtitleColor === c ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {c[0].toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? 'Looping enabled' : 'Enable loop'}
              className={`hidden sm:flex p-1.5 rounded-lg transition-colors ${
                isLooping ? 'text-sky-400 bg-sky-500/20' : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <ListPlus className="h-4 w-4" />
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              title="Picture-in-Picture (P)"
              className="hidden sm:flex p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PictureInPicture className="h-4 w-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen (F)"
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            {/* Clean View / Clear All Overlays Toggle (Desktop) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = !isCleanMode;
                setIsCleanMode(next);
                if (next) setShowControls(false);
              }}
              title={isCleanMode ? "Show Controls Overlay" : "Clear All Overlays (Clean View)"}
              className={`hidden sm:flex p-1.5 rounded-lg transition-colors ${
                isCleanMode ? 'text-sky-400 bg-sky-500/20' : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {isCleanMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* External Subtitle URL or Paste Modal */}
      {showUrlModal && (
        <div
          onClick={() => setShowUrlModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-5 shadow-2xl text-white space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-sky-400" />
                <h4 className="font-bold text-base">Load External Subtitles</h4>
              </div>
              <button
                onClick={() => setShowUrlModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Paste a direct URL to an external <code className="text-sky-300 font-mono">.srt</code> or <code className="text-sky-300 font-mono">.vtt</code> file, or paste raw subtitle text below:
            </p>

            <textarea
              rows={4}
              value={pastedUrlOrText}
              onChange={(e) => setPastedUrlOrText(e.target.value)}
              placeholder="https://example.com/movie_subtitles.srt&#10;or paste&#10;1&#10;00:00:01,000 --> 00:00:04,000&#10;Welcome to Vio streaming..."
              className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-xs font-mono text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Supports SRT & WebVTT formats
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLoadUrlOrText}
                  disabled={isParsingUrl || !pastedUrlOrText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {isParsingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Parse & Load</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clickable Chapter List Overlay */}
      <ChapterOverlay
        chapters={chapters}
        activeChapter={activeChapter}
        currentTime={currentTime}
        duration={duration}
        isOpen={chaptersOverlayOpen}
        onClose={() => setChaptersOverlayOpen(false)}
        onSelectChapter={handleSelectChapter}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
      />

      {/* Cloud Infrastructure & CDN Edge Status Modal */}
      <CloudInfrastructureModal
        isOpen={showInfraModal}
        onClose={() => setShowInfraModal(false)}
      />
    </div>
  );
};
