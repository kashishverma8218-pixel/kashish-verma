import React from 'react';
import {
  Home,
  Flame,
  Tv,
  History,
  Clock,
  ThumbsUp,
  ChevronRight,
  LayoutDashboard,
  X,
  Sparkles,
  Cpu,
  Moon,
  Sun,
  Sliders,
  Keyboard,
  Video,
  Play,
  User,
  LogIn,
  LogOut,
  Settings,
  Rss,
  Check
} from 'lucide-react';
import { Channel } from '../types/video';
import { useAuth } from '../context/AuthContext';
import { VioLogo } from './VioLogo';

export type NavigationPage =
  | 'home'
  | 'customFeed'
  | 'reels'
  | 'trending'
  | 'subscriptions'
  | 'history'
  | 'liked'
  | 'watchLater'
  | 'channel'
  | 'studio';

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  channels: Channel[];
  onSelectChannel: (channelId: string) => void;
  isCollapsed: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
  onOpenFilters?: () => void;
  onOpenShortcuts?: () => void;
  onOpenCreate?: () => void;
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  autoplayNext?: boolean;
  onToggleAutoplay?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  channels,
  onSelectChannel,
  isCollapsed,
  mobileOpen = false,
  onCloseMobile,
  isDarkMode = false,
  toggleDarkMode,
  onOpenFilters,
  onOpenShortcuts,
  onOpenCreate,
  onOpenAuth,
  onOpenProfile,
  onOpenSettings,
  autoplayNext = true,
  onToggleAutoplay,
}) => {
  const { currentUser, userProfile, signOutUser } = useAuth();
  const subscribedChannels = channels.filter((c) => c.isSubscribed);

  const handleNav = (page: NavigationPage) => {
    onNavigate(page);
    onCloseMobile?.();
  };

  const handleChannelSelect = (channelId: string) => {
    onSelectChannel(channelId);
    onCloseMobile?.();
  };

  return (
    <>
      {/* COLLAPSIBLE SIDE DRAWER (Accessible via Hamburger Icon on mobile & desktop) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />

          {/* Off-canvas slide-in Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-white dark:bg-slate-950 p-4 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-left duration-200 border-r border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
              <VioLogo size="sm" />
              <button
                onClick={onCloseMobile}
                aria-label="Close menu drawer"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Account / Profile Section */}
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              {currentUser ? (
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={userProfile?.photoURL || currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                      alt="Avatar"
                      className="h-9 w-9 rounded-full object-cover shrink-0 ring-1 ring-slate-300 dark:ring-slate-700"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {userProfile?.displayName || currentUser.displayName || 'Creator'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {userProfile?.handle || currentUser.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {onOpenProfile && (
                      <button
                        onClick={() => {
                          onCloseMobile?.();
                          onOpenProfile();
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        title="Profile settings"
                      >
                        <User className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        signOutUser();
                        onCloseMobile?.();
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                    Sign in to follow channels, save playlists, and track video earnings.
                  </p>
                  <button
                    onClick={() => {
                      onCloseMobile?.();
                      onOpenAuth?.();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-500 transition-all active:scale-95"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In to Vio</span>
                  </button>
                </div>
              )}
            </div>

            {/* Primary Nav Links */}
            <div className="space-y-1 py-3 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleNav('home')}
                className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  currentPage === 'home'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <Home className={`h-4 w-4 ${currentPage === 'home' ? 'text-red-600 fill-red-600' : ''}`} />
                <span>Home</span>
              </button>

              <button
                onClick={() => handleNav('customFeed')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  currentPage === 'customFeed'
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Cpu className="h-4 w-4 text-purple-500" />
                  <span>Custom Feed</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold">
                  AI Curated
                </span>
              </button>

              <button
                onClick={() => handleNav('reels')}
                className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  currentPage === 'reels'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className={`h-4 w-4 ${currentPage === 'reels' ? 'text-red-600 fill-red-600' : 'text-red-500'}`} />
                <span>Reels & Shorts</span>
              </button>

              <button
                onClick={() => handleNav('trending')}
                className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  currentPage === 'trending'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <Flame className={`h-4 w-4 ${currentPage === 'trending' ? 'text-amber-500 fill-amber-500' : 'text-amber-500'}`} />
                <span>Trending Now</span>
              </button>

              <button
                onClick={() => handleNav('subscriptions')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  currentPage === 'subscriptions'
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Tv className="h-4 w-4 text-sky-500" />
                  <span>Following Channels</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {subscribedChannels.length}
                </span>
              </button>

              <button
                onClick={() => handleNav('studio')}
                className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  currentPage === 'studio'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="h-4 w-4 text-red-500" />
                <span>Creator Studio (30% Split)</span>
              </button>

              {/* Upload Video Button */}
              {onOpenCreate && (
                <button
                  onClick={() => {
                    onCloseMobile?.();
                    onOpenCreate();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-red-600/10 text-red-600 dark:bg-red-950/50 dark:text-red-400 hover:bg-red-600/20 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <Video className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span>Upload Video</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-600 text-white font-bold">
                    Create
                  </span>
                </button>
              )}
            </div>

            {/* Secondary Settings & Preferences Section */}
            <div className="space-y-1.5 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Settings className="h-3 w-3" />
                <span>Settings & Preferences</span>
              </div>

              {/* Settings Modal Launcher */}
              {onOpenSettings && (
                <button
                  onClick={() => {
                    onCloseMobile?.();
                    onOpenSettings();
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <Settings className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-semibold">Settings Hub (YouTube Style)</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}

              {/* Theme Toggle */}
              {toggleDarkMode && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    {isDarkMode ? (
                      <Moon className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Sun className="h-4 w-4 text-amber-500" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">Dark Theme</div>
                      <div className="text-[10px] text-slate-400">{isDarkMode ? 'Night cinema mode' : 'Day mode'}</div>
                    </div>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    aria-label="Toggle theme"
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isDarkMode ? 'bg-red-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        isDarkMode ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Video Filter Pipeline Shortcut */}
              {onOpenFilters && (
                <button
                  onClick={() => {
                    onCloseMobile?.();
                    onOpenFilters();
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <Sliders className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-medium">Video Processing & LUTs</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}

              {/* Keyboard Shortcuts Shortcut */}
              {onOpenShortcuts && (
                <button
                  onClick={() => {
                    onCloseMobile?.();
                    onOpenShortcuts();
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <Keyboard className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-medium">Keyboard Shortcuts</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Channels Followed List */}
            <div className="py-3 flex-1">
              <div className="flex items-center justify-between px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>Following ({subscribedChannels.length})</span>
                <span className="text-[10px] text-red-500 font-semibold">LIVE</span>
              </div>

              {subscribedChannels.length === 0 ? (
                <p className="px-3.5 py-2 text-xs text-slate-400">
                  No channels followed yet. Hit Follow on any video to see updates here!
                </p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {subscribedChannels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => handleChannelSelect(channel.id)}
                      className="group flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={channel.avatar}
                          alt={channel.name}
                          className="h-6 w-6 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                        <span className="truncate group-hover:text-red-500 transition-colors">
                          {channel.name}
                        </span>
                      </div>
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              Vio Video Streaming Platform · 2026
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      {isCollapsed ? (
        /* Collapsed Icon-Only Desktop Rail */
        <aside className="sticky top-14 z-30 hidden md:flex flex-col items-center border-r border-slate-200/80 bg-white/95 py-3 dark:border-slate-800/80 dark:bg-slate-950/95 transition-all w-18 shrink-0 h-[calc(100vh-3.5rem)] overflow-y-auto px-1.5 space-y-1">
          <button
            onClick={() => onNavigate('home')}
            className={`flex flex-col items-center gap-1 rounded-xl p-2.5 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'home'
                ? 'text-red-600 dark:text-red-500 bg-red-500/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => onNavigate('customFeed')}
            className={`flex flex-col items-center gap-1 rounded-xl p-2.5 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'customFeed'
                ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Cpu className="h-5 w-5 text-purple-500" />
            <span>Feed</span>
          </button>

          <button
            onClick={() => onNavigate('reels')}
            className={`flex flex-col items-center gap-1 rounded-xl p-2.5 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'reels'
                ? 'text-red-600 dark:text-red-500 bg-red-500/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="h-5 w-5 text-red-500" />
            <span>Reels</span>
          </button>

          <button
            onClick={() => onNavigate('trending')}
            className={`flex flex-col items-center gap-1 rounded-xl p-2.5 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'trending'
                ? 'text-red-600 dark:text-red-500 bg-red-500/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Flame className="h-5 w-5" />
            <span>Trending</span>
          </button>

          <button
            onClick={() => onNavigate('subscriptions')}
            className={`flex flex-col items-center gap-1 rounded-xl p-2.5 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'subscriptions'
                ? 'text-red-600 dark:text-red-500 bg-red-500/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Tv className="h-5 w-5" />
            <span>Following</span>
          </button>

          <button
            onClick={() => onNavigate('history')}
            className={`flex flex-col items-center gap-1 rounded-xl p-2.5 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'history'
                ? 'text-red-600 dark:text-red-500 bg-red-500/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <History className="h-5 w-5" />
            <span>You</span>
          </button>

          <button
            onClick={() => onNavigate('studio')}
            className={`flex flex-col items-center gap-1 rounded-xl p-2.5 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'studio'
                ? 'text-red-600 dark:text-red-500 bg-red-500/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="h-5 w-5 text-red-500" />
            <span>Studio</span>
          </button>
        </aside>
      ) : (
        /* Expanded full sidebar (Desktop only) */
        <aside className="sticky top-14 z-30 hidden md:flex flex-col border-r border-slate-200/80 bg-white/95 px-3 py-4 dark:border-slate-800/80 dark:bg-slate-950/95 transition-all w-60 shrink-0 h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-thin">
          {/* Primary Discovery Links */}
          <div className="space-y-1 pb-3 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => onNavigate('home')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                currentPage === 'home'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <Home className={`h-4 w-4 ${currentPage === 'home' ? 'text-red-600 fill-red-600' : ''}`} />
              <span>Home</span>
            </button>

            <button
              onClick={() => onNavigate('customFeed')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                currentPage === 'customFeed'
                  ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <Cpu className="h-4 w-4 text-purple-500" />
              <span>Custom Feed</span>
            </button>

            <button
              onClick={() => onNavigate('reels')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                currentPage === 'reels'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className={`h-4 w-4 ${currentPage === 'reels' ? 'text-red-600 fill-red-600' : 'text-red-500'}`} />
              <span>Reels</span>
            </button>

            <button
              onClick={() => onNavigate('trending')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                currentPage === 'trending'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <Flame className={`h-4 w-4 ${currentPage === 'trending' ? 'text-amber-500 fill-amber-500' : ''}`} />
              <span>Trending</span>
            </button>

            <button
              onClick={() => onNavigate('subscriptions')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                currentPage === 'subscriptions'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <Tv className={`h-4 w-4 ${currentPage === 'subscriptions' ? 'text-sky-500' : ''}`} />
              <span>Following</span>
            </button>
          </div>

          {/* Library / "You" Section */}
          <div className="space-y-1 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>You</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>

            <button
              onClick={() => onNavigate('history')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                currentPage === 'history'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </button>

            <button
              onClick={() => onNavigate('watchLater')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                currentPage === 'watchLater'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Watch Later</span>
            </button>

            <button
              onClick={() => onNavigate('liked')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                currentPage === 'liked'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
              <span>Liked Videos</span>
            </button>

            <button
              onClick={() => onNavigate('studio')}
              className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                currentPage === 'studio'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-red-500" />
              <span>Creator Studio</span>
            </button>
          </div>

          {/* Following List */}
          <div className="py-3 flex-1">
            <div className="px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Following ({subscribedChannels.length})
            </div>

            {subscribedChannels.length === 0 ? (
              <p className="px-3.5 py-2 text-xs text-slate-400">
                No channels followed yet. Browse channels and hit Follow!
              </p>
            ) : (
              <div className="mt-1 space-y-0.5">
                {subscribedChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    className="group flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={channel.avatar}
                        alt={channel.name}
                        className="h-6 w-6 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                      />
                      <span className="truncate group-hover:text-red-500 transition-colors">
                        {channel.name}
                      </span>
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings in desktop sidebar bottom */}
          {onOpenSettings && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={onOpenSettings}
                className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Settings className="h-4 w-4 text-slate-500" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </aside>
      )}
    </>
  );
};
