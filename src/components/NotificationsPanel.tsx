import React, { useState } from 'react';
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
  Play,
  ArrowRight
} from 'lucide-react';
import { NotificationItem, VideoItem } from '../types/video';

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

  // Settings Toggles State
  const [notifyUploads, setNotifyUploads] = useState(true);
  const [notifyReplies, setNotifyReplies] = useState(true);
  const [notifyMilestones, setNotifyMilestones] = useState(true);

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
      <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-2 top-14 sm:top-12 z-[100] w-auto sm:w-96 md:w-[420px] max-w-[calc(100vw-1rem)] rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                title="Mark all as read"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}

            <button
              onClick={() => setShowSettingsModal(true)}
              title="Notification Settings"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-xs overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'mentions', label: 'Replies' },
            { id: 'subscriptions', label: 'Following' },
            { id: 'milestones', label: 'Milestones' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-lg px-3 py-1 font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[460px]">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center text-slate-400 px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mx-auto mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Your notifications live here
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Follow your favorite channels to get notified about new videos, premieres, and replies.
              </p>
              <button
                onClick={onSimulateNewNotification}
                className="mt-4 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                + Test New Notification
              </button>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleClickItem(item)}
                className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  !item.read ? 'bg-sky-500/[0.04] dark:bg-sky-500/[0.06]' : ''
                }`}
              >
                {/* Unread indicator dot */}
                <div className="pt-2 shrink-0 w-2 flex justify-center">
                  {!item.read && (
                    <div className="h-2 w-2 rounded-full bg-sky-500 ring-2 ring-sky-500/30" />
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
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700">
                    {getTypeIcon(item.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">
                    {item.message}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <span>{item.timestamp}</span>
                    {item.linkText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-500 font-semibold">{item.linkText}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Video Thumbnail (if present) */}
                {item.thumbnailUrl && (
                  <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-slate-200 dark:ring-slate-700">
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-3 w-3 fill-white text-white" />
                    </div>
                  </div>
                )}

                {/* 3-Dot Options */}
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                    className="p-1 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>

                  {menuOpenId === item.id && (
                    <div className="absolute right-0 top-6 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-xs">
                      <button
                        onClick={() => {
                          onToggleRead(item.id);
                          setMenuOpenId(null);
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Check className="h-3 w-3" />
                        <span>{item.read ? 'Mark as unread' : 'Mark as read'}</span>
                      </button>

                      <button
                        onClick={() => {
                          onDeleteNotification(item.id);
                          setMenuOpenId(null);
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="h-3 w-3" />
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
        <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <button
            onClick={onSimulateNewNotification}
            className="flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400 hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simulate New Alert</span>
          </button>
          <span className="text-[11px] text-slate-400">
            {notifications.length} total alerts
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-sky-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Notification Preferences
                </h4>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Channel Uploads & Premieres
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Receive alerts when subscribed channels post
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyUploads}
                  onChange={(e) => setNotifyUploads(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Comments & Replies
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Notify when someone responds to your comments
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyReplies}
                  onChange={(e) => setNotifyReplies(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Creator Milestones & Badges
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Channel subscriber milestones and tips
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyMilestones}
                  onChange={(e) => setNotifyMilestones(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
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
