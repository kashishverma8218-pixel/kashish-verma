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
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-colors dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Video Inspector & Media Stats
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Metadata
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Title:</span>
                <span className="font-medium text-slate-900 dark:text-white text-right truncate max-w-[200px]">
                  {video.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Author / Creator:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {video.author || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">
                  {video.duration ? formatTime(video.duration) : 'Dynamic stream'}
                </span>
              </div>
              {video.fileSize && (
                <div className="flex justify-between">
                  <span className="text-slate-500">File Size:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {video.fileSize}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Display & Format
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Active Aspect Ratio:</span>
                <span className="font-medium text-slate-900 dark:text-white uppercase">
                  {aspectRatio}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Audio Channels:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  Stereo 2.0 (HTML5 Audio)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source Type:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {video.isLocal ? 'Local Blob File' : 'HTTPS Remote Stream'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Source Location
            </h4>
            <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all select-all">
              {video.url}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
