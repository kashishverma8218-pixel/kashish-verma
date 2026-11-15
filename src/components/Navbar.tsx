import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Mic,
  Bell,
  X,
  User,
  LogOut,
  LayoutDashboard,
  ArrowLeft,
  Settings,
  Plus,
  UserCircle2,
  History as HistoryIcon,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationsPanel } from './NotificationsPanel';
import { NotificationItem, VideoItem, Channel } from '../types/video';
import { VioLogo } from './VioLogo';

interface NavbarProps {
  onToggleSidebar: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit: (overrideQuery?: string) => void;
  onNavigateHome: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenStudio: () => void;
  onOpenSettings?: () => void;
  onOpenCreate?: () => void;
  notifications: NotificationItem[];
  onMarkAllNotificationsRead: () => void;
  onToggleNotificationRead: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onSelectVideo: (videoId: string) => void;
  onSelectChannel: (channelId: string) => void;
  onSimulateNotification: () => void;
  hideOnMobile?: boolean;
  searchHistory?: string[];
  onRemoveSearchHistoryItem?: (term: string) => void;
  videos?: VideoItem[];
  channels?: Channel[];
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onNavigateHome,
  onOpenAuth,
  onOpenProfile,
  onOpenStudio,
  onOpenSettings,
  onOpenCreate,
  notifications,
  onMarkAllNotificationsRead,
  onToggleNotificationRead,
  onDeleteNotification,
  onSelectVideo,
  onSelectChannel,
  onSimulateNotification,
  hideOnMobile = false,
  searchHistory = [],
  onRemoveSearchHistoryItem,
  videos = [],
  channels = [],
}) => {
  const { currentUser, userProfile, signOutUser } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [voiceSearchActive, setVoiceSearchActive] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState('Listening... Speak now');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const recognitionRef = useRef<any>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!showUserMenu && !searchFocused) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showUserMenu, searchFocused]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchedVideos = trimmedQuery
    ? videos
        .filter(
          (v) =>
            v.title.toLowerCase().includes(trimmedQuery) ||
            v.category.toLowerCase().includes(trimmedQuery)
        )
        .slice(0, 5)
    : [];
  const matchedChannels = trimmedQuery
    ? channels
        .filter(
          (c) =>
            c.name.toLowerCase().includes(trimmedQuery) ||
            c.handle.toLowerCase().includes(trimmedQuery)
        )
        .slice(0, 2)
    : [];
  const filteredHistory = searchHistory
    .filter((item) => !trimmedQuery || item.toLowerCase().includes(trimmedQuery))
    .slice(0, 5);
  const hasSuggestions =
    filteredHistory.length > 0 || matchedVideos.length > 0 || matchedChannels.length > 0;

  const triggerSearch = (term?: string) => {
    const finalTerm = typeof term === 'string' ? term : searchQuery;
    if (typeof term === 'string') {
      setSearchQuery(term);
    }
    setSearchFocused(false);
    setMobileSearchOpen(false);
    onSearchSubmit(finalTerm);
  };

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      triggerSearch();
    } else if (e.key === 'Escape') {
      setSearchFocused(false);
      setMobileSearchOpen(false);
    }
  };

  const handleVoiceSearch = () => {
    if (voiceSearchActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setVoiceSearchActive(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        setVoiceStatusText('Listening... Speak now');
        setVoiceSearchActive(true);

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0]?.transcript || '';
          if (transcript) {
            setSearchQuery(transcript);
            setVoiceStatusText(`Heard: "${transcript}"`);
            if (event.results[0].isFinal) {
              setTimeout(() => {
                setVoiceSearchActive(false);
                onSearchSubmit();
                setMobileSearchOpen(false);
              }, 400);
            }
          }
        };

        recognition.onerror = () => {
          fallbackVoiceSearch();
        };

        recognition.onend = () => {
          setVoiceSearchActive(false);
        };

        recognition.start();
        return;
      } catch {
        fallbackVoiceSearch();
      }
    } else {
      fallbackVoiceSearch();
    }
  };

  const fallbackVoiceSearch = () => {
    setVoiceSearchActive(true);
    setVoiceStatusText('Listening to voice sample...');
    setTimeout(() => {
      setSearchQuery('Big Buck Bunny 4K Animation');
      setVoiceSearchActive(false);
      onSearchSubmit();
      setMobileSearchOpen(false);
    }, 1200);
  };

  const avatarUrl =
    userProfile?.photoURL ||
    currentUser?.photoURL ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  return (
    <header
      className={`sticky top-0 z-40 w-full h-14 bg-[var(--bg)]/95 backdrop-blur-md px-3 sm:px-4 transition-colors items-center ${
        hideOnMobile ? 'hidden md:flex' : 'flex'
      }`}
    >
      {/* MOBILE SEARCH OVERLAY MODE */}
      {mobileSearchOpen ? (
        <div className="relative flex w-full items-center gap-2 animate-in fade-in duration-150">
          <button
            onClick={() => setMobileSearchOpen(false)}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="relative flex flex-1 items-center">
            <input
              type="text"
              autoFocus
              placeholder="Search Vio streaming"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKey}
              className="w-full rounded-full border border-[var(--ink-faint)] bg-[var(--surface)] py-2 pl-4 pr-9 text-base sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:border-[var(--link)] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 text-[var(--ink-medium)] hover:text-[var(--ink)] p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {hasSuggestions && (
              <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] py-2 shadow-2xl max-h-72 overflow-y-auto">
                {filteredHistory.map((term) => (
                  <div
                    key={`m-hist-${term}`}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-[var(--card-hover)]"
                  >
                    <button
                      type="button"
                      onClick={() => triggerSearch(term)}
                      className="flex flex-1 items-center gap-2.5 text-left text-xs text-[var(--ink)] min-w-0 cursor-pointer"
                    >
                      <HistoryIcon className="h-4 w-4 text-[var(--ink-medium)] shrink-0" />
                      <span className="truncate">{term}</span>
                    </button>
                    {onRemoveSearchHistoryItem && (
                      <button
                        type="button"
                        onClick={() => onRemoveSearchHistoryItem(term)}
                        aria-label={`Remove ${term}`}
                        className="p-1 text-[var(--ink-medium)] hover:text-[var(--ink)]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {matchedVideos.map((vid) => (
                  <button
                    key={`m-vid-${vid.id}`}
                    type="button"
                    onClick={() => {
                      setMobileSearchOpen(false);
                      onSelectVideo(vid.id);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs text-[var(--ink)] hover:bg-[var(--card-hover)] cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5 text-[var(--ink-medium)] shrink-0" />
                    <span className="truncate flex-1">{vid.title}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--ink-medium)] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => triggerSearch()}
            title="Search"
            aria-label="Submit search"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--card-hover)] hover:bg-[var(--ink-faint)] text-[var(--ink)] transition-colors shrink-0"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            onClick={handleVoiceSearch}
            title="Voice search"
            aria-label="Voice search"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              voiceSearchActive
                ? 'bg-[#FF0000] text-white animate-pulse'
                : 'bg-[var(--card-hover)] text-[var(--ink)] hover:bg-[var(--ink-faint)]'
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-2 sm:gap-4">
          {/* Left Section: YouTube-style Hamburger + Vio Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onToggleSidebar}
              aria-label="Toggle navigation guide"
              title="Toggle menu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={onNavigateHome}
              aria-label="Vio streaming Home"
              className="flex items-center focus:outline-none group overflow-visible py-0.5 cursor-pointer"
            >
              <VioLogo size="md" />
            </button>
          </div>

          {/* Center Section: YouTube Connected Pill Search Bar + Circular Mic + Autocomplete Dropdown */}
          <div ref={searchBoxRef} className="hidden sm:flex flex-1 max-w-[620px] items-center justify-center px-2">
            <div className="relative flex w-full items-center">
              <div className="relative flex flex-1 items-center h-10">
                <div className="flex flex-1 items-center h-full rounded-l-full border border-[var(--ink-faint)] focus-within:border-[var(--link)] bg-[var(--bg)] pl-4 pr-2 transition-colors">
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onFocus={() => setSearchFocused(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchFocused(true);
                    }}
                    onKeyDown={handleSearchKey}
                    className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => triggerSearch()}
                  title="Search"
                  aria-label="Search"
                  className="flex h-full w-16 items-center justify-center rounded-r-full border border-l-0 border-[var(--ink-faint)] bg-[var(--card-hover)] hover:bg-[var(--ink-faint)] text-[var(--ink)] transition-colors shrink-0 cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                </button>

                {/* Desktop Search Suggestions & Recent History */}
                {searchFocused && hasSuggestions && (
                  <div className="absolute left-0 right-0 top-11 z-50 rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] py-2 shadow-2xl max-h-80 overflow-y-auto animate-in fade-in duration-100">
                    {filteredHistory.map((term) => (
                      <div
                        key={`d-hist-${term}`}
                        className="flex items-center justify-between px-4 py-2 hover:bg-[var(--card-hover)] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => triggerSearch(term)}
                          className="flex flex-1 items-center gap-3 text-left text-xs font-medium text-[var(--ink)] min-w-0 cursor-pointer"
                        >
                          <HistoryIcon className="h-4 w-4 text-[var(--ink-medium)] shrink-0" />
                          <span className="truncate">{term}</span>
                        </button>
                        {onRemoveSearchHistoryItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveSearchHistoryItem(term)}
                            aria-label={`Remove ${term} from search history`}
                            className="p-1 text-[var(--ink-medium)] hover:text-[var(--ink)] cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {matchedChannels.map((ch) => (
                      <button
                        key={`d-ch-${ch.id}`}
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          onSelectChannel(ch.id);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                      >
                        <img
                          src={ch.avatar}
                          alt={ch.name}
                          referrerPolicy="no-referrer"
                          className="h-5 w-5 rounded-full object-cover shrink-0"
                        />
                        <span className="font-semibold text-[var(--ink)] truncate">{ch.name}</span>
                        <span className="text-[11px] text-[var(--ink-medium)] truncate">{ch.handle}</span>
                      </button>
                    ))}

                    {matchedVideos.map((vid) => (
                      <button
                        key={`d-vid-${vid.id}`}
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          onSelectVideo(vid.id);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                      >
                        <Search className="h-4 w-4 text-[var(--ink-medium)] shrink-0" />
                        <span className="truncate flex-1">{vid.title}</span>
                        <span className="text-[11px] text-[var(--ink-medium)] shrink-0">{vid.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleVoiceSearch}
                title="Search with your voice"
                aria-label="Search with your voice"
                className={`ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                  voiceSearchActive
                    ? 'bg-[#FF0000] text-white animate-pulse'
                    : 'bg-[var(--card-hover)] text-[var(--ink)] hover:bg-[var(--ink-faint)]'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>

              {/* Active Voice Search Tooltip */}
              {voiceSearchActive && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#212121] text-[#F1F1F1] px-4 py-2 rounded-full border border-white/15 text-xs shadow-xl animate-in fade-in slide-in-from-top-1 whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-[#FF0000] animate-ping" />
                  <span>{voiceStatusText}</span>
                  <button
                    onClick={() => setVoiceSearchActive(false)}
                    className="ml-1 text-white/60 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Mobile Search, + Create Pill, Bell, Avatar / Sign In Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Mobile Search Trigger */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
              className="flex sm:hidden h-10 w-10 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* + Create Pill Button (YouTube style) */}
            {onOpenCreate && (
              <button
                onClick={onOpenCreate}
                title="Create & Upload"
                aria-label="Create"
                className="hidden sm:flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--card-hover)] hover:bg-[var(--ink-faint)] text-[var(--ink)] text-sm font-medium whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create</span>
              </button>
            )}

            {/* Notifications Dropdown */}
            <div className="relative z-50">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                }}
                title="Notifications"
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#FF0000] text-[10px] font-bold text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationsPanel
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
                onMarkAllAsRead={onMarkAllNotificationsRead}
                onToggleRead={onToggleNotificationRead}
                onDeleteNotification={onDeleteNotification}
                onSelectVideo={onSelectVideo}
                onSelectChannel={onSelectChannel}
                onOpenStudio={onOpenStudio}
                onSimulateNewNotification={onSimulateNotification}
              />
            </div>

            {/* User Profile or YouTube-style Sign In Pill */}
            {currentUser ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowNotifications(false);
                  }}
                  aria-label="Account menu"
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-[var(--ink-faint)] hover:ring-[var(--ink-medium)] transition-all focus:outline-none bg-[var(--surface-elevated)] ml-1"
                >
                  {!avatarFailed ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-[var(--accent-ink)] uppercase">
                      {(userProfile?.displayName || currentUser.displayName || 'V').charAt(0)}
                    </span>
                  )}
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-11 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] p-2 shadow-2xl transition-all text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-3 p-2.5 border-b border-[var(--ink-faint)]">
                      {!avatarFailed ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarFailed(true)}
                          className="h-10 w-10 rounded-full object-cover shrink-0 border border-[var(--ink-faint)]"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/15 text-sm font-bold text-[var(--accent-ink)] uppercase">
                          {(userProfile?.displayName || currentUser.displayName || 'V').charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[var(--ink)] truncate">
                          {userProfile?.displayName || currentUser.displayName || 'Creator'}
                        </div>
                        <div className="text-xs text-[var(--ink-medium)] truncate">
                          {userProfile?.handle || '@creator'}
                        </div>
                        <div className="text-[11px] text-[var(--ink-medium)] truncate">{currentUser.email}</div>
                      </div>
                    </div>

                    <div className="mt-1 space-y-0.5 text-[var(--ink)]">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenStudio();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors font-medium text-[var(--accent-ink)]"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Creator Studio Dashboard</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenProfile();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors font-medium"
                      >
                        <User className="h-4 w-4 text-[var(--ink-medium)]" />
                        <span>Profile Management</span>
                      </button>

                      {onOpenSettings && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onOpenSettings();
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors font-medium"
                        >
                          <Settings className="h-4 w-4 text-[var(--ink-medium)]" />
                          <span>Settings & Preferences</span>
                        </button>
                      )}

                      <div className="my-1 border-t border-[var(--ink-faint)]" />

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          signOutUser();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors font-medium"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 sm:gap-1.5 h-9 rounded-full border border-[var(--ink-faint)] hover:bg-[var(--link)]/10 hover:border-[var(--link)]/40 text-[var(--link)] px-2.5 sm:px-3.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors active:scale-95 cursor-pointer"
              >
                <UserCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
