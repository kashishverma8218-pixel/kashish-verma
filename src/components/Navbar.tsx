import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Mic,
  Bell,
  X,
  User,
  LogIn,
  LogOut,
  LayoutDashboard,
  ArrowLeft,
  Settings,
  Plus,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationsPanel } from './NotificationsPanel';
import { NotificationItem } from '../types/video';
import { VioLogo } from './VioLogo';

interface NavbarProps {
  onToggleSidebar: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit: () => void;
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
}) => {
  const { currentUser, userProfile, signOutUser } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [voiceSearchActive, setVoiceSearchActive] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState('Listening... Speak now');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit();
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

  return (
    <header className="sticky top-0 z-40 w-full min-h-[60px] sm:min-h-[64px] border-b border-slate-200/80 bg-white/95 px-2.5 sm:px-4 py-2 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-950/95 flex items-center">
      {/* MOBILE SEARCH OVERLAY MODE */}
      {mobileSearchOpen ? (
        <div className="flex w-full items-center gap-1.5 animate-in fade-in duration-150">
          <button
            onClick={() => setMobileSearchOpen(false)}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="relative flex flex-1 items-center">
            <input
              type="text"
              autoFocus
              placeholder="Search Vio streaming videos, reels, channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKey}
              className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pl-4 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              onSearchSubmit();
              setMobileSearchOpen(false);
            }}
            title="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            onClick={handleVoiceSearch}
            title="Voice search"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-all ${
              voiceSearchActive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800/60'
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-2 sm:gap-6">
          {/* Left Section: Hamburger & Vio Brand Mark (Never clipped) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={onToggleSidebar}
              aria-label="Open menu drawer"
              title="Open menu & preferences"
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={onNavigateHome}
              aria-label="Vio streaming Home"
              className="flex items-center focus:outline-none group overflow-visible py-0.5"
            >
              <VioLogo size="md" />
            </button>
          </div>

          {/* Center Section: Search Bar & Voice Microphone */}
          <div className="hidden sm:flex flex-1 max-w-2xl items-center justify-center px-1 sm:px-4">
            <div className="relative flex w-full items-center">
              <div className="relative flex w-full items-center">
                <input
                  type="text"
                  placeholder="Search videos, reels, channels on Vio streaming..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                  className="w-full rounded-l-full border border-r-0 border-slate-300 bg-slate-50/70 py-2 pl-4 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:focus:border-red-500 dark:focus:bg-slate-900"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                onClick={onSearchSubmit}
                title="Search"
                className="flex h-[38px] items-center justify-center rounded-r-full border border-slate-300 bg-slate-100 px-5 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>

              <button
                onClick={handleVoiceSearch}
                title="Search with your voice"
                className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  voiceSearchActive
                    ? 'bg-red-600 text-white shadow-md animate-pulse ring-2 ring-red-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 bg-slate-100 dark:bg-slate-800/60'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>

              {/* Active Voice Search Tooltip */}
              {voiceSearchActive && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-full text-xs shadow-xl animate-in fade-in slide-in-from-top-1 whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  <span>{voiceStatusText}</span>
                  <button
                    onClick={() => setVoiceSearchActive(false)}
                    className="ml-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Mobile Search, Create, Settings, Notifications, Profile / Sign In */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Search Trigger */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
              className="flex sm:hidden h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Create Video Shortcut */}
            {onOpenCreate && (
              <button
                onClick={onOpenCreate}
                title="Upload video"
                aria-label="Upload video"
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}

            {/* Dedicated Settings Button (Item 7) */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Settings & Preferences"
                aria-label="Settings & Preferences"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <Settings className="h-4 w-4" />
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
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
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

            {/* User Profile or Sign In Button (Tightly grouped with zero excessive gap) */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowNotifications(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-2 ring-transparent hover:ring-red-500 transition-all focus:outline-none"
                >
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-3 p-2.5 border-b border-slate-100 dark:border-slate-800">
                      <img src={avatarUrl} alt="Avatar" className="h-10 w-10 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {userProfile?.displayName || currentUser.displayName || 'Creator'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {userProfile?.handle || '@creator'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{currentUser.email}</div>
                      </div>
                    </div>

                    <div className="mt-1 space-y-0.5 text-slate-700 dark:text-slate-300">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenStudio();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium text-red-600 dark:text-red-400"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Creator Studio Dashboard</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenProfile();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        <span>Profile Management</span>
                      </button>

                      {onOpenSettings && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onOpenSettings();
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                        >
                          <Settings className="h-4 w-4 text-slate-400" />
                          <span>Settings & Preferences</span>
                        </button>
                      )}

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          signOutUser();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium"
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
                className="flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3.5 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
