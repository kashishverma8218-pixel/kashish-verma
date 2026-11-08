import React, { useState } from 'react';
import { X, Copy, Check, Share2, Code, Clock } from 'lucide-react';
import { VideoItem } from '../types/video';
import { formatTime } from '../utils/formatTime';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem;
  currentTime?: number;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  video,
  currentTime = 0,
}) => {
  const [includeTimestamp, setIncludeTimestamp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'embed'>('link');

  if (!isOpen) return null;

  const currentSec = Math.floor(currentTime);
  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = includeTimestamp && currentSec > 0
    ? `${baseUrl}?v=${video.id}&t=${currentSec}`
    : `${baseUrl}?v=${video.id}`;

  const embedCode = `<iframe width="560" height="315" src="${video.url}" title="${video.title}" frameborder="0" allowfullscreen></iframe>`;

  const copyToClipboard = async (text: string, type: 'link' | 'embed') => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for iframe environments
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      }
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-colors dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Share Video & Copy Link
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {video.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection: Share Link vs Embed Code */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'link'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Copy Video Link (URL)
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'embed'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Copy Embed Code
          </button>
        </div>

        {activeTab === 'link' ? (
          <div className="mt-5 space-y-4">
            {/* Link Input + Copy Button */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Video Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-900 select-all focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  onClick={() => copyToClipboard(shareUrl, 'link')}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-600 text-white hover:bg-red-500'
                  }`}
                >
                  {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Checkbox: Start at current time */}
            {currentSec > 0 && (
              <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
                <Clock className="h-4 w-4 text-slate-400" />
                <span>
                  Start at current playback time: <strong className="font-mono text-red-500">{formatTime(currentSec)}</strong>
                </span>
              </label>
            )}

            {/* Quick Share Buttons */}
            <div className="pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Share to Apps
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(video.title + ' ' + shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(video.title)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  X / Twitter
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(video.title)}&body=${encodeURIComponent(shareUrl)}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Email
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                HTML Embed Code
              </label>
              <textarea
                readOnly
                rows={3}
                value={embedCode}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-900 select-all focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold transition-all shadow-sm active:scale-95 ${
                  copiedEmbed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 text-white hover:bg-red-500'
                }`}
              >
                {copiedEmbed ? <Check className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                <span>{copiedEmbed ? 'Embed Code Copied!' : 'Copy Embed Code'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Click "Copy" button to instantly copy to your clipboard
          </span>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
