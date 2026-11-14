import React, { useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { VideoItem, AspectRatioMode } from '../types/video';
import { formatTime } from '../utils/formatTime';

interface VideoInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem;
  aspectRatio: AspectRatioMode;
}

export const VideoInfoModal: React.FC<VideoInfoModalProps> = ({
  isOpen,
  onClose,
  video,
  aspectRatio,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 shadow-2xl transition-colors text-[var(--ink)]"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-[#3EA6FF]" />
            <h3 className="text-base font-bold text-[var(--ink)]">
              Video Inspector & Media Stats
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video info"
            className="rounded-lg p-1.5 text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] p-3.5">
            <h4 className="text-xs font-semibold text-[var(--ink-medium)] uppercase tracking-wider mb-2">
              Metadata
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[var(--ink-medium)]">Title:</span>
                <span className="font-medium text-[var(--ink)] text-right truncate max-w-[200px]">
                  {video.title}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--ink-medium)]">Author / Creator:</span>
                <span className="font-medium text-[var(--ink)]">
                  {video.author || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--ink-medium)]">Duration:</span>
                <span className="font-mono font-medium text-[var(--ink)]">
                  {video.duration ? formatTime(video.duration) : 'Dynamic stream'}
                </span>
              </div>
              {video.fileSize && (
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--ink-medium)]">File Size:</span>
                  <span className="font-mono font-medium text-[var(--ink)]">
                    {video.fileSize}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] p-3.5">
            <h4 className="text-xs font-semibold text-[var(--ink-medium)] uppercase tracking-wider mb-2">
              Display & Format
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[var(--ink-medium)]">Active Aspect Ratio:</span>
                <span className="font-medium text-[var(--ink)] uppercase">
                  {aspectRatio}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--ink-medium)]">Audio Channels:</span>
                <span className="font-medium text-[var(--ink)]">
                  Stereo 2.0 (HTML5 Audio)
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--ink-medium)]">Source Type:</span>
                <span className="font-medium text-[var(--ink)]">
                  {video.isLocal ? 'Local Blob File' : 'HTTPS Remote Stream'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] p-3.5">
            <h4 className="text-xs font-semibold text-[var(--ink-medium)] uppercase tracking-wider mb-2">
              Source Location
            </h4>
            <p className="font-mono text-[11px] text-[var(--ink-medium)] break-all select-all">
              {video.url}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-full bg-[var(--ink)] px-5 py-2 text-xs font-semibold text-[var(--bg)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
