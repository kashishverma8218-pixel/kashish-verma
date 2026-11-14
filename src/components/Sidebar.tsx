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
  User,
  LogOut,
  Settings,
  UserCircle2
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
  onOpenAuth,
  onOpenProfile,
  onOpenSettings,
}) => {
  const { currentUser, userProfile, signOutUser } = useAuth();
  const followedChannels = channels.filter((c) => c.isSubscribed);

  const handleNav = (page: NavigationPage) => {
    onNavigate(page);
    onCloseMobile?.();
  };

  const handleChannelSelect = (channelId: string) => {
    onSelectChannel(channelId);
    onCloseMobile?.();
  };

  const navItemClass = (active: boolean) =>
    `flex w-full items-center gap-5 px-3 py-2.5 rounded-[10px] text-[14px] transition-colors whitespace-nowrap ${
      active
        ? 'bg-[var(--card-hover)] text-[var(--ink)] font-semibold'
        : 'text-[var(--ink)]/90 font-normal hover:bg-[var(--card-hover)]/70'
    }`;

  const renderFullGuideSections = (isMobileDrawer: boolean) => (
    <>
      {/* 1. Primary Group: Home, Reels, Following */}
      <div className="space-y-0.5">
        <button
          onClick={() => (isMobileDrawer ? handleNav('home') : onNavigate('home'))}
          className={navItemClass(currentPage === 'home')}
        >
          <Home className="h-5 w-5 shrink-0" />
          <span>Home</span>
        </button>

        <button
          onClick={() => (isMobileDrawer ? handleNav('reels') : onNavigate('reels'))}
          className={navItemClass(currentPage === 'reels')}
        >
          <Sparkles className="h-5 w-5 shrink-0" />
          <span>Shorts & Reels</span>
        </button>

        <button
          onClick={() => (isMobileDrawer ? handleNav('subscriptions') : onNavigate('subscriptions'))}
          className={navItemClass(currentPage === 'subscriptions')}
        >
          <Tv className="h-5 w-5 shrink-0" />
          <span>Following</span>
        </button>
      </div>

      <div className="my-3 border-t border-[var(--ink-faint)]" />

      {/* 2. You > Section */}
      <div className="space-y-0.5">
        <button
          onClick={() => (isMobileDrawer ? handleNav('history') : onNavigate('history'))}
          className="flex w-full items-center gap-1.5 px-3 py-2 rounded-[10px] text-[15px] font-semibold text-[var(--ink)] hover:bg-[var(--card-hover)]/70 transition-colors"
        >
          <span>You</span>
          <ChevronRight className="h-4 w-4 text-[var(--ink-medium)]" />
        </button>

        <button
          onClick={() => (isMobileDrawer ? handleNav('history') : onNavigate('history'))}
          className={navItemClass(currentPage === 'history')}
        >
          <History className="h-5 w-5 shrink-0" />
          <span>History</span>
        </button>

        <button
          onClick={() => (isMobileDrawer ? handleNav('watchLater') : onNavigate('watchLater'))}
          className={navItemClass(currentPage === 'watchLater')}
        >
          <Clock className="h-5 w-5 shrink-0" />
          <span>Watch later</span>
        </button>

        <button
          onClick={() => (isMobileDrawer ? handleNav('liked') : onNavigate('liked'))}
          className={navItemClass(currentPage === 'liked')}
        >
          <ThumbsUp className="h-5 w-5 shrink-0" />
          <span>Liked videos</span>
        </button>

        <button
          onClick={() => (isMobileDrawer ? handleNav('studio') : onNavigate('studio'))}
          className={navItemClass(currentPage === 'studio')}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          <span>Creator Studio</span>
        </button>
      </div>

      <div className="my-3 border-t border-[var(--ink-faint)]" />

      {/* 3. Following Channels Section */}
      <div className="space-y-0.5">
        <div className="px-3 py-1.5 text-[15px] font-semibold text-[var(--ink)]">
          Following
        </div>

        {followedChannels.length === 0 ? (
          <p className="px-3 py-1.5 text-xs text-[var(--ink-medium)] leading-relaxed">
            Follow channels to keep up with new uploads here.
          </p>
        ) : (
          <div className="space-y-0.5">
            {followedChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => (isMobileDrawer ? handleChannelSelect(channel.id) : onSelectChannel(channel.id))}
                className="flex w-full items-center gap-4 px-3 py-2 rounded-[10px] text-[14px] text-[var(--ink)]/90 hover:bg-[var(--card-hover)]/70 transition-colors"
              >
                <img
                  src={channel.avatar}
                  alt={channel.name}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded-full object-cover shrink-0"
                />
                <span className="truncate">{channel.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-3 border-t border-[var(--ink-faint)]" />

      {/* 4. Explore Section */}
      <div className="space-y-0.5">
        <div className="px-3 py-1.5 text-[15px] font-semibold text-[var(--ink)]">
          Explore
        </div>

        <button
          onClick={() => (isMobileDrawer ? handleNav('trending') : onNavigate('trending'))}
          className={navItemClass(currentPage === 'trending')}
        >
          <Flame className="h-5 w-5 shrink-0" />
          <span>Trending</span>
        </button>

        <button
          onClick={() => (isMobileDrawer ? handleNav('customFeed') : onNavigate('customFeed'))}
          className={navItemClass(currentPage === 'customFeed')}
        >
          <Cpu className="h-5 w-5 shrink-0" />
          <span>Custom Feed</span>
        </button>
      </div>

      <div className="my-3 border-t border-[var(--ink-faint)]" />

      {/* 5. Settings & Tools Section */}
      <div className="space-y-0.5">
        {onOpenSettings && (
          <button
            onClick={() => {
              if (isMobileDrawer) onCloseMobile?.();
              onOpenSettings();
            }}
            className={navItemClass(false)}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span>Settings</span>
          </button>
        )}

        {toggleDarkMode && (
          <button
            onClick={toggleDarkMode}
            className="flex w-full items-center justify-between px-3 py-2.5 rounded-[10px] text-[14px] text-[var(--ink)]/90 hover:bg-[var(--card-hover)]/70 transition-colors"
          >
            <div className="flex items-center gap-5">
              {isDarkMode ? (
                <Moon className="h-5 w-5 shrink-0" />
              ) : (
                <Sun className="h-5 w-5 shrink-0" />
              )}
              <span>Appearance: {isDarkMode ? 'Dark' : 'Light'}</span>
            </div>
          </button>
        )}

        {onOpenFilters && (
          <button
            onClick={() => {
              if (isMobileDrawer) onCloseMobile?.();
              onOpenFilters();
            }}
            className={navItemClass(false)}
          >
            <Sliders className="h-5 w-5 shrink-0" />
            <span>Video Filters</span>
          </button>
        )}

        {onOpenShortcuts && (
          <button
            onClick={() => {
              if (isMobileDrawer) onCloseMobile?.();
              onOpenShortcuts();
            }}
            className={navItemClass(false)}
          >
            <Keyboard className="h-5 w-5 shrink-0" />
            <span>Keyboard Shortcuts</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pt-4 pb-2 text-[11px] text-[var(--ink-medium)]">
        Vio streaming · 2026
      </div>
    </>
  );

  return (
    <>
      {/* MOBILE / TABLET SLIDE-OUT GUIDE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />

          <aside className="fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] bg-[var(--bg)] px-3 py-2 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-left duration-200">
            {/* Drawer Header matching top bar */}
            <div className="flex items-center gap-3 h-12 px-1 mb-2">
              <button
                onClick={onCloseMobile}
                aria-label="Close navigation guide"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              <VioLogo size="sm" />
            </div>

            {/* Mobile Account Quick Card */}
            <div className="mb-3 px-1">
              {currentUser ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--ink-faint)]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={userProfile?.photoURL || currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-[var(--ink)] truncate">
                        {userProfile?.displayName || currentUser.displayName || 'Creator'}
                      </div>
                      <div className="text-[11px] text-[var(--ink-medium)] truncate">
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
                        className="p-1.5 rounded-full text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)]"
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
                      className="p-1.5 rounded-full text-[var(--ink-medium)] hover:text-rose-500 hover:bg-rose-500/10"
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--ink-faint)] space-y-2.5">
                  <p className="text-xs text-[var(--ink-medium)] leading-snug">
                    Sign in to like videos, comment, and follow channels.
                  </p>
                  <button
                    onClick={() => {
                      onCloseMobile?.();
                      onOpenAuth?.();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-faint)] px-3.5 py-1.5 text-xs font-medium text-[#3EA6FF] hover:bg-[#3EA6FF]/10 transition-colors"
                  >
                    <UserCircle2 className="h-4 w-4" />
                    <span>Sign in</span>
                  </button>
                </div>
              )}
            </div>

            {renderFullGuideSections(true)}
          </aside>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      {isCollapsed ? (
        /* YouTube 72px Mini Guide Rail */
        <aside className="sticky top-14 z-30 hidden md:flex flex-col items-center bg-[var(--bg)] py-2 w-[72px] shrink-0 h-[calc(100vh-56px)] overflow-y-auto px-1 gap-1">
          <button
            onClick={() => onNavigate('home')}
            className={`flex flex-col items-center justify-center rounded-[10px] py-3.5 px-1 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'home'
                ? 'text-[var(--ink)] bg-[var(--card-hover)] font-semibold'
                : 'text-[var(--ink-medium)] hover:bg-[var(--card-hover)]/70 hover:text-[var(--ink)]'
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="mt-1.5">Home</span>
          </button>

          <button
            onClick={() => onNavigate('reels')}
            className={`flex flex-col items-center justify-center rounded-[10px] py-3.5 px-1 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'reels'
                ? 'text-[var(--ink)] bg-[var(--card-hover)] font-semibold'
                : 'text-[var(--ink-medium)] hover:bg-[var(--card-hover)]/70 hover:text-[var(--ink)]'
            }`}
          >
            <Sparkles className="h-5 w-5" />
            <span className="mt-1.5">Reels</span>
          </button>

          <button
            onClick={() => onNavigate('subscriptions')}
            className={`flex flex-col items-center justify-center rounded-[10px] py-3.5 px-1 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'subscriptions'
                ? 'text-[var(--ink)] bg-[var(--card-hover)] font-semibold'
                : 'text-[var(--ink-medium)] hover:bg-[var(--card-hover)]/70 hover:text-[var(--ink)]'
            }`}
          >
            <Tv className="h-5 w-5" />
            <span className="mt-1.5">Following</span>
          </button>

          <button
            onClick={() => onNavigate('history')}
            className={`flex flex-col items-center justify-center rounded-[10px] py-3.5 px-1 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'history' || currentPage === 'liked' || currentPage === 'watchLater'
                ? 'text-[var(--ink)] bg-[var(--card-hover)] font-semibold'
                : 'text-[var(--ink-medium)] hover:bg-[var(--card-hover)]/70 hover:text-[var(--ink)]'
            }`}
          >
            <UserCircle2 className="h-5 w-5" />
            <span className="mt-1.5">You</span>
          </button>

          <button
            onClick={() => onNavigate('studio')}
            className={`flex flex-col items-center justify-center rounded-[10px] py-3.5 px-1 w-full text-[10px] font-medium transition-colors ${
              currentPage === 'studio'
                ? 'text-[var(--ink)] bg-[var(--card-hover)] font-semibold'
                : 'text-[var(--ink-medium)] hover:bg-[var(--card-hover)]/70 hover:text-[var(--ink)]'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="mt-1.5">Studio</span>
          </button>
        </aside>
      ) : (
        /* YouTube 240px Expanded Guide */
        <aside className="sticky top-14 z-30 hidden md:flex flex-col bg-[var(--bg)] px-3 py-3 w-[240px] shrink-0 h-[calc(100vh-56px)] overflow-y-auto scrollbar-thin">
          {renderFullGuideSections(false)}
        </aside>
      )}
    </>
  );
};
