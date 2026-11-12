import React, { useState, useMemo } from 'react';
import {
  X,
  ListOrdered,
  Play,
  CheckCircle2,
  Search,
  ChevronRight,
  SkipBack,
  SkipForward,
  Clock
} from 'lucide-react';
import { VideoChapter } from '../types/video';
import { formatChapterDuration } from '../utils/chapterParser';

interface ChapterOverlayProps {
  chapters: VideoChapter[];
  activeChapter: VideoChapter | null;
  currentTime: number;
  duration: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (chapter: VideoChapter) => void;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
}

export const ChapterOverlay: React.FC<ChapterOverlayProps> = ({
  chapters,
  activeChapter,
  currentTime,
  duration,
  isOpen,
  onClose,
  onSelectChapter,
  onPrevChapter,
  onNextChapter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase();
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.timestamp.toLowerCase().includes(q)
    );
  }, [chapters, searchQuery]);

  if (!isOpen) return null;

  const activeIndex = activeChapter
    ? chapters.findIndex((c) => c.id === activeChapter.id)
    : -1;

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn">
      {/* Click outside backdrop to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Slide-out Chapters Panel */}
      <div className="relative flex h-full w-full max-w-md flex-col bg-slate-950/95 border-l border-white/10 text-white shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <ListOrdered className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">Video Chapters</h2>
              <p className="text-xs text-slate-400">
                {chapters.length} chapters &bull; {activeIndex >= 0 ? `Chapter ${activeIndex + 1} of ${chapters.length}` : 'Click to jump'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title="Close Chapters (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        {chapters.length > 4 && (
          <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search chapters or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-white/10 pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-400 outline-none border border-transparent focus:border-sky-500/50 focus:bg-white/15 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chapters Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {filteredChapters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <ListOrdered className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-xs">No chapters match "{searchQuery}"</p>
            </div>
          ) : (
            filteredChapters.map((chapter, index) => {
              const isActive = activeChapter?.id === chapter.id;
              const isPast = currentTime >= chapter.endTime;
              const chapterLength = Math.max(1, chapter.endTime - chapter.startTime);
              const progressInChapter = isActive
                ? Math.min(100, Math.max(0, ((currentTime - chapter.startTime) / chapterLength) * 100))
                : isPast
                ? 100
                : 0;

              return (
                <button
                  key={chapter.id}
                  onClick={() => onSelectChapter(chapter)}
                  className={`group relative flex w-full text-left items-start gap-3 rounded-xl p-3 transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500/20 via-sky-500/10 to-transparent border border-sky-500/40 shadow-lg'
                      : 'hover:bg-white/5 border border-transparent hover:border-white/5'
                  }`}
                >
                  {/* Index / Status Icon */}
                  <div
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                      isActive
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                        : isPast
                        ? 'bg-white/10 text-slate-300'
                        : 'bg-white/5 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {isActive ? (
                      <Play className="h-3.5 w-3.5 fill-white" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Chapter Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          isActive
                            ? 'bg-sky-500/30 text-sky-300'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {chapter.timestamp}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatChapterDuration(chapterLength)}
                      </span>
                    </div>

                    <h3
                      className={`text-xs font-medium leading-relaxed truncate ${
                        isActive
                          ? 'text-white font-semibold'
                          : 'text-slate-200 group-hover:text-white'
                      }`}
                      title={chapter.title}
                    >
                      {chapter.title}
                    </h3>

                    {/* Chapter Progress Bar */}
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isActive
                            ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                            : isPast
                            ? 'bg-slate-400/60'
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${progressInChapter}%` }}
                      />
                    </div>
                  </div>

                  <ChevronRight
                    className={`h-4 w-4 self-center transition-transform group-hover:translate-x-0.5 ${
                      isActive ? 'text-sky-400' : 'text-slate-500'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between border-t border-white/10 p-3 bg-black/40 text-xs text-slate-300">
          <button
            onClick={onPrevChapter}
            disabled={!onPrevChapter || activeIndex <= 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <SkipBack className="h-3.5 w-3.5" />
            <span>Prev Chapter</span>
          </button>

          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Shortcuts: [ &amp; ]
          </span>

          <button
            onClick={onNextChapter}
            disabled={!onNextChapter || activeIndex >= chapters.length - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next Chapter</span>
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
