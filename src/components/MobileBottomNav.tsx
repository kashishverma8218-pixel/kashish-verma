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
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-slate-200/90 bg-white/95 backdrop-blur-xl px-2 py-1.5 shadow-2xl dark:border-slate-800/90 dark:bg-slate-950/95 transition-colors"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* 1. Home Tab */}
        <button
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] min-h-[48px] rounded-2xl transition-all ${
            currentPage === 'home'
              ? 'text-red-600 dark:text-red-500 font-bold bg-red-500/10'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Home
            className={`h-5 w-5 transition-transform ${
              currentPage === 'home' ? 'scale-110 text-red-600 dark:text-red-500 fill-red-600/20' : ''
            }`}
          />
          <span className="mt-1.5 text-[10px] tracking-tight leading-none font-semibold">
            Home
          </span>
        </button>

        {/* 2. Reels Tab */}
        <button
          onClick={() => onNavigate('reels')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] min-h-[48px] rounded-2xl transition-all ${
            currentPage === 'reels'
              ? 'text-red-600 dark:text-red-500 font-bold bg-red-500/10'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Sparkles
            className={`h-5 w-5 transition-transform ${
              currentPage === 'reels' ? 'scale-110 text-red-600 dark:text-red-500' : ''
            }`}
          />
          <span className="mt-1.5 text-[10px] tracking-tight leading-none font-semibold">
            Reels
          </span>
        </button>

        {/* 3. Center Create Action */}
        <button
          onClick={onOpenCreate}
          aria-label="Create Content"
          title="Create Content"
          className="flex flex-col items-center justify-center group active:scale-95 transition-transform px-2 py-0.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-red-600 via-rose-600 to-red-500 text-white shadow-lg shadow-red-600/30 ring-2 ring-white/30 dark:ring-black/40 group-hover:scale-105 transition-all">
            <Plus className="h-5 w-5 stroke-[2.75] text-white" />
          </div>
          <span className="mt-1 text-[9px] font-bold text-red-600 dark:text-red-400 tracking-tight leading-none uppercase">
            Create
          </span>
        </button>

        {/* 4. Following Tab */}
        <button
          onClick={() => onNavigate('subscriptions')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] min-h-[48px] rounded-2xl transition-all ${
            currentPage === 'subscriptions'
              ? 'text-red-600 dark:text-red-500 font-bold bg-red-500/10'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Tv
            className={`h-5 w-5 transition-transform ${
              currentPage === 'subscriptions' ? 'scale-110 text-red-600 dark:text-red-500' : ''
            }`}
          />
          <span className="mt-1.5 text-[10px] tracking-tight leading-none font-semibold">
            Following
          </span>
        </button>

        {/* 5. Studio Tab */}
        <button
          onClick={onOpenStudio}
          className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] min-h-[48px] rounded-2xl transition-all ${
            currentPage === 'studio'
              ? 'text-red-600 dark:text-red-500 font-bold bg-red-500/10'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <LayoutDashboard
            className={`h-5 w-5 transition-transform ${
              currentPage === 'studio' ? 'scale-110 text-red-600 dark:text-red-500' : ''
            }`}
          />
          <span className="mt-1.5 text-[10px] tracking-tight leading-none font-semibold">
            Studio
          </span>
        </button>
      </div>
    </nav>
  );
};
