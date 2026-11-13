import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: video.title,
        text: `Watch "${video.title}" on Vio streaming`,
        url: shareUrl,
      });
    } catch {
      // User cancelled share sheet
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl transition-colors text-[var(--ink)] max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/15 text-[var(--accent-ink)]">
              <Share2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[var(--ink)] truncate">
                Share Video & Copy Link
              </h3>
              <p className="text-xs text-[var(--ink-medium)] truncate">
                {video.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection: Share Link vs Embed Code */}
        <div className="mt-4 flex rounded-xl bg-[var(--bg)] p-1 border border-[var(--ink-faint)] gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 min-h-[40px] py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
            }`}
          >
            Copy Video Link (URL)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('embed')}
            className={`flex-1 min-h-[40px] py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'embed'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                : 'text-[var(--ink-medium)] hover:text-[var(--ink)]'
            }`}
          >
            Copy Embed Code
          </button>
        </div>

        {activeTab === 'link' ? (
          <div className="mt-5 space-y-4">
            {/* Link Input + Copy Button */}
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
                Video Link
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2.5 text-xs font-mono text-[var(--ink)] select-all focus:outline-none focus:border-[#FF0000]"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(shareUrl, 'link')}
                  className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#FF0000] text-white hover:bg-[#CC0000]'
                  }`}
                >
                  {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Checkbox: Start at current time */}
            {currentSec > 0 && (
              <label className="min-h-[40px] flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--ink-faint)] cursor-pointer text-xs font-medium text-[var(--ink)] transition-colors">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#FF0000]"
                />
                <Clock className="h-4 w-4 text-[var(--ink-medium)]" />
                <span>
                  Start at current playback time: <strong className="font-mono text-[var(--accent-ink)]">{formatTime(currentSec)}</strong>
                </span>
              </label>
            )}

            {/* Quick Share Buttons */}
            <div className="pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                Share to Apps
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-ink)]/40 bg-[#FF0000]/10 px-3.5 py-2 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[#FF0000]/20 transition-colors cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>System Share</span>
                  </button>
                )}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(video.title + ' ' + shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[40px] inline-flex items-center rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors"
                >
                  WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(video.title)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[40px] inline-flex items-center rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors"
                >
                  X / Twitter
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(video.title)}&body=${encodeURIComponent(shareUrl)}`}
                  className="min-h-[40px] inline-flex items-center rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--ink-faint)] transition-colors"
                >
                  Email
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
                HTML Embed Code
              </label>
              <textarea
                readOnly
                rows={3}
                value={embedCode}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] p-3 text-xs font-mono text-[var(--ink)] select-all focus:outline-none focus:border-[#FF0000] resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className={`min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
                  copiedEmbed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#FF0000] text-white hover:bg-[#CC0000]'
                }`}
              >
                {copiedEmbed ? <Check className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                <span>{copiedEmbed ? 'Embed Code Copied!' : 'Copy Embed Code'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-[var(--ink-faint)] flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--ink-medium)]">
            Click "Copy" to copy link to clipboard
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl px-4 py-1.5 text-xs font-bold text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
