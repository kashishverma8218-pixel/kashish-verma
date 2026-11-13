import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Sliders,
  Bell,
  Shield,
  Palette,
  Play,
  Check,
  Moon,
  Sun,
  Trash2,
  LogOut,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CloudInfrastructureModal } from './CloudInfrastructureModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onClearHistory?: () => void;
  onOpenProfile?: () => void;
  onOpenAuth?: () => void;
  onPreferencesChange?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  onToggleDarkMode,
  onClearHistory,
  onOpenProfile,
  onOpenAuth,
  onPreferencesChange,
}) => {
  const { currentUser, userProfile, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'playback' | 'notifications' | 'privacy' | 'appearance'>('account');

  // Playback settings
  const [autoplayNext, setAutoplayNext] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_autoplay') !== 'false';
  });
  const [defaultQuality, setDefaultQuality] = useState<string>(() => {
    return localStorage.getItem('vio_pref_quality') || '1080p';
  });
  const [ambientMode, setAmbientMode] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_ambient') !== 'false';
  });
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(() => {
    return (localStorage.getItem('vio_streaming_subtitles_enabled') || localStorage.getItem('vio_pref_subtitles')) === 'true';
  });

  // Notification settings
  const [notifyUploads, setNotifyUploads] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_notify_uploads') !== 'false';
  });
  const [notifyReplies, setNotifyReplies] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_notify_replies') !== 'false';
  });
  const [notifyMilestones, setNotifyMilestones] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_notify_milestones') !== 'false';
  });
  const [notifySound, setNotifySound] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_notify_sound') !== 'false';
  });

  // Privacy settings
  const [saveHistory, setSaveHistory] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_save_history') !== 'false';
  });
  const [restrictedMode, setRestrictedMode] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_restricted_mode') === 'true';
  });
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [showInfra, setShowInfra] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showInfra) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, showInfra, onClose]);

  if (!isOpen) return null;

  const showSavedBadge = (msg = 'Preference saved') => {
    setSavedFeedback(msg);
    onPreferencesChange?.();
    setTimeout(() => setSavedFeedback(null), 2000);
  };

  const handleAutoplayToggle = () => {
    const next = !autoplayNext;
    setAutoplayNext(next);
    localStorage.setItem('vio_pref_autoplay', String(next));
    showSavedBadge('Autoplay setting updated');
  };

  const handleQualityChange = (q: string) => {
    setDefaultQuality(q);
    localStorage.setItem('vio_pref_quality', q);
    showSavedBadge(`Default quality set to ${q}`);
  };

  const handleAmbientToggle = () => {
    const next = !ambientMode;
    setAmbientMode(next);
    localStorage.setItem('vio_pref_ambient', String(next));
    showSavedBadge('Ambient lighting updated');
  };

  const handleSubtitlesToggle = () => {
    const next = !subtitlesEnabled;
    setSubtitlesEnabled(next);
    localStorage.setItem('vio_streaming_subtitles_enabled', String(next));
    localStorage.setItem('vio_pref_subtitles', String(next));
    showSavedBadge('Captions default updated');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Settings Modal Window */}
      <div className="relative z-10 flex flex-col md:flex-row w-full max-w-3xl max-h-[92vh] bg-[var(--surface)] rounded-3xl border border-[var(--ink-faint)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-[var(--ink)]">
        
        {/* Left Navigation Tabs (YouTube style) */}
        <aside className="w-full md:w-64 bg-[var(--bg)] border-b md:border-b-0 md:border-r border-[var(--ink-faint)] p-4 shrink-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--ink-faint)]">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-red-500" />
                <h2 className="text-base font-bold text-[var(--ink)]">Settings</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="md:hidden h-10 w-10 flex items-center justify-center rounded-xl text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveTab('account')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'account'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>Account</span>
              </button>

              <button
                onClick={() => setActiveTab('playback')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'playback'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Play className="h-4 w-4 shrink-0" />
                <span>Playback & Performance</span>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'notifications'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Bell className="h-4 w-4 shrink-0" />
                <span>Notifications</span>
              </button>

              <button
                onClick={() => setActiveTab('privacy')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'privacy'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span>Privacy & History</span>
              </button>

              <button
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'appearance'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Palette className="h-4 w-4 shrink-0" />
                <span>Appearance</span>
              </button>
            </nav>
          </div>

          <div className="hidden md:block pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
            Vio streaming v2.4 · 2026
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 min-h-[420px]">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                {activeTab === 'playback' ? 'Playback Controls & Quality' : activeTab}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage your viewing experience and personalization settings
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {savedFeedback && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                  <Check className="h-3.5 w-3.5" />
                  {savedFeedback}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* TAB 1: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-5">
              {currentUser ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg)] border border-[var(--ink-faint)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={userProfile?.photoURL || currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.4';
                      }}
                      className="h-14 w-14 rounded-full object-cover ring-2 ring-[#FF0000]/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[var(--ink)] truncate">
                        {userProfile?.displayName || currentUser.displayName || 'Vio Creator'}
                      </div>
                      <div className="text-xs text-[var(--ink-medium)] truncate">
                        {userProfile?.handle || '@creator'} · {currentUser.email}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <Check className="h-3 w-3" />
                        Verified Creator
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenProfile();
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[var(--ink-faint)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--ink-faint)] cursor-pointer"
                      >
                        Edit Profile
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        signOutUser();
                        showSavedBadge('Signed out successfully');
                      }}
                      className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/10 via-purple-500/10 to-transparent border border-red-500/20 text-center">
                  <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                    <User className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-[var(--ink)]">Sign in to your Vio streaming account</h4>
                  <p className="mt-1 max-w-sm mx-auto text-xs text-[var(--ink-medium)]">
                    Follow channels, save favorites to watch later, like videos, and upload 4K content to Vio streaming Studio.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth?.();
                    }}
                    className="mt-4 min-h-[42px] px-5 py-2 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Sign in to Vio streaming
                  </button>
                </div>
              )}

              {/* Channel & Membership Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Channel Membership & Revenue</div>
                    <div className="text-[11px] text-slate-500">Track 30% creator payouts & follower perks</div>
                  </div>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">Active</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Connected Services & Cloud</div>
                    <div className="text-[11px] text-slate-500">Vio streaming Cloud Storage & 4K CDN Encoding</div>
                  </div>
                  <span className="text-xs text-slate-400">Ready</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLAYBACK & PERFORMANCE */}
          {activeTab === 'playback' && (
            <div className="space-y-4">
              {/* Autoplay Next */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Autoplay Next Video</div>
                  <div className="text-[11px] text-slate-500">Automatically stream recommended video when one finishes</div>
                </div>
                <button
                  onClick={handleAutoplayToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoplayNext ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoplayNext ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Default Quality Selector */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Default Video Streaming Quality</div>
                  <div className="text-[11px] text-slate-500">Preferred playback resolution on Wi-Fi and high-speed broadband</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {['Auto', '1080p', '1440p', '4K UHD'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQualityChange(q)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                        defaultQuality === q
                          ? 'border-red-500 bg-red-500/10 text-red-500'
                          : 'border-[var(--ink-faint)] text-[var(--ink)] hover:bg-[var(--ink-faint)]'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ambient Lighting Mode */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Ambient Glow / Cinema Mode</div>
                  <div className="text-[11px] text-slate-500">Diffuse player glow around video frame for immersive cinema viewing</div>
                </div>
                <button
                  onClick={handleAmbientToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    ambientMode ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      ambientMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Captions / Subtitles */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Always Show Closed Captions</div>
                  <div className="text-[11px] text-slate-500">Automatically display subtitles whenever available</div>
                </div>
                <button
                  onClick={handleSubtitlesToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    subtitlesEnabled ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      subtitlesEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Cloud Infrastructure & CDN Edge Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div>
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    <span>Cloud Streaming, Auto-Scale & Global CDN</span>
                  </div>
                  <div className="text-[11px] text-[var(--ink-medium)]">Auto-scale pods, Anycast CDN edge (285 PoPs) & HLS Transcoding</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfra(true)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  View Cloud Stats
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Followed Channels Uploads</div>
                  <div className="text-[11px] text-slate-500">Get notified when creators you follow release new videos or reels</div>
                </div>
                <button
                  onClick={() => {
                    const next = !notifyUploads;
                    setNotifyUploads(next);
                    localStorage.setItem('vio_pref_notify_uploads', String(next));
                    showSavedBadge();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifyUploads ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifyUploads ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Replies & Comments Mentions</div>
                  <div className="text-[11px] text-slate-500">Receive alerts when someone replies to your comment or tags your handle</div>
                </div>
                <button
                  onClick={() => {
                    const next = !notifyReplies;
                    setNotifyReplies(next);
                    localStorage.setItem('vio_pref_notify_replies', String(next));
                    showSavedBadge();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifyReplies ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifyReplies ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Studio Milestone Alerts</div>
                  <div className="text-[11px] text-slate-500">Celebrate follower milestones, 1K/10K view peaks, and earnings milestones</div>
                </div>
                <button
                  onClick={() => {
                    const next = !notifyMilestones;
                    setNotifyMilestones(next);
                    localStorage.setItem('vio_pref_notify_milestones', String(next));
                    showSavedBadge();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifyMilestones ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifyMilestones ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Notification Chimes & Sounds</div>
                  <div className="text-[11px] text-slate-500">Play subtle audio alert on new desktop push notification</div>
                </div>
                <button
                  onClick={() => {
                    const next = !notifySound;
                    setNotifySound(next);
                    localStorage.setItem('vio_pref_notify_sound', String(next));
                    showSavedBadge();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifySound ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifySound ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY & HISTORY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Keep Watch History</div>
                  <div className="text-[11px] text-slate-500">Record videos you watch to resume later and improve recommendations</div>
                </div>
                <button
                  onClick={() => {
                    const next = !saveHistory;
                    setSaveHistory(next);
                    localStorage.setItem('vio_pref_save_history', String(next));
                    showSavedBadge();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    saveHistory ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      saveHistory ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Clear Watch History</div>
                  <div className="text-[11px] text-slate-500">Wipe all previously viewed clips from your local history</div>
                </div>
                {onClearHistory && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      showSavedBadge('History cleared');
                    }}
                    className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/40 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Restricted Mode (Safe Search)</div>
                  <div className="text-[11px] text-slate-500">Hide mature or 18+ flagged content from your feed and search results</div>
                </div>
                <button
                  onClick={() => {
                    const next = !restrictedMode;
                    setRestrictedMode(next);
                    localStorage.setItem('vio_pref_restricted_mode', String(next));
                    showSavedBadge();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    restrictedMode ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      restrictedMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Visual Interface Theme</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      if (!isDarkMode) onToggleDarkMode();
                      showSavedBadge('Dark theme enabled');
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isDarkMode
                        ? 'border-red-500 bg-red-500/10 text-red-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Moon className="h-5 w-5" />
                    <div>
                      <div className="text-xs font-bold">Dark Theme</div>
                      <div className="text-[10px] text-slate-400">Night cinema contrast</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (isDarkMode) onToggleDarkMode();
                      showSavedBadge('Light theme enabled');
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      !isDarkMode
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sun className="h-5 w-5 text-amber-500" />
                    <div>
                      <div className="text-xs font-bold">Light Theme</div>
                      <div className="text-[10px] text-slate-400">Clean day contrast</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Cloud Infrastructure & CDN Edge Status Modal */}
      <CloudInfrastructureModal
        isOpen={showInfra}
        onClose={() => setShowInfra(false)}
      />
    </div>
  );
};
