import React, { useState } from 'react';
import { CheckCircle2, MoreVertical, Clock, Share2, Play, Copy, Check } from 'lucide-react';
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
  // Capitalize clean words if mostly lowercased
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
      {/* Thumbnail Area with High Contrast Scrim */}
      <div
        onClick={() => onPlay(video)}
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
      >
        <img
          src={video.poster}
          alt={displayTitle}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Contrast Scrim on bottom of thumbnail to guarantee text contrast */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Hover subtle Play Icon */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/75 text-white shadow-xl backdrop-blur-xs ring-1 ring-white/20">
            <Play className="h-5 w-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* High-Contrast Duration Badge (WCAG AA Compliant) */}
        <div className="absolute bottom-2 right-2 rounded-md bg-black/90 px-2 py-0.5 text-[11px] font-mono font-semibold text-white shadow-md ring-1 ring-white/20 backdrop-blur-xs">
          {formatTime(video.duration)}
        </div>

        {/* Watch Progress Bar */}
        {watchProgress > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/30">
            <div
              className="h-full bg-red-600 shadow-xs"
              style={{ width: `${Math.min(100, watchProgress * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Metadata Row */}
      <div className="mt-3 flex items-start gap-3">
        {/* Channel Avatar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectChannel(video.channelId);
          }}
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-200 dark:ring-slate-700 hover:opacity-80 transition-opacity focus:outline-none"
        >
          {channel?.avatar ? (
            <img
              src={channel.avatar}
              alt={channel.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-sky-600 text-xs font-bold text-white uppercase">
              {displayTitle.charAt(0)}
            </div>
          )}
        </button>

        {/* Details: Title, Channel, Views & Time */}
        <div className="flex-1 min-w-0" onClick={() => onPlay(video)}>
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-red-600 dark:text-white dark:group-hover:text-red-400 transition-colors leading-snug">
            {displayTitle}
          </h3>

          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectChannel(video.channelId);
            }}
            className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            <span className="truncate font-medium">{channel?.name || 'Creator'}</span>
            {channel?.verified && (
              <CheckCircle2 className="h-3.5 w-3.5 text-red-500 fill-red-500/20 shrink-0" />
            )}
          </div>

          {/* Clean Editorial Metadata */}
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{formatViews(video.views)}</span>
            <span aria-hidden="true">·</span>
            <span>{video.publishedAt}</span>
          </div>
        </div>

        {/* 3-Dot Menu */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="More options"
            className="p-1.5 rounded-full text-slate-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-200 transition-all focus:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-6 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all dark:border-slate-800 dark:bg-slate-900 text-xs"
            >
              {/* Copy Link Button */}
              <button
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors font-medium"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                <span className={copied ? 'text-emerald-500 font-bold' : ''}>
                  {copied ? 'Link Copied!' : 'Copy Video Link'}
                </span>
              </button>

              <button
                onClick={handleOpenShare}
                className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5 text-slate-400" />
                <span>Share & Embed Options</span>
              </button>

              <button
                onClick={() => {
                  onToggleWatchLater(video.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{isWatchLater ? 'Remove Watch Later' : 'Save to Watch Later'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        video={video}
      />
    </div>
  );
};
