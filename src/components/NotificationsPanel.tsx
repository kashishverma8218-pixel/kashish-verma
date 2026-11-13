import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  MoreVertical,
  Film,
  MessageSquare,
  Sparkles,
  Users,
  Check,
  X,
  Play
} from 'lucide-react';
import { NotificationItem } from '../types/video';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onToggleRead: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onSelectVideo: (videoId: string) => void;
  onSelectChannel: (channelId: string) => void;
  onOpenStudio: () => void;
  onSimulateNewNotification: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onToggleRead,
  onDeleteNotification,
  onSelectVideo,
  onSelectChannel,
  onOpenStudio,
  onSimulateNewNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'mentions' | 'subscriptions' | 'milestones'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings Toggles State (synced with localStorage)
  const [notifyUploads, setNotifyUploads] = useState(() => localStorage.getItem('vio_pref_notify_uploads') !== 'false');
  const [notifyReplies, setNotifyReplies] = useState(() => localStorage.getItem('vio_pref_notify_replies') !== 'false');
  const [notifyMilestones, setNotifyMilestones] = useState(() => localStorage.getItem('vio_pref_notify_milestones') !== 'false');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettingsModal) {
          setShowSettingsModal(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, showSettingsModal, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'mentions') return n.type === 'reply';
    if (activeTab === 'subscriptions') return n.type === 'upload' || n.type === 'subscription';
    if (activeTab === 'milestones') return n.type === 'milestone';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClickItem = (item: NotificationItem) => {
    if (!item.read) {
      onToggleRead(item.id);
    }
    if (item.videoId) {
      onSelectVideo(item.videoId);
      onClose();
    } else if (item.channelId) {
      onSelectChannel(item.channelId);
      onClose();
    } else if (item.type === 'milestone') {
      onOpenStudio();
      onClose();
    }
  };

  const getTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'upload':
        return <Film className="h-3.5 w-3.5 text-red-500" />;
      case 'reply':
        return <MessageSquare className="h-3.5 w-3.5 text-sky-500" />;
      case 'milestone':
        return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
      case 'subscription':
        return <Users className="h-3.5 w-3.5 text-emerald-500" />;
      default:
        return <Bell className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-16 sm:top-12 z-[100] w-auto sm:w-96 md:w-[420px] max-w-[calc(100vw-1rem)] rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] text-[var(--ink)] shadow-2xl transition-all max-h-[82vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#FF0000] px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                title="Mark all as read"
                className="flex items-center gap-1 min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--bg)] transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}

            <button
              onClick={() => setShowSettingsModal(true)}
              title="Notification Settings"
              aria-label="Notification Settings"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg)]/60 border-b border-[var(--ink-faint)] text-xs overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'mentions', label: 'Replies' },
            { id: 'subscriptions', label: 'Following' },
            { id: 'milestones', label: 'Milestones' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[34px] rounded-lg px-3 py-1 font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#FF0000] text-white font-bold shadow-xs'
                  : 'text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--surface)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--ink-faint)] max-h-[460px]">
          {filteredNotifications.length === 0 ? (
            <div className="py-14 text-center text-[var(--ink-medium)] px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--ink-medium)] mx-auto mb-3 border border-[var(--ink-faint)]">
                <Bell className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-[var(--ink)]">
                Your notifications live here
              </p>
              <p className="mt-1 text-xs text-[var(--ink-medium)]">
                Follow your favorite channels to get notified about new videos, premieres, and replies.
              </p>
              <button
                onClick={onSimulateNewNotification}
                className="mt-4 min-h-[38px] rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] px-3.5 py-1.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--accent-ink)] transition-colors"
              >
                + Test New Notification
              </button>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleClickItem(item)}
                className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-[var(--card-hover)] ${
                  !item.read ? 'bg-[#FF0000]/[0.05]' : ''
                }`}
              >
                {/* Unread indicator dot */}
                <div className="pt-2 shrink-0 w-2 flex justify-center">
                  {!item.read && (
                    <div className="h-2 w-2 rounded-full bg-[#FF0000]" />
                  )}
                </div>

                {/* Avatar with Type Icon Badge */}
                <div className="relative shrink-0">
                  <img
                    src={
                      item.avatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
                    }
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const fallback = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
                      if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                    }}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-[var(--ink-faint)]"
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface)] shadow-xs ring-1 ring-[var(--ink-faint)]">
                    {getTypeIcon(item.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--ink)] leading-snug line-clamp-2">
                    {item.message}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--ink-medium)] font-medium">
                    <span>{item.timestamp}</span>
                    {item.linkText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--accent-ink)] font-semibold">{item.linkText}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Video Thumbnail (if present) */}
                {item.thumbnailUrl && (
                  <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-[var(--ink-faint)]">
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const fallback = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80';
                        if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                      }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-3 w-3 fill-white text-white" />
                    </div>
                  </div>
                )}

                {/* 3-Dot Options (always visible on mobile touchscreens) */}
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                    aria-label="Notification options"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[var(--ink-medium)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-all"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuOpenId === item.id && (
                    <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] p-1 shadow-xl text-xs">
                      <button
                        onClick={() => {
                          onToggleRead(item.id);
                          setMenuOpenId(null);
                        }}
                        className="flex w-full items-center gap-2 min-h-[36px] px-2.5 py-1.5 rounded-lg text-[var(--ink)] hover:bg-[var(--card-hover)]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{item.read ? 'Mark as unread' : 'Mark as read'}</span>
                      </button>

                      <button
                        onClick={() => {
                          onDeleteNotification(item.id);
                          setMenuOpenId(null);
                        }}
                        className="flex w-full items-center gap-2 min-h-[36px] px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete notification</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Simulator CTA */}
        <div className="p-3 bg-[var(--bg)]/60 border-t border-[var(--ink-faint)] flex items-center justify-between text-xs">
          <button
            onClick={onSimulateNewNotification}
            className="flex items-center gap-1.5 min-h-[36px] px-2 font-bold text-[var(--accent-ink)] hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simulate New Alert</span>
          </button>
          <span className="text-[11px] text-[var(--ink-medium)] font-mono">
            {notifications.length} total alerts
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          onClick={() => setShowSettingsModal(false)}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] text-[var(--ink)] p-5 sm:p-6 shadow-2xl transition-colors"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ink-faint)]">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--accent-ink)]" />
                <h4 className="text-sm font-bold text-[var(--ink)]">
                  Notification Preferences
                </h4>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close settings"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[40px]">
                <div>
                  <span className="font-bold text-[var(--ink)] block">
                    Channel Uploads & Premieres
                  </span>
                  <span className="text-[var(--ink-medium)] text-[11px]">
                    Receive alerts when followed channels post
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyUploads}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNotifyUploads(next);
                    localStorage.setItem('vio_pref_notify_uploads', String(next));
                  }}
                  className="h-4 w-4 rounded accent-[#FF0000]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[40px]">
                <div>
                  <span className="font-bold text-[var(--ink)] block">
                    Comments & Replies
                  </span>
                  <span className="text-[var(--ink-medium)] text-[11px]">
                    Notify when someone responds to your comments
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyReplies}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNotifyReplies(next);
                    localStorage.setItem('vio_pref_notify_replies', String(next));
                  }}
                  className="h-4 w-4 rounded accent-[#FF0000]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[40px]">
                <div>
                  <span className="font-bold text-[var(--ink)] block">
                    Creator Milestones & Badges
                  </span>
                  <span className="text-[var(--ink-medium)] text-[11px]">
                    Channel follower milestones and tips
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyMilestones}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNotifyMilestones(next);
                    localStorage.setItem('vio_pref_notify_milestones', String(next));
                  }}
                  className="h-4 w-4 rounded accent-[#FF0000]"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="min-h-[40px] rounded-xl bg-[#FF0000] px-4 py-2 text-xs font-bold text-white hover:bg-[#CC0000] transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
