import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, Maximize2, X } from 'lucide-react';
import Hls from 'hls.js';
import { VideoItem } from '../types/video';
import { auth } from '../firebase';
import { fetchPlaybackSession, sanitizePlayableVideoUrl } from '../services/streamingService';
import { formatTime } from '../utils/formatTime';

interface MiniplayerDockProps {
  video: VideoItem;
  channelName: string;
  initialTime?: number;
  hasNext?: boolean;
  onNext?: () => void;
  onExpand: (currentTime: number) => void;
  onClose: () => void;
}

export const MiniplayerDock: React.FC<MiniplayerDockProps> = ({
  video,
  channelName,
  initialTime = 0,
  hasNext = false,
  onNext,
  onExpand,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(video.duration || 0);
  const [srcUrl, setSrcUrl] = useState<string>(() =>
    sanitizePlayableVideoUrl(video.url, video.id, 'video', false)
  );

  useEffect(() => {
    let cancelled = false;
    const el = videoRef.current;

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    cleanupHls();

    const attachHls = async (manifestUrl: string, fallbackUrl?: string | null) => {
      if (!el) return;
      if (Hls.isSupported()) {
        const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
        if (cancelled) return;
        const hls = new Hls({
          enableWorker: true,
          capLevelToPlayerSize: true,
          xhrSetup: (xhr) => {
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          },
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled || !el) return;
          if (initialTime > 0) el.currentTime = initialTime;
          el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          cleanupHls();
          if (fallbackUrl) setSrcUrl(fallbackUrl);
        });
        hls.loadSource(manifestUrl);
        hls.attachMedia(el);
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        setSrcUrl(manifestUrl);
      } else if (fallbackUrl) {
        setSrcUrl(fallbackUrl);
      }
    };

    const usesCloudPlayback =
      Boolean(video.sourceObjectPath) ||
      Boolean(video.hlsManifestUrl && video.hlsManifestUrl.startsWith('/api/stream/hls/')) ||
      Boolean(video.url && video.url.startsWith('/api/media/object/')) ||
      video.visibility === 'private';

    if (usesCloudPlayback) {
      fetchPlaybackSession(video.id)
        .then((session) => {
          if (cancelled) return;
          if (session.hlsUrl) {
            attachHls(session.hlsUrl, session.fallbackUrl);
          } else if (session.fallbackUrl) {
            setSrcUrl(session.fallbackUrl);
          }
        })
        .catch(() => {
          setSrcUrl(sanitizePlayableVideoUrl(video.url, video.id, 'video', false));
        });
    } else if (video.hlsManifestUrl && /\.m3u8(\?|$)/i.test(video.hlsManifestUrl)) {
      attachHls(video.hlsManifestUrl, sanitizePlayableVideoUrl(video.url, video.id, 'video', false));
    } else {
      setSrcUrl(sanitizePlayableVideoUrl(video.url, video.id, 'video', false));
    }

    return () => {
      cancelled = true;
      cleanupHls();
    };
  }, [video.id, video.url, video.hlsManifestUrl, video.sourceObjectPath, video.visibility, initialTime]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <aside
      aria-label="Miniplayer"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5 right-3 sm:right-5 z-40 w-[290px] sm:w-[340px] rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
    >
      {/* Video Frame */}
      <div className="group relative aspect-video w-full bg-black overflow-hidden">
        <video
          ref={videoRef}
          src={hlsRef.current ? undefined : srcUrl}
          poster={video.poster}
          playsInline
          onLoadedMetadata={() => {
            const el = videoRef.current;
            if (!el) return;
            setDuration(el.duration || video.duration || 0);
            if (initialTime > 0 && Math.abs(el.currentTime - initialTime) > 1) {
              el.currentTime = Math.min(initialTime, el.duration || initialTime);
            }
            el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          }}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (hasNext && onNext) onNext();
          }}
          onClick={togglePlay}
          className="h-full w-full object-contain cursor-pointer"
        />

        {/* Quick Top Bar (Expand & Close) */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/75 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onExpand(videoRef.current?.currentTime || currentTime)}
            title="Expand player"
            aria-label="Expand miniplayer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/85 transition-colors cursor-pointer"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close miniplayer"
            aria-label="Close miniplayer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/85 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mini Progress Bar */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
          <div className="h-full bg-[#FF0000] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Track Metadata & Controls */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onExpand(videoRef.current?.currentTime || currentTime)}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <p className="text-xs font-bold text-[var(--ink)] truncate hover:text-[var(--accent-ink)] transition-colors">
            {video.title}
          </p>
          <p className="text-[11px] text-[var(--ink-medium)] truncate tabular-nums">
            {channelName} · {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF0000] text-white hover:bg-[#CC0000] active:scale-95 transition-all cursor-pointer"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white ml-0.5" />}
          </button>

          {hasNext && onNext && (
            <button
              type="button"
              onClick={onNext}
              title="Next video"
              aria-label="Next video"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
