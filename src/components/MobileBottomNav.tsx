import React from 'react';
import { Home, Sparkles, LayoutDashboard, Plus, Tv } from 'lucide-react';
import { NavigationPage } from './Sidebar';

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: NavigationPage) => void;
  onOpenStudio: () => void;
  onOpenCreate: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  onNavigate,
  onOpenStudio,
  onOpenCreate,
}) => {
  return (
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
          <Home
            className={`h-5 w-5 ${
              currentPage === 'home' ? 'text-[var(--ink)]' : ''
            }`}
          />
          <span className="mt-1 text-[10px] leading-none">
            Home
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
            Reels
          </span>
        </button>

        {/* 3. Center + Create Action */}
        <button
          onClick={onOpenCreate}
          aria-label="Create Content"
          title="Create Content"
          className="flex flex-col items-center justify-center active:scale-95 transition-transform px-2 py-0.5 min-w-[56px] min-h-[46px]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--card-hover)] border border-[var(--ink-faint)] text-[var(--ink)] transition-colors">
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
            Following
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
          <LayoutDashboard
            className={`h-5 w-5 ${
              currentPage === 'studio' ? 'text-[var(--ink)]' : ''
            }`}
          />
          <span className="mt-1 text-[10px] leading-none">
            Studio
          </span>
        </button>
      </div>
    </nav>
  );
};
