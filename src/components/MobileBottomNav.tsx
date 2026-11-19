import React, { useState } from 'react';
import { Home, Sparkles, LayoutGrid, Plus, Tv, Video, Clapperboard, X } from 'lucide-react';
import { NavigationPage } from './Sidebar';
import { useLanguage } from '../context/LanguageContext';

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: NavigationPage) => void;
  onOpenStudio: () => void;
  onOpenCreate: (target?: 'video' | 'reel') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  onNavigate,
  onOpenStudio,
  onOpenCreate,
}) => {
  const { t } = useLanguage();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  return (
    <>
      {/* Mobile + Create Bottom Sheet */}
      {createSheetOpen && (
        <div
          onClick={() => setCreateSheetOpen(false)}
          className="fixed inset-0 z-50 md:hidden flex items-end bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl border-t border-[var(--ink-faint)] bg-[var(--surface-elevated)] text-[var(--ink)] px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--ink-medium)]/30 mx-auto" />

            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-bold text-[var(--ink)]">Create on VIO</h3>
              <button
                type="button"
                onClick={() => setCreateSheetOpen(false)}
                aria-label="Close create options"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setCreateSheetOpen(false);
                  onOpenCreate('video');
                }}
                className="flex w-full items-center gap-3.5 min-h-[56px] rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] px-4 py-3 text-left active:scale-[0.99] transition-all"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--bg)]">
                  <Video className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[var(--ink)]">Upload Long Video</div>
                  <div className="text-xs text-[var(--ink-medium)]">16:9 widescreen · MP4, MOV, WebM</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateSheetOpen(false);
                  onOpenCreate('reel');
                }}
                className="flex w-full items-center gap-3.5 min-h-[56px] rounded-2xl border border-[#FF0000]/30 bg-[#FF0000]/10 px-4 py-3 text-left active:scale-[0.99] transition-all"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF0000] text-white shadow-sm">
                  <Clapperboard className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[var(--ink)]">Upload Shorts / Reels</div>
                  <div className="text-xs text-[var(--ink-medium)]">9:16 vertical feed · Up to 3 minutes</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-[var(--ink-faint)] bg-[var(--bg)]/95 backdrop-blur-xl px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] transition-colors"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* 1. Home Tab */}
          <button
            onClick={() => onNavigate('home')}
            className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[46px] rounded-lg transition-colors ${
              currentPage === 'home'
                ? 'text-[var(--ink)] font-semibold'
                : 'text-[var(--ink-medium)] hover:text-[var(--ink)] font-medium'
            }`}
          >
            {currentPage === 'home' ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-[var(--ink)]" aria-hidden="true">
                <path d="M12 3.2 3.5 10.1a1 1 0 0 0-.37.78V20a1 1 0 0 0 1 1h5.12a.75.75 0 0 0 .75-.75v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5.5a.75.75 0 0 0 .75.75h5.12a1 1 0 0 0 1-1v-9.12a1 1 0 0 0-.37-.78L12 3.2Z" />
              </svg>
            ) : (
              <Home className="h-5 w-5" />
            )}
            <span className="mt-1 text-[10px] leading-none">
              {t('nav.home', 'Home')}
            </span>
          </button>

          {/* 2. Reels Tab */}
          <button
            onClick={() => onNavigate('reels')}
            className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[46px] rounded-lg transition-colors ${
              currentPage === 'reels'
                ? 'text-[var(--ink)] font-semibold'
                : 'text-[var(--ink-medium)] hover:text-[var(--ink)] font-medium'
            }`}
          >
            <Sparkles
              className={`h-5 w-5 ${
                currentPage === 'reels' ? 'text-[var(--ink)]' : ''
              }`}
            />
            <span className="mt-1 text-[10px] leading-none">
              {t('nav.reelsShort', 'Reels')}
            </span>
          </button>

          {/* 3. Center + Create Action */}
          <button
            onClick={() => setCreateSheetOpen(true)}
            aria-label={t('nav.create', 'Create')}
            title={t('nav.create', 'Create')}
            className="flex flex-col items-center justify-center active:scale-95 transition-transform px-2 py-0.5 min-w-[56px] min-h-[46px]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--card-hover)] text-[var(--ink)] transition-colors">
              <Plus className="h-5 w-5" />
            </div>
          </button>

          {/* 4. Following Tab */}
          <button
            onClick={() => onNavigate('subscriptions')}
            className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[46px] rounded-lg transition-colors ${
              currentPage === 'subscriptions'
                ? 'text-[var(--ink)] font-semibold'
                : 'text-[var(--ink-medium)] hover:text-[var(--ink)] font-medium'
            }`}
          >
            <Tv
              className={`h-5 w-5 ${
                currentPage === 'subscriptions' ? 'text-[var(--ink)]' : ''
              }`}
            />
            <span className="mt-1 text-[10px] leading-none">
              {t('nav.following', 'Following')}
            </span>
          </button>

          {/* 5. Studio Tab */}
          <button
            onClick={onOpenStudio}
            className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[46px] rounded-lg transition-colors ${
              currentPage === 'studio'
                ? 'text-[var(--ink)] font-semibold'
                : 'text-[var(--ink-medium)] hover:text-[var(--ink)] font-medium'
            }`}
          >
            <LayoutGrid
              className={`h-5 w-5 ${
                currentPage === 'studio' ? 'text-[var(--ink)]' : ''
              }`}
            />
            <span className="mt-1 text-[10px] leading-none">
              {t('nav.studioShort', 'Studio')}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
