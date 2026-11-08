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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <BookmarkIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Video Markers & Notes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentBookmarks.length} saved {currentBookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
            </p>
          </div>
        </div>

        {currentBookmarks.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportBookmarks}
              title="Export Bookmarks as JSON"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={onClearAllBookmarks}
              title="Clear all"
              className="rounded-lg px-2.5 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {currentBookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-3">
            <Clock className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No bookmarks created yet
          </p>
          <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
            Click the <span className="font-semibold text-amber-500">Bookmark</span> button or press{' '}
            <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">B</kbd> while
            playing to save key timestamps with notes.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {currentBookmarks.map((bm) => (
            <div
              key={bm.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 transition-all hover:border-slate-200 hover:bg-slate-100 dark:border-slate-800/80 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Thumbnail or Fallback */}
                <div
                  onClick={() => onJumpToTime(bm.time)}
                  className="relative h-12 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-black ring-1 ring-slate-200 dark:ring-slate-700"
                >
                  {bm.thumbnailUrl ? (
                    <img
                      src={bm.thumbnailUrl}
                      alt={bm.label}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-500">
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
                        className="w-full rounded border border-sky-400 bg-white px-2 py-0.5 text-xs text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(bm.id)}
                        className="rounded p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <h4
                        onClick={() => onJumpToTime(bm.time)}
                        className="cursor-pointer text-xs font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400 truncate"
                      >
                        {bm.label}
                      </h4>
                      <button
                        onClick={() => startEdit(bm)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-amber-500">
                    <span>{formatTime(bm.time)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onJumpToTime(bm.time)}
                  title="Jump to time"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-700 shadow-xs hover:bg-sky-50 hover:text-sky-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </button>
                <button
                  onClick={() => onDeleteBookmark(bm.id)}
                  title="Delete bookmark"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30 transition-colors"
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
