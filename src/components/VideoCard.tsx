import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Clock, Share2, Copy, Check, CheckCircle2 } from 'lucide-react';
import { VideoItem, Channel } from '../types/video';
import { formatTime } from '../utils/formatTime';
import { formatViews } from '../data/mockData';
import { ShareModal } from './ShareModal';

interface VideoCardProps {
  video: VideoItem;
  channel?: Channel;
  onPlay: (video: VideoItem) => void;
  onSelectChannel: (channelId: string) => void;
  onToggleWatchLater: (videoId: string) => void;
  isWatchLater?: boolean;
  watchProgress?: number; // 0 to 1
}

function formatVideoTitle(title: string): string {
  if (!title) return 'Untitled Video';
  let cleaned = title.replace(/\.(mp4|mov|webm|mkv|avi|flv)$/i, '');
  if (!cleaned.includes(' ') && (cleaned.includes('_') || cleaned.includes('-'))) {
    cleaned = cleaned.replace(/[-_]+/g, ' ');
  }
  if (cleaned === cleaned.toLowerCase()) {
    cleaned = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  channel,
  onPlay,
  onSelectChannel,
  onToggleWatchLater,
  isWatchLater = false,
  watchProgress = 0,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarFailed(false);
  }, [channel?.avatar]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [menuOpen]);

  const displayTitle = formatVideoTitle(video.title);

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${video.id}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setMenuOpen(false);
      }, 1500);
    } catch {
      setShareModalOpen(true);
      setMenuOpen(false);
    }
  };

  const handleOpenShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setShareModalOpen(true);
  };

  return (
    <div className="group relative flex flex-col cursor-pointer">
      {/* YouTube-style Borderless Rounded-XL Thumbnail */}
      <div
        onClick={() => onPlay(video)}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-[var(--thumb-bg)]"
      >
        <img
          src={video.poster || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80'}
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            const fallback = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80';
            if (target.src !== fallback) {
              target.src = fallback;
            }
          }}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {/* Quick Watch Later Button on Thumbnail Hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchLater(video.id);
          }}
          title={isWatchLater ? 'Remove from Watch later' : 'Watch later'}
          aria-label={isWatchLater ? 'Remove from Watch later' : 'Watch later'}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
        >
          {isWatchLater ? <Check className="h-4 w-4 text-[#FF0000]" /> : <Clock className="h-4 w-4" />}
        </button>

        {/* Bottom-Right Duration Timestamp */}
        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums rounded-[4px] leading-tight">
          {formatTime(video.duration)}
        </div>

        {/* Red Watch Progress Bar */}
        {watchProgress > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
            <div
              className="h-full bg-[#FF0000]"
              style={{ width: `${Math.min(100, watchProgress * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Card Body: 36px Avatar | 3-Line Stack | 3-Dot Menu */}
      <div className="mt-3 flex items-start gap-3">
        {/* Channel Avatar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectChannel(video.channelId);
          }}
          aria-label={`Visit ${channel?.name || 'creator'} channel`}
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--thumb-bg)] transition-opacity hover:opacity-90 focus:outline-none"
        >
          {channel?.avatar && !avatarFailed ? (
            <img
              src={channel.avatar}
              alt={channel.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#FF0000] text-xs font-bold text-white uppercase">
              {(channel?.name || displayTitle).charAt(0)}
            </div>
          )}
        </button>

        {/* Details: Title + Channel Name + Views & PublishedAt */}
        <div className="flex-1 min-w-0" onClick={() => onPlay(video)}>
          <h3 className="line-clamp-2 text-[15px] font-semibold text-[var(--ink)] leading-[1.35]">
            {displayTitle}
          </h3>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectChannel(video.channelId);
            }}
            className="mt-1 flex items-center gap-1 text-[13px] text-[var(--ink-medium)] hover:text-[var(--ink)] transition-colors max-w-full"
          >
            <span className="truncate">{channel?.name || 'Creator'}</span>
            {channel?.verified && (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--ink-medium)]" />
            )}
          </button>

          <div className="text-[13px] text-[var(--ink-medium)] tabular-nums truncate">
            <span>{formatViews(video.views)}</span>
            <span className="mx-1" aria-hidden="true">·</span>
            <span>{video.publishedAt || 'Recently'}</span>
          </div>
        </div>

        {/* 3-Dot Menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="More options"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-medium)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-[var(--ink)] hover:bg-[var(--card-hover)] transition-all focus:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] p-1.5 shadow-xl transition-all text-xs"
            >
              <button
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--ink)]/90 hover:bg-[var(--card-hover)] transition-colors font-medium"
              >
                {copied ? <Check className="h-4 w-4 text-[var(--accent-ink)]" /> : <Copy className="h-4 w-4 text-[var(--ink-medium)]" />}
                <span className={copied ? 'text-[var(--accent-ink)] font-semibold' : ''}>
                  {copied ? 'Link Copied' : 'Copy Video Link'}
                </span>
              </button>

              <button
                onClick={handleOpenShare}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--ink)]/90 hover:bg-[var(--card-hover)] transition-colors"
              >
                <Share2 className="h-4 w-4 text-[var(--ink-medium)]" />
                <span>Share</span>
              </button>

              <button
                onClick={() => {
                  onToggleWatchLater(video.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--ink)]/90 hover:bg-[var(--card-hover)] transition-colors"
              >
                <Clock className="h-4 w-4 text-[var(--ink-medium)]" />
                <span>{isWatchLater ? 'Remove from Watch later' : 'Save to Watch later'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        video={video}
      />
    </div>
  );
};
