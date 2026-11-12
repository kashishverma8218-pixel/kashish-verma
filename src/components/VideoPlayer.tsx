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
  SlidersHorizontal,
  Plus,
  Trash2,
  X,
  Signal,
  Wifi,
  Globe2,
  Server,
  ListOrdered,
  ChevronRight
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

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

  // UI Interactivity State: Clean overlay-free mode defaults to true on mobile
  const [isCleanMode, setIsCleanMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);
  const [aspectMenuOpen, setAspectMenuOpen] = useState<boolean>(false);
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
  const [currentSrc, setCurrentSrc] = useState<string>(video.url);
  // Adaptive Bitrate (ABR) & Cloud Streaming State
  const [streamLadder, setStreamLadder] = useState<VideoStreamQuality[]>(() => {
    return video.streamQualities && video.streamQualities.length > 0
      ? video.streamQualities
      : buildStreamLadder(video.id, video.url);
  });
  const [selectedQuality, setSelectedQuality] = useState<string>(() => {
    return localStorage.getItem('vio_pref_quality') || 'Auto';
  });
  const [effectiveQualityLabel, setEffectiveQualityLabel] = useState<string>('1080p60 HD');
  const [qualityMenuOpen, setQualityMenuOpen] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [reconnectToast, setReconnectToast] = useState<string | null>(null);
  const [showInfraModal, setShowInfraModal] = useState<boolean>(false);
  const [showTelemetry, setShowTelemetry] = useState<boolean>(false);
  const [bufferHealthSec, setBufferHealthSec] = useState<number>(0);
  const [failoverIndex, setFailoverIndex] = useState<number>(0);

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

  // Handle external seek requests (e.g. from clicking chapter timestamps in WatchView description)
  useEffect(() => {
    if (typeof externalSeekTime === 'number' && videoRef.current) {
      videoRef.current.currentTime = externalSeekTime;
      setCurrentTime(externalSeekTime);
      if (!isPlaying) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      onExternalSeekConsumed?.();
    }
  }, [externalSeekTime, onExternalSeekConsumed, isPlaying]);

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

  // Buffer health & adaptive bitrate monitor
  useEffect(() => {
    const timer = setInterval(() => {
      if (!videoRef.current) return;
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
          if (optimal.label !== effectiveQualityLabel) {
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
      setEffectiveQualityLabel(optimal.label);
      showSubToast(`Adaptive Bitrate: Auto (${optimal.label})`);
    } else {
      setEffectiveQualityLabel(qualityLabel);
      showSubToast(`Quality set to ${qualityLabel}`);
    }
  };

  const handleStreamError = useCallback(() => {
    if (!videoRef.current) return;
    const timeBeforeError = videoRef.current.currentTime || 0;
    const wasPlaying = isPlaying;

    setReconnecting(true);
    setReconnectToast(`Reconnecting stream via Cloud Edge CDN (${Math.floor(timeBeforeError)}s)...`);

    const mirrors = video.backupStreams || CDN_STREAM_MIRRORS[video.id] || [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    ];

    const nextMirror = mirrors[failoverIndex % mirrors.length] || video.url;
    setFailoverIndex((prev) => prev + 1);

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
    }, 1200);
  }, [failoverIndex, video.backupStreams, video.id, isPlaying, video.url]);

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
    setCurrentSrc(video.url);
    setFailoverIndex(0);
    setErrorMessage(null);
  }, [video.id, video.url]);

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

  // Aspect Ratio Object-Fit mapping
  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video object-contain';
      case '4:3':
        return 'aspect-4/3 object-contain';
      case '21:9':
        return 'aspect-21/9 object-contain';
      case '9:16':
        return 'aspect-9/16 max-w-sm mx-auto object-contain';
      case 'cover':
        return 'w-full h-full object-cover';
      case 'auto':
      default:
        return 'w-full h-full object-contain';
    }
  };

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

  // Autohide controls logic
  const handleUserActivity = useCallback(() => {
    if (isCleanMode) return;
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        if (!speedMenuOpen && !aspectMenuOpen && !isSeeking) {
          setShowControls(false);
        }
      }, 1800);
    }
  }, [isPlaying, speedMenuOpen, aspectMenuOpen, isSeeking, isCleanMode]);

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
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        handleVolumeChange(0.5);
      }
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
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

  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  }, []);

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

  // Scrubbing & Seeking calculation
  const calculateSeekTime = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current || !duration) return 0;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return pos * duration;
  };

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    const newTime = calculateSeekTime(e);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressTrackRef.current || !duration) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);

    if (isSeeking && videoRef.current) {
      const newTime = pos * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
  };

  // Keyboard Shortcuts Listener
  // Use custom hook to handle comprehensive keyboard shortcuts
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

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Reset state on video change
  useEffect(() => {
    setCurrentTime(0);
    setBufferedEnd(0);
    setIsBuffering(false);
    setErrorMessage(null);
    if (videoRef.current) {
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

  // Double tap to seek (Left half: -10s, Right half: +10s)
  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If target was a button inside controls, ignore
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    togglePlay();
  };

  const handleVideoDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onMouseUp={handleSeekEnd}
      className={`group relative select-none overflow-hidden bg-black transition-all ${
        isFullscreen ? 'h-screen w-screen' : 'w-full rounded-2xl shadow-2xl ring-1 ring-white/10'
      }`}
    >
      {/* Video Element */}
      <div
        onClick={handleVideoAreaClick}
        onDoubleClick={handleVideoDoubleClick}
        className="relative flex aspect-video sm:h-[480px] lg:h-[620px] w-full items-center justify-center overflow-hidden cursor-pointer"
      >
        <video
          ref={videoRef}
          src={currentSrc}
          poster={video.poster}
          playsInline
          loop={isLooping}
          crossOrigin={enableCors ? 'anonymous' : undefined}
          style={filterStyle}
          className={`transition-all duration-150 ${getAspectRatioClasses()}`}
          onTimeUpdate={() => {
            if (videoRef.current && !isSeeking) {
              setCurrentTime(videoRef.current.currentTime);
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

      {/* Top Overlay Bar (Hidden on mobile to keep player completely clear of overlays) */}
      <div
        className={`hidden md:flex absolute top-0 inset-x-0 z-30 items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
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
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
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

          {/* Quick Aspect Ratio */}
          <div className="relative">
            <button
              onClick={() => setAspectMenuOpen(!aspectMenuOpen)}
              title="Aspect Ratio"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/10 text-xs font-medium text-white hover:bg-white/20 transition-colors"
            >
              <Tv className="h-3.5 w-3.5" />
              <span className="uppercase">{aspectRatio}</span>
            </button>

            {aspectMenuOpen && (
              <div className="absolute right-0 top-10 z-40 w-36 rounded-xl border border-white/10 bg-slate-900/95 py-1.5 shadow-2xl backdrop-blur-md text-white text-xs">
                {(['auto', '16:9', '4:3', '21:9', '9:16', 'cover'] as AspectRatioMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setAspectRatio(mode);
                      setAspectMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-white/10 ${
                      aspectRatio === mode ? 'text-sky-400 font-semibold' : 'text-slate-300'
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
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all ${
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
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 px-3 sm:px-4 pb-3 sm:pb-4 pt-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls && !isCleanMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Timeline Progress Bar */}
        <div
          ref={progressTrackRef}
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseLeave={() => setHoverTime(null)}
          className="group/seek relative mb-3 flex h-6 w-full cursor-pointer items-center"
        >
          {/* Base Track */}
          <div className="relative h-1.5 w-full rounded-full bg-white/20 transition-all group-hover/seek:h-2.5">
            {/* Buffered Bar */}
            {duration > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all"
                style={{ width: `${Math.min(100, (bufferedEnd / duration) * 100)}%` }}
              />
            )}

            {/* Played Bar */}
            {duration > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
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

            {/* Scrub Thumb */}
            {duration > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md ring-2 ring-sky-400 transition-transform scale-0 group-hover/seek:scale-100"
                style={{ left: `calc(${(currentTime / duration) * 100}% - 7px)` }}
              />
            )}
          </div>

          {/* Hover Time Tooltip with Chapter Title */}
          {hoverTime !== null && (
            <div
              className="pointer-events-none absolute bottom-5 -translate-x-1/2 rounded-md bg-slate-900/95 px-2.5 py-1 text-[11px] font-mono text-white shadow-xl ring-1 ring-white/10 flex flex-col items-center max-w-[220px]"
              style={{ left: `${hoverPosition}%` }}
            >
              <span className="font-semibold">{formatTime(hoverTime)}</span>
              {hoverChapter && (
                <span className="text-[10px] text-sky-300 font-sans font-medium truncate max-w-[200px]">
                  {hoverChapter.title}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between text-white">
          {/* Left Controls: Play, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Prev Video (if in playlist) */}
            {hasPrevVideo && (
              <button
                onClick={onPrevVideo}
                title="Previous Video"
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white shadow-md hover:bg-sky-400 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white ml-0.5" />}
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => seekRelative(-10)}
              title="Rewind 10s (J)"
              className="hidden xs:flex p-1.5 text-slate-300 hover:text-white transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => seekRelative(10)}
              title="Fast Forward 10s (L)"
              className="hidden xs:flex p-1.5 text-slate-300 hover:text-white transition-colors"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Next Video */}
            {hasNextVideo && (
              <button
                onClick={onNextVideo}
                title="Next Video"
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            )}

            {/* Volume Control */}
            <div className="group/vol flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                title="Mute / Unmute (M)"
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>

              <div className="w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-20 sm:w-16">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-1 w-16 accent-sky-400"
                />
              </div>
            </div>

            {/* Time Display */}
            <button
              onClick={() => setShowTimeRemaining(!showTimeRemaining)}
              title="Click to toggle elapsed / remaining time"
              className="text-xs font-mono text-slate-300 hover:text-white transition-colors whitespace-nowrap pl-1"
            >
              {formatTime(currentTime)}{' '}
              <span className="text-slate-500">/</span>{' '}
              {showTimeRemaining && duration > 0
                ? `-${formatTime(Math.max(0, duration - currentTime))}`
                : formatTime(duration)}
            </button>

            {/* Active Chapter Pill (Click to open chapter list overlay) */}
            {chapters.length > 0 && activeChapter && (
              <button
                onClick={() => setChaptersOverlayOpen(!chaptersOverlayOpen)}
                title={`Current Chapter: ${activeChapter.title} (Click to open chapter list)`}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 hover:bg-white/20 text-sky-300 border border-white/10 transition-all max-w-[220px] truncate"
              >
                <ListOrdered className="h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
                <span className="truncate">{activeChapter.title}</span>
                <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-70" />
              </button>
            )}
          </div>

          {/* Right Controls: Bookmark, Chapters, Speed, Loop, PiP, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Chapter List Overlay Button */}
            {chapters.length > 0 && (
              <button
                onClick={() => setChaptersOverlayOpen(!chaptersOverlayOpen)}
                title="Video Chapters (Click to view full chapter list)"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  chaptersOverlayOpen
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Chapters</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {chapters.length}
                </span>
              </button>
            )}

            {/* Quick Bookmark Current Frame */}
            <button
              onClick={handleAddBookmarkClick}
              title="Add Bookmark at this time (B)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-amber-400 hover:bg-white/10 transition-colors"
            >
              <BookmarkIcon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Bookmark</span>
            </button>

            {/* Playback Speed Menu */}
            <div className="relative">
              <button
                onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                className="h-7 px-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                {playbackRate}x
              </button>

              {speedMenuOpen && (
                <div className="absolute right-0 bottom-9 z-40 w-28 rounded-xl border border-white/10 bg-slate-900/95 py-1.5 shadow-2xl backdrop-blur-md text-white text-xs">
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

            {/* Quality & Adaptive Bitrate (ABR) Menu */}
            <div className="relative">
              <button
                onClick={() => setQualityMenuOpen(!qualityMenuOpen)}
                title="Video Quality & Adaptive Bitrate (ABR)"
                className={`flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                  selectedQuality === 'Auto'
                    ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : 'text-sky-400 bg-sky-500/10 hover:bg-sky-500/20'
                }`}
              >
                <Signal className="h-3 w-3" />
                <span className="hidden sm:inline">
                  {selectedQuality === 'Auto' ? `Auto (${effectiveQualityLabel.replace(' HD', '')})` : selectedQuality.replace(' HD', '')}
                </span>
                <span className="sm:hidden">
                  {selectedQuality === 'Auto' ? 'Auto' : selectedQuality.split(' ')[0]}
                </span>
              </button>

              {qualityMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-9 z-50 w-60 rounded-2xl border border-white/15 bg-slate-900/98 p-2.5 shadow-2xl backdrop-blur-xl text-white text-xs animate-in zoom-in-95 duration-150 space-y-2"
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

            {/* Subtitles / Closed Captions (CC) Quick Toggle & Menu */}
            <div className="relative">
              <button
                onClick={toggleSubtitles}
                title={`Subtitles / Captions (C) - ${subtitlesEnabled ? 'On' : 'Off'} (Tap menu button for tracks & custom .srt upload)`}
                className={`relative flex items-center justify-center p-1.5 rounded-lg transition-all ${
                  subtitlesEnabled
                    ? 'text-sky-400 bg-sky-500/20 ring-1 ring-sky-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Captions className="h-4 w-4" />
                {subtitlesEnabled && (
                  <span className="absolute bottom-0.5 right-1 h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                )}
              </button>

              {/* Subtitles Options Trigger Pill */}
              <button
                onClick={() => setSubtitleMenuOpen(!subtitleMenuOpen)}
                title="Subtitle Tracks & Settings"
                className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-800 text-[9px] text-slate-300 hover:bg-sky-600 hover:text-white ring-1 ring-white/20 transition-colors"
              >
                <SlidersHorizontal className="h-2 w-2" />
              </button>

              {/* Subtitles Dropdown Menu */}
              {subtitleMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-9 z-50 w-72 sm:w-80 rounded-2xl border border-white/15 bg-slate-900/98 p-3 shadow-2xl backdrop-blur-xl text-white text-xs animate-in zoom-in-95 duration-150 space-y-3"
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
              className={`p-1.5 rounded-lg transition-colors ${
                isLooping ? 'text-sky-400 bg-sky-500/20' : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <ListPlus className="h-4 w-4" />
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              title="Picture-in-Picture (P)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PictureInPicture className="h-4 w-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen (F)"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>

            {/* Clean View / Clear All Overlays Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = !isCleanMode;
                setIsCleanMode(next);
                if (next) setShowControls(false);
              }}
              title={isCleanMode ? "Show Controls Overlay" : "Clear All Overlays (Clean View)"}
              className={`p-1.5 rounded-lg transition-colors ${
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
