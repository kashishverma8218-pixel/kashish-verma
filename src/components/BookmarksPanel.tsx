import React, { useState } from 'react';
import { Bookmark as BookmarkIcon, Play, Trash2, Clock, Edit2, Check, Download } from 'lucide-react';
import { Bookmark } from '../types/video';
import { formatTime } from '../utils/formatTime';

interface BookmarksPanelProps {
  bookmarks: Bookmark[];
  currentVideoId: string;
  onJumpToTime: (time: number) => void;
  onDeleteBookmark: (id: string) => void;
  onUpdateBookmarkLabel: (id: string, label: string) => void;
  onClearAllBookmarks: () => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarks,
  currentVideoId,
  onJumpToTime,
  onDeleteBookmark,
  onUpdateBookmarkLabel,
  onClearAllBookmarks,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const currentBookmarks = bookmarks.filter((b) => b.videoId === currentVideoId);

  const startEdit = (bm: Bookmark) => {
    setEditingId(bm.id);
    setEditingText(bm.label);
  };

  const saveEdit = (id: string) => {
    if (editingText.trim()) {
      onUpdateBookmarkLabel(id, editingText.trim());
    }
    setEditingId(null);
  };

  const exportBookmarks = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentBookmarks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `video_bookmarks_${Date.now()}.json`);
    downloadAnchor.click();
  };

  return (
    <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs transition-colors">
      <div className="flex items-center justify-between pb-3.5 border-b border-[var(--ink-faint)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <BookmarkIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Video Markers & Notes
            </h3>
            <p className="text-xs text-[var(--ink-medium)]">
              {currentBookmarks.length} saved {currentBookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
            </p>
          </div>
        </div>

        {currentBookmarks.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={exportBookmarks}
              title="Export Bookmarks as JSON"
              className="flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--ink-medium)] hover:bg-[var(--bg)] hover:text-[var(--ink)] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              type="button"
              onClick={onClearAllBookmarks}
              title="Clear all"
              className="min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {currentBookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg)] border border-[var(--ink-faint)] text-[var(--ink-medium)] mb-3">
            <Clock className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-[var(--ink)]">
            No bookmarks created yet
          </p>
          <p className="mt-1 max-w-xs text-xs text-[var(--ink-medium)]">
            Click the <span className="font-semibold text-amber-500">Bookmark</span> button or press{' '}
            <kbd className="rounded bg-[var(--bg)] border border-[var(--ink-faint)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink)]">B</kbd> while
            playing to save key timestamps with notes.
          </p>
        </div>
      ) : (
        <div className="mt-3.5 space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {currentBookmarks.map((bm) => (
            <div
              key={bm.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] p-2.5 transition-all hover:border-[var(--ink-medium)]/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Thumbnail or Fallback */}
                <div
                  onClick={() => onJumpToTime(bm.time)}
                  className="relative h-12 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-black ring-1 ring-[var(--ink-faint)]"
                >
                  {bm.thumbnailUrl ? (
                    <img
                      src={bm.thumbnailUrl}
                      alt={bm.label}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--thumb-bg)] text-[var(--ink-medium)]">
                      <Film className="h-4 w-4" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-4 w-4 fill-white text-white" />
                  </div>
                </div>

                {/* Metadata & Label */}
                <div className="min-w-0 flex-1">
                  {editingId === bm.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(bm.id)}
                        className="w-full min-h-[34px] rounded border border-[var(--ink-medium)] bg-[var(--surface)] px-2 py-0.5 text-base sm:text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(bm.id)}
                        aria-label="Save bookmark label"
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h4
                        onClick={() => onJumpToTime(bm.time)}
                        className="cursor-pointer text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent-ink)] truncate"
                      >
                        {bm.label}
                      </h4>
                      <button
                        type="button"
                        onClick={() => startEdit(bm)}
                        aria-label="Rename bookmark"
                        className="p-1 rounded text-[var(--ink-medium)] hover:text-[var(--ink)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-amber-500">
                    <span>{formatTime(bm.time)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onJumpToTime(bm.time)}
                  title="Jump to time"
                  aria-label="Jump to time"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--ink-faint)] text-[var(--ink)] hover:border-[var(--accent-ink)] hover:text-[var(--accent-ink)] transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBookmark(bm.id)}
                  title="Delete bookmark"
                  aria-label="Delete bookmark"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-medium)] hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function Film(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h18" />
      <path d="M3 16.5h4" />
      <path d="M17 3v18" />
      <path d="M17 7.5h4" />
      <path d="M17 16.5h4" />
    </svg>
  );
}
