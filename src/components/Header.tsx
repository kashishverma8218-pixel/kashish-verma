import React from 'react';
import { Sun, Moon, Sparkles, Keyboard, UploadCloud } from 'lucide-react';
import { VioLogo } from './VioLogo';

interface HeaderProps {
  activeTab: 'player' | 'library' | 'bookmarks';
  setActiveTab: (tab: 'player' | 'library' | 'bookmarks') => void;
  onOpenUpload: () => void;
  onOpenShortcuts: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenUpload,
  onOpenShortcuts,
  isDarkMode,
  toggleDarkMode,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => setActiveTab('player')}
          className="flex items-center gap-2 text-left tracking-tight whitespace-nowrap shrink-0 group focus:outline-none"
        >
          <VioLogo size="sm" />
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => setActiveTab('player')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'player'
                ? 'text-sky-600 dark:text-sky-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cinema Player
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'library'
                ? 'text-sky-600 dark:text-sky-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Video Library
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'bookmarks'
                ? 'text-sky-600 dark:text-sky-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Saved Bookmarks
          </button>
          <button
            onClick={onOpenShortcuts}
            className="flex items-center gap-1.5 whitespace-nowrap shrink-0 text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span>Shortcuts</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Lockup */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleDarkMode}
            aria-label="Toggle visual theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sky-500 active:scale-95 whitespace-nowrap shrink-0"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Open Video</span>
          </button>
        </div>
      </div>
    </header>
  );
};
