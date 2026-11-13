import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavigationPage } from './components/Sidebar';
import { CategoryChips } from './components/CategoryChips';
import { VideoCard } from './components/VideoCard';
import { WatchView } from './components/WatchView';
import { ChannelView } from './components/ChannelView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { LibraryView } from './components/LibraryView';
import { CreateVideoModal } from './components/CreateVideoModal';
import { CreatorDashboard } from './components/CreatorDashboard';
import { AuthModal } from './components/AuthModal';
import { ProfileManagementModal } from './components/ProfileManagementModal';
import { FilterControls } from './components/FilterControls';
import { VideoInfoModal } from './components/VideoInfoModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ReelsView } from './components/ReelsView';
import { SplashScreen } from './components/SplashScreen';
import { AskVioBar } from './components/AskVioBar';
import { AIAssistantButton } from './components/AIAssistantButton';
import { CustomFeedView } from './components/CustomFeedView';
import { SettingsModal } from './components/SettingsModal';
import { auth, testFirestoreConnection } from './firebase';
import {
  seedInitialFirestoreData,
  subscribeVideos,
  subscribeReels,
  subscribeComments,
  subscribeNotifications,
  toggleLike,
  toggleSubscription,
  addCommentDoc,
  deleteCommentDoc,
  incrementVideoViews,
  recordWatchHistory,
  recordSearchQuery,
  recordStreamAnalytics,
  updateVideoDoc,
  deleteVideoDoc,
  fetchUserSubscriptions,
  fetchUserLikes,
} from './services/firebaseDatabaseService';
import { sanitizePlayableVideoUrl } from './services/streamingService';

import {
  CHANNELS,
  INITIAL_VIDEOS,
  INITIAL_COMMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_REELS,
  INITIAL_REEL_COMMENTS,
  formatViews
} from './data/mockData';
import {
  VideoItem,
  Channel,
  Comment,
  HistoryItem,
  VideoFilters,
  AspectRatioMode,
  Bookmark,
  NotificationItem,
  ReelItem,
  ReelComment
} from './types/video';

const DEFAULT_FILTERS: VideoFilters = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  blur: 0,
  invert: 0,
};

function MainApp() {
  const { currentUser, userProfile, updateUserProfileData } = useAuth();

  // Theme State (Variation 2 defaults to #0c0c0e dark architectural canvas; honors explicit user toggle)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('vio_streaming_theme_v3') !== 'light';
  });

  // Navigation & Page State
  const [currentPage, setCurrentPage] = useState<NavigationPage | 'watch'>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearchTerm, setActiveSearchTerm] = useState<string>('');

  // App Splash Screen State (shown on opening)
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Reels State
  const [reels, setReels] = useState<ReelItem[]>(INITIAL_REELS);
  const [reelComments, setReelComments] = useState<Record<string, ReelComment[]>>(INITIAL_REEL_COMMENTS);

  // Primary Data State
  const [channels, setChannels] = useState<Record<string, Channel>>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_channels') || localStorage.getItem('vio_channels');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return CHANNELS;
  });

  const [videos, setVideos] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_videos') || localStorage.getItem('vio_videos');
      if (saved) {
        const parsed = JSON.parse(saved) as VideoItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const fallbackPoster = INITIAL_VIDEOS[0]?.poster || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80';
          return parsed.map((v) => {
            const initialMatch = INITIAL_VIDEOS.find((iv) => iv.id === v.id);
            const sanitizedUrl = sanitizePlayableVideoUrl(v.url, v.id, 'video', true);
            const hasBrokenPoster = !v.poster || v.poster.startsWith('blob:');
            return {
              ...v,
              url: sanitizedUrl,
              poster: hasBrokenPoster ? (initialMatch?.poster || fallbackPoster) : v.poster,
            };
          });
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_VIDEOS;
  });

  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_comments') || localStorage.getItem('vio_comments');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_COMMENTS;
  });

  // Sync user's channel if logged in
  useEffect(() => {
    if (userProfile) {
      const userChannelId = `channel-${userProfile.uid}`;
      setChannels((prev) => ({
        ...prev,
        [userChannelId]: {
          id: userChannelId,
          name: userProfile.displayName,
          handle: userProfile.handle,
          avatar: userProfile.photoURL,
          banner: userProfile.bannerURL,
          verified: true,
          subscribersCount: userProfile.subscribersCount || 150,
          isSubscribed: false,
          notificationBell: 'all',
          bio: userProfile.bio,
          joinedDate: 'Joined recently',
          videoCount: videos.filter((v) => v.channelId === userChannelId).length,
        },
      }));
    }
  }, [userProfile]);

  // Active Context
  const [activeVideoId, setActiveVideoId] = useState<string>(INITIAL_VIDEOS[0].id);
  const [activeChannelId, setActiveChannelId] = useState<string>('channel-blender');

  // User Playlists & History
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_history') || localStorage.getItem('vio_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { videoId: 'video-bbb', watchedAt: Date.now() - 3600000, progressSeconds: 240 },
      { videoId: 'video-tears-of-steel', watchedAt: Date.now() - 7200000, progressSeconds: 520 },
    ];
  });

  const [watchLaterIds, setWatchLaterIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_watch_later') || localStorage.getItem('vio_watch_later');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ['video-sintel', 'video-escapes'];
  });

  const [likedVideoIds, setLikedVideoIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_liked_videos') || localStorage.getItem('vio_liked_videos');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ['video-bbb'];
  });

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_bookmarks') || localStorage.getItem('vio_bookmarks');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { id: 'b1', videoId: 'video-bbb', time: 32, label: 'Bunny Wakes Up', createdAt: Date.now() },
      { id: 'b2', videoId: 'video-bbb', time: 142, label: 'Forest Confrontation', createdAt: Date.now() },
    ];
  });

  // Notifications State with LocalStorage persistence
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_notifications') || localStorage.getItem('vio_notifications');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_NOTIFICATIONS;
  });

  // Player Adjustments
  const [filters, setFilters] = useState<VideoFilters>(DEFAULT_FILTERS);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('auto');

  // Modals & Preferences
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTarget, setCreateTarget] = useState<'video' | 'reel'>('video');
  const [initialReelId, setInitialReelId] = useState<string | undefined>(undefined);
  const [initialSeekTime, setInitialSeekTime] = useState<number | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [saveHistoryPref, setSaveHistoryPref] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_save_history') !== 'false';
  });
  const [restrictedModePref, setRestrictedModePref] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_restricted_mode') === 'true';
  });
  const [ambientModePref, setAmbientModePref] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_ambient') !== 'false';
  });

  const refreshPreferences = useCallback(() => {
    setSaveHistoryPref(localStorage.getItem('vio_pref_save_history') !== 'false');
    setRestrictedModePref(localStorage.getItem('vio_pref_restricted_mode') === 'true');
    setAmbientModePref(localStorage.getItem('vio_pref_ambient') !== 'false');
  }, []);

  const deepLinkResolvedRef = useRef(false);

  // Resolve shared deep links (?v=id&t=sec or ?reel=id)
  useEffect(() => {
    if (deepLinkResolvedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const vParam = params.get('v');
    const tParam = params.get('t');
    const reelParam = params.get('reel');

    if (!vParam && !reelParam) {
      deepLinkResolvedRef.current = true;
      return;
    }

    if (reelParam) {
      const matchedReel = reels.find((r) => r.id === reelParam);
      if (matchedReel) {
        setInitialReelId(matchedReel.id);
        setCurrentPage('reels');
        deepLinkResolvedRef.current = true;
      }
      return;
    }

    if (vParam) {
      const matchedVideo = videos.find((v) => v.id === vParam);
      if (matchedVideo) {
        const parsedTime = tParam ? parseInt(tParam, 10) : NaN;
        setActiveVideoId(matchedVideo.id);
        setInitialSeekTime(Number.isFinite(parsedTime) && parsedTime > 0 ? parsedTime : null);
        setCurrentPage('watch');
        deepLinkResolvedRef.current = true;
      }
    }
  }, [videos, reels]);

  // Sync Dark Mode
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('vio_streaming_theme_v3', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('vio_streaming_theme_v3', 'light');
    }
  }, [isDarkMode]);

  // Firestore Real-Time Subscriptions: Videos & Reels
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    // Seed initial database collections on first boot if empty
    seedInitialFirestoreData();

    // Live real-time sync for videos collection
    const unsubVideos = subscribeVideos((firestoreVideos) => {
      if (firestoreVideos && firestoreVideos.length > 0) {
        setVideos(firestoreVideos);
      }
    });

    // Live real-time sync for reels collection
    const unsubReels = subscribeReels((firestoreReels) => {
      if (firestoreReels && firestoreReels.length > 0) {
        setReels(firestoreReels);
      }
    });

    return () => {
      unsubVideos();
      unsubReels();
    };
  }, []);

  // Firestore User Subscriptions, Likes, and Notifications (only when Firebase Auth session matches)
  useEffect(() => {
    if (currentUser?.uid && auth.currentUser && auth.currentUser.uid === currentUser.uid) {
      // Live notifications
      const unsubNotifs = subscribeNotifications(currentUser.uid, (userNotifs) => {
        if (userNotifs && userNotifs.length > 0) {
          setNotifications(userNotifs);
        }
      });

      // User subscriptions from Firestore
      fetchUserSubscriptions(currentUser.uid)
        .then((subChannels) => {
          if (subChannels && subChannels.size > 0) {
            setChannels((prev) => {
              const next = { ...prev };
              for (const chId in next) {
                if (subChannels.has(chId)) {
                  next[chId] = { ...next[chId], isSubscribed: true };
                }
              }
              return next;
            });
          }
        })
        .catch(() => {});

      // User likes from Firestore
      fetchUserLikes(currentUser.uid)
        .then((likedIds) => {
          if (likedIds && likedIds.size > 0) {
            setLikedVideoIds(Array.from(likedIds));
            setVideos((prev) =>
              prev.map((v) => ({
                ...v,
                userLiked: likedIds.has(v.id),
              }))
            );
          }
        })
        .catch(() => {});

      return () => {
        unsubNotifs();
      };
    }
  }, [currentUser]);

  // Sync LocalStorage
  useEffect(() => {
    localStorage.setItem('vio_streaming_channels', JSON.stringify(channels));
  }, [channels]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_videos', JSON.stringify(videos));
  }, [videos]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_comments', JSON.stringify(commentsMap));
  }, [commentsMap]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_watch_later', JSON.stringify(watchLaterIds));
  }, [watchLaterIds]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_liked_videos', JSON.stringify(likedVideoIds));
  }, [likedVideoIds]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Live Firestore Comments Subscription when watching a video
  useEffect(() => {
    if (currentPage !== 'watch' || !activeVideoId) return;
    const unsubComments = subscribeComments(activeVideoId, (fsComments) => {
      if (!fsComments || fsComments.length === 0) return;
      setCommentsMap((prev) => {
        const existing = prev[activeVideoId] || [];
        const existingById = new Map(existing.map((c) => [c.id, c]));
        const fsIds = new Set(fsComments.map((c) => c.id));
        const mergedFs = fsComments.map((c) => {
          const prevMatch = existingById.get(c.id);
          return prevMatch
            ? {
                ...c,
                replies: prevMatch.replies || [],
                userLiked: prevMatch.userLiked,
                userDisliked: prevMatch.userDisliked,
              }
            : { ...c, replies: [] };
        });
        const localOnly = existing.filter((c) => !fsIds.has(c.id));
        return {
          ...prev,
          [activeVideoId]: [...mergedFs, ...localOnly],
        };
      });
    });
    return () => unsubComments();
  }, [currentPage, activeVideoId]);

  // Handlers
  const handlePlayVideo = (video: VideoItem) => {
    setInitialSeekTime(null);
    setActiveVideoId(video.id);
    setCurrentPage('watch');

    if (saveHistoryPref) {
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.videoId !== video.id);
        return [{ videoId: video.id, watchedAt: Date.now(), progressSeconds: 15 }, ...filtered];
      });
      if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
        recordWatchHistory(currentUser.uid, video, 15);
      }
    }

    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, views: v.views + 1 } : v))
    );

    // Sync views and analytics to Firestore
    incrementVideoViews(video.id);
    recordStreamAnalytics(video.id, { views: 1, watchTimeSeconds: 15 });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setCurrentPage('channel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSubscribe = (channelId: string) => {
    setChannels((prev) => {
      const current = prev[channelId];
      if (!current) return prev;
      const nextSub = !current.isSubscribed;

      if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
        toggleSubscription(currentUser.uid, channelId, current.name, current.avatar).catch(() => {});
      }

      return {
        ...prev,
        [channelId]: {
          ...current,
          isSubscribed: nextSub,
          subscribersCount: nextSub
            ? current.subscribersCount + 1
            : Math.max(0, current.subscribersCount - 1),
          notificationBell: nextSub ? 'personalized' : 'none',
        },
      };
    });
  };

  const handleUpdateNotificationBell = (channelId: string, bell: 'all' | 'personalized' | 'none') => {
    setChannels((prev) => {
      const current = prev[channelId];
      if (!current) return prev;
      return {
        ...prev,
        [channelId]: {
          ...current,
          notificationBell: bell,
        },
      };
    });
  };

  const handleToggleLike = (videoId: string) => {
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      toggleLike(currentUser.uid, videoId, 'video', 'like').catch(() => {});
    }

    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === videoId) {
          const isLiked = !v.userLiked;
          return {
            ...v,
            userLiked: isLiked,
            userDisliked: false,
            likes: isLiked ? v.likes + 1 : Math.max(0, v.likes - 1),
          };
        }
        return v;
      })
    );

    setLikedVideoIds((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [videoId, ...prev]
    );
  };

  const handleToggleDislike = (videoId: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === videoId) {
          const isDisliked = !v.userDisliked;
          return {
            ...v,
            userDisliked: isDisliked,
            userLiked: false,
          };
        }
        return v;
      })
    );
  };

  const handleToggleWatchLater = (videoId: string) => {
    setWatchLaterIds((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [videoId, ...prev]
    );
  };

  const handleAddComment = (videoId: string, content: string) => {
    const authorName = userProfile?.displayName || currentUser?.displayName || 'Creator';
    const authorHandle = userProfile?.handle || '@creative_viewer';
    const authorAvatar =
      userProfile?.photoURL ||
      currentUser?.photoURL ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';

    const commentId = `c-${Date.now()}`;
    const newComment: Comment = {
      id: commentId,
      videoId,
      authorName,
      authorHandle,
      authorAvatar,
      content,
      timestamp: 'Just now',
      likes: 0,
      userLiked: false,
      userDisliked: false,
      replies: [],
    };

    // Persist comment to Firestore with matching document ID
    addCommentDoc(videoId, content, authorName, authorAvatar, commentId).catch((err) => {
      console.warn('Could not persist comment to Firestore:', err);
    });

    setCommentsMap((prev) => ({
      ...prev,
      [videoId]: [newComment, ...(prev[videoId] || [])],
    }));
  };

  const handleLikeComment = (commentId: string) => {
    setCommentsMap((prev) => {
      const updated = { ...prev };
      for (const vid in updated) {
        updated[vid] = updated[vid].map((c) => {
          if (c.id === commentId) {
            const nextLiked = !c.userLiked;
            return {
              ...c,
              userLiked: nextLiked,
              userDisliked: nextLiked ? false : c.userDisliked,
              likes: nextLiked ? c.likes + 1 : Math.max(0, c.likes - 1),
            };
          }
          return c;
        });
      }
      return updated;
    });
  };

  const handleDislikeComment = (commentId: string) => {
    setCommentsMap((prev) => {
      const updated = { ...prev };
      for (const vid in updated) {
        updated[vid] = updated[vid].map((c) => {
          if (c.id === commentId) {
            const nextDisliked = !c.userDisliked;
            return {
              ...c,
              userDisliked: nextDisliked,
              userLiked: nextDisliked ? false : c.userLiked,
              likes: nextDisliked && c.userLiked ? Math.max(0, c.likes - 1) : c.likes,
            };
          }
          return c;
        });
      }
      return updated;
    });
  };

  const handleAddReply = (commentId: string, content: string) => {
    const authorName = userProfile?.displayName || currentUser?.displayName || 'Creator';
    const authorHandle = userProfile?.handle || '@creator';
    const authorAvatar =
      userProfile?.photoURL ||
      currentUser?.photoURL ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';

    setCommentsMap((prev) => {
      const updated = { ...prev };
      for (const vid in updated) {
        updated[vid] = updated[vid].map((c) => {
          if (c.id === commentId) {
            const newReply = {
              id: `rep-${Date.now()}`,
              commentId,
              authorName,
              authorHandle,
              authorAvatar,
              content,
              timestamp: 'Just now',
              likes: 0,
              userLiked: false,
            };
            return {
              ...c,
              replies: [...(c.replies || []), newReply],
            };
          }
          return c;
        });
      }
      return updated;
    });
  };

  const handlePublishVideo = (newVideo: VideoItem) => {
    if (!newVideo || !newVideo.id || !newVideo.url) {
      console.warn('handlePublishVideo: Skipped invalid video payload', newVideo);
      return;
    }

    // Deduplicate: filter out any existing item with the same ID, prepend new video to top
    setVideos((prev) => {
      const remaining = prev.filter((v) => v.id !== newVideo.id);
      const updated = [newVideo, ...remaining];
      try {
        localStorage.setItem('vio_streaming_videos', JSON.stringify(updated.slice(0, 50)));
      } catch {
        // ignore storage quota
      }
      return updated;
    });

    setActiveVideoId(newVideo.id);
    handlePlayVideo(newVideo);
  };

  const handleUpdateVideo = (updated: VideoItem) => {
    setVideos((prev) => {
      const next = prev.map((v) => (v.id === updated.id ? updated : v));
      try {
        localStorage.setItem('vio_streaming_videos', JSON.stringify(next.slice(0, 50)));
      } catch {
        // ignore storage quota
      }
      return next;
    });
    updateVideoDoc(updated.id, updated).catch(() => {});
  };

  const handleDeleteVideo = (videoId: string) => {
    deleteVideoDoc(videoId).catch(() => {});
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    if (activeVideoId === videoId) {
      setActiveVideoId(videos[0]?.id || INITIAL_VIDEOS[0].id);
    }
  };

  const handleUpdateChannel = (updatedChannel: Channel) => {
    setChannels((prev) => ({
      ...prev,
      [updatedChannel.id]: updatedChannel,
    }));
    if (userProfile && updatedChannel.id === `channel-${userProfile.uid}`) {
      updateUserProfileData({
        displayName: updatedChannel.name,
        handle: updatedChannel.handle,
        bio: updatedChannel.bio,
        photoURL: updatedChannel.avatar,
        bannerURL: updatedChannel.banner,
      }).catch(() => {});
    }
  };

  const handlePublishReel = (newReel: ReelItem) => {
    if (!newReel || !newReel.id || !newReel.videoUrl) return;
    setReels((prev) => [newReel, ...prev.filter((r) => r.id !== newReel.id)]);
    setInitialReelId(newReel.id);
    setCurrentPage('reels');
  };

  const handleDeleteComment = (videoId: string, commentId: string) => {
    deleteCommentDoc(commentId).catch(() => {});
    setCommentsMap((prev) => ({
      ...prev,
      [videoId]: (prev[videoId] || []).filter((c) => c.id !== commentId),
    }));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleRemoveFromHistory = (videoId: string) => {
    setHistory((prev) => prev.filter((h) => h.videoId !== videoId));
  };

  const handleAddBookmark = (time: number, thumbnailUrl?: string) => {
    const newBookmark: Bookmark = {
      id: `bm-${Date.now()}`,
      videoId: activeVideoId,
      time: Math.round(time),
      label: `Moment at ${Math.round(time)}s`,
      createdAt: Date.now(),
      thumbnailUrl,
    };
    setBookmarks((prev) => [newBookmark, ...prev]);
  };

  const handleDeleteBookmark = (bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  };

  const handleUpdateBookmarkLabel = (bookmarkId: string, label: string) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === bookmarkId ? { ...b, label } : b))
    );
  };

  const handleClearAllBookmarks = () => {
    setBookmarks((prev) => prev.filter((b) => b.videoId !== activeVideoId));
  };

  // Notification Handlers
  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleToggleNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSimulateNotification = () => {
    const randomTypes: NotificationItem['type'][] = ['upload', 'reply', 'milestone', 'subscription'];
    const selectedType = randomTypes[Math.floor(Math.random() * randomTypes.length)];
    let newNotif: NotificationItem;

    if (selectedType === 'upload') {
      newNotif = {
        id: `notif-${Date.now()}`,
        type: 'upload',
        title: 'New Video Upload',
        message: 'OpenFilm Foundation uploaded a new 4K remaster.',
        timestamp: 'Just now',
        createdAt: Date.now(),
        read: false,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=300&q=80',
        videoId: 'video-tears-of-steel',
        channelId: 'channel-openfilm',
      };
    } else if (selectedType === 'reply') {
      newNotif = {
        id: `notif-${Date.now()}`,
        type: 'reply',
        title: 'New Reply to Your Comment',
        message: 'Marcus Vance replied: "Totally agree with your breakdown!"',
        timestamp: 'Just now',
        createdAt: Date.now(),
        read: false,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=300&q=80',
        videoId: 'video-bbb',
      };
    } else if (selectedType === 'milestone') {
      newNotif = {
        id: `notif-${Date.now()}`,
        type: 'milestone',
        title: 'Studio Milestone Reached!',
        message: 'Your channel hit a new engagement peak with 1,000+ views!',
        timestamp: 'Just now',
        createdAt: Date.now(),
        read: false,
        avatar: userProfile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        linkText: 'Check Studio Analytics',
      };
    } else {
      newNotif = {
        id: `notif-${Date.now()}`,
        type: 'subscription',
        title: 'New Follower',
        message: 'FilmCrafter99 started following your channel.',
        timestamp: 'Just now',
        createdAt: Date.now(),
        read: false,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        channelId: 'channel-blender',
      };
    }

    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleToggleSidebar = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  // Active Video & Channel Resolution
  const activeVideo = videos.find((v) => v.id === activeVideoId) || videos[0] || INITIAL_VIDEOS[0];
  const activeChannel = channels[activeVideo.channelId] || channels['channel-blender'] || Object.values(channels)[0];
  const viewingChannel = channels[activeChannelId] || channels['channel-blender'] || Object.values(channels)[0];
  const channelVideos = videos.filter((v) => v.channelId === viewingChannel.id);

  // Reel Actions
  const handleToggleLikeReel = (reelId: string) => {
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      toggleLike(currentUser.uid, reelId, 'reel', 'like').catch(() => {});
    }
    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId
          ? {
              ...r,
              userLiked: !r.userLiked,
              likes: r.userLiked ? Math.max(0, r.likes - 1) : r.likes + 1,
            }
          : r
      )
    );
  };

  const handleToggleSaveReel = (reelId: string) => {
    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId ? { ...r, userSaved: !r.userSaved } : r
      )
    );
  };

  const handleAddReelComment = (reelId: string, text: string) => {
    const author = userProfile?.displayName || currentUser?.displayName || 'You';
    const handle = userProfile?.handle || '@you';
    const avatar =
      userProfile?.photoURL ||
      currentUser?.photoURL ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';

    const newComment: ReelComment = {
      id: `rc-${Date.now()}`,
      reelId,
      authorName: author,
      authorHandle: handle,
      authorAvatar: avatar,
      content: text,
      timestamp: 'Just now',
      likes: 0,
      userLiked: false,
    };

    setReelComments((prev) => ({
      ...prev,
      [reelId]: [newComment, ...(prev[reelId] || [])],
    }));

    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId ? { ...r, commentsCount: r.commentsCount + 1 } : r
      )
    );
  };

  const handleLikeReelComment = (reelId: string, commentId: string) => {
    setReelComments((prev) => ({
      ...prev,
      [reelId]: (prev[reelId] || []).map((c) =>
        c.id === commentId
          ? {
              ...c,
              userLiked: !c.userLiked,
              likes: c.userLiked ? Math.max(0, c.likes - 1) : c.likes + 1,
            }
          : c
      ),
    }));
  };

  // Filtered Videos for Homepage / Trending (includes title, description, category names, tags, and channel names)
  const filteredVideos = videos.filter((v) => {
    const term = activeSearchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      v.title.toLowerCase().includes(term) ||
      v.description.toLowerCase().includes(term) ||
      v.category.toLowerCase().includes(term) ||
      v.tags.some((t) => t.toLowerCase().includes(term)) ||
      (channels[v.channelId]?.name?.toLowerCase().includes(term) ?? false);

    const matchesCategory =
      selectedCategory === 'All'
        ? true
        : selectedCategory === 'Trending'
        ? v.isTrending
        : selectedCategory === 'Recently Uploaded'
        ? v.isLocal || v.publishedAt.includes('day') || v.publishedAt.includes('week')
        : v.category === selectedCategory;

    const matchesVisibility = (v.visibility || 'public') !== 'private';
    const matchesSafeSearch = !restrictedModePref || !v.ageRestricted;

    return matchesSearch && matchesCategory && matchesVisibility && matchesSafeSearch;
  });

  const trendingVideos = videos.filter(
    (v) => v.isTrending && (v.visibility || 'public') !== 'private' && (!restrictedModePref || !v.ageRestricted)
  );

  // Creator studio channel (either current user channel or first channel)
  const creatorChannelId = userProfile ? `channel-${userProfile.uid}` : 'channel-blender';
  const creatorChannel = channels[creatorChannelId] || channels['channel-blender'] || Object.values(channels)[0];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col antialiased selection:bg-[#FF0000] selection:text-white transition-colors">
      {/* Vio App Splash Screen on Opening */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* Ask Vio AI Floating Bar (Hidden on home, watch and reels pages so feed and players stay clear) */}
      {currentPage !== 'watch' && currentPage !== 'reels' && currentPage !== 'home' && (
        <AskVioBar
          onSearch={(q) => {
            setActiveSearchTerm(q);
            setSearchQuery(q);
            setCurrentPage('home');
          }}
          onOpenStudio={() => setCurrentPage('studio')}
          onOpenReels={() => setCurrentPage('reels')}
        />
      )}

      {/* Streamlined Navbar */}
      <Navbar
        onToggleSidebar={handleToggleSidebar}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={() => {
          const q = searchQuery.trim();
          setActiveSearchTerm(q);
          if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid && q) {
            recordSearchQuery(currentUser.uid, q);
          }
          if (currentPage !== 'home') setCurrentPage('home');
        }}
        onNavigateHome={() => {
          setCurrentPage('home');
          setSelectedCategory('All');
          setActiveSearchTerm('');
          setSearchQuery('');
          setMobileMenuOpen(false);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenStudio={() => {
          setCurrentPage('studio');
          setMobileMenuOpen(false);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCreate={() => {
          setCreateTarget('video');
          setIsCreateOpen(true);
        }}
        notifications={notifications}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onToggleNotificationRead={handleToggleNotificationRead}
        onDeleteNotification={handleDeleteNotification}
        onSelectVideo={(videoId) => {
          const video = videos.find((v) => v.id === videoId);
          if (video) handlePlayVideo(video);
        }}
        onSelectChannel={(channelId) => {
          handleSelectChannel(channelId);
          setMobileMenuOpen(false);
        }}
        onSimulateNotification={handleSimulateNotification}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="flex flex-1">
        {/* Sidebar: Desktop rail/expanded (hidden on mobile) + Mobile drawer */}
        <Sidebar
          currentPage={currentPage as NavigationPage}
          onNavigate={(page) => {
            setCurrentPage(page);
            setMobileMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          channels={Object.values(channels)}
          onSelectChannel={(channelId) => {
            handleSelectChannel(channelId);
            setMobileMenuOpen(false);
          }}
          isCollapsed={sidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onOpenFilters={() => setIsFiltersOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenCreate={() => {
            setCreateTarget('video');
            setIsCreateOpen(true);
          }}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Content View Switcher (with bottom safe-area padding on mobile for MobileBottomNav) */}
        <div className="flex-1 min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {/* WATCH VIEW */}
          {currentPage === 'watch' && (
            <WatchView
              video={activeVideo}
              channel={activeChannel}
              recommendedVideos={videos.filter((v) => v.id !== activeVideo.id)}
              channels={channels}
              comments={commentsMap[activeVideo.id] || []}
              onPlayVideo={handlePlayVideo}
              onSelectChannel={handleSelectChannel}
              onToggleSubscribe={handleToggleSubscribe}
              onUpdateNotificationBell={handleUpdateNotificationBell}
              onToggleLike={handleToggleLike}
              onToggleDislike={handleToggleDislike}
              onToggleWatchLater={handleToggleWatchLater}
              isWatchLater={watchLaterIds.includes(activeVideo.id)}
              onAddComment={handleAddComment}
              onLikeComment={handleLikeComment}
              onDislikeComment={handleDislikeComment}
              onDeleteComment={(commentId) => handleDeleteComment(activeVideo.id, commentId)}
              onAddReply={handleAddReply}
              userAvatar={userProfile?.photoURL || currentUser?.photoURL || undefined}
              currentUserHandle={userProfile?.handle || '@creative_viewer'}
              bookmarks={bookmarks}
              onAddBookmark={handleAddBookmark}
              onDeleteBookmark={handleDeleteBookmark}
              onUpdateBookmarkLabel={handleUpdateBookmarkLabel}
              onClearAllBookmarks={handleClearAllBookmarks}
              onOpenFilters={() => setIsFiltersOpen(true)}
              onOpenInfo={() => setIsInfoOpen(true)}
              filters={filters}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              initialSeekTime={initialSeekTime}
              ambientMode={ambientModePref}
            />
          )}

          {/* HOME VIEW (YouTube-style feed: Sticky Category Chips -> Top Video Row -> Shorts & Reels Shelf -> Video Grid) */}
          {currentPage === 'home' && (() => {
            const getWatchProgress = (video: VideoItem) => {
              const entry = history.find((h) => h.videoId === video.id);
              if (!entry || !video.duration) return 0;
              return Math.min(1, Math.max(0, entry.progressSeconds / video.duration));
            };

            const showReelsShelf =
              !activeSearchTerm &&
              reels.length > 0 &&
              (selectedCategory === 'All' || selectedCategory === 'Recently Uploaded');

            const topVideos = showReelsShelf ? filteredVideos.slice(0, 4) : filteredVideos;
            const remainingVideos = showReelsShelf ? filteredVideos.slice(4) : [];

            return (
              <div className="min-h-full bg-[var(--bg)]">
                <CategoryChips
                  selectedCategory={selectedCategory}
                  onSelectCategory={(cat) => {
                    if (cat === 'Reels') {
                      setCurrentPage('reels');
                    } else if (cat === 'Custom Feed') {
                      setCurrentPage('customFeed');
                    } else {
                      setSelectedCategory(cat);
                    }
                  }}
                />

                <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-8">
                  {activeSearchTerm && (
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--ink-faint)]">
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        Results for <span className="text-[var(--accent-ink)]">"{activeSearchTerm}"</span>
                      </p>
                      <button
                        onClick={() => {
                          setActiveSearchTerm('');
                          setSearchQuery('');
                        }}
                        className="text-xs font-medium text-[var(--ink-medium)] hover:text-[var(--ink)] px-3 py-1.5 rounded-full bg-[var(--card-hover)] transition-colors"
                      >
                        Clear search
                      </button>
                    </div>
                  )}

                  {filteredVideos.length === 0 ? (
                    <div className="py-20 text-center text-[var(--ink-medium)]">
                      <p className="text-base font-semibold text-[var(--ink)]">No matching videos found</p>
                      <p className="text-xs mt-1">Try another search query or category.</p>
                    </div>
                  ) : (
                    <>
                      {/* Primary Video Row / Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                        {topVideos.map((video) => (
                          <VideoCard
                            key={video.id}
                            video={video}
                            channel={channels[video.channelId]}
                            onPlay={handlePlayVideo}
                            onSelectChannel={handleSelectChannel}
                            onToggleWatchLater={handleToggleWatchLater}
                            isWatchLater={watchLaterIds.includes(video.id)}
                            watchProgress={getWatchProgress(video)}
                          />
                        ))}
                      </div>

                      {/* YouTube-style Shorts & Reels Horizontal Shelf */}
                      {showReelsShelf && (
                        <section className="pt-2 pb-4 border-y border-[var(--ink-faint)]">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF0000] text-white">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
                                Shorts & Reels
                              </h2>
                            </div>
                            <button
                              onClick={() => {
                                setInitialReelId(undefined);
                                setCurrentPage('reels');
                              }}
                              className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#3EA6FF] hover:bg-[#3EA6FF]/10 transition-colors"
                            >
                              View all
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                            {reels.slice(0, 6).map((reel) => (
                              <button
                                key={reel.id}
                                onClick={() => {
                                  setInitialReelId(reel.id);
                                  setCurrentPage('reels');
                                }}
                                className="group text-left flex flex-col focus:outline-none"
                              >
                                <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-[var(--thumb-bg)]">
                                  <img
                                    src={reel.poster || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'}
                                    alt={reel.title}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      const target = e.currentTarget as HTMLImageElement;
                                      const fallback = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80';
                                      if (target.src !== fallback) target.src = fallback;
                                    }}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />
                                </div>
                                <h3 className="mt-2 text-[14px] font-semibold text-[var(--ink)] line-clamp-2 leading-snug">
                                  {reel.title}
                                </h3>
                                <span className="mt-0.5 text-[12px] text-[var(--ink-medium)] tabular-nums">
                                  {formatViews(reel.views)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Remaining Videos Grid */}
                      {remainingVideos.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                          {remainingVideos.map((video) => (
                            <VideoCard
                              key={video.id}
                              video={video}
                              channel={channels[video.channelId]}
                              onPlay={handlePlayVideo}
                              onSelectChannel={handleSelectChannel}
                              onToggleWatchLater={handleToggleWatchLater}
                              isWatchLater={watchLaterIds.includes(video.id)}
                              watchProgress={getWatchProgress(video)}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* CUSTOM FEED VIEW (Algorithm driven, 24dp icons, lazy loading enabled) */}
          {currentPage === 'customFeed' && (
            <CustomFeedView
              videos={videos}
              channels={channels}
              onPlayVideo={handlePlayVideo}
              onSelectChannel={handleSelectChannel}
              onToggleWatchLater={handleToggleWatchLater}
              watchLaterIds={watchLaterIds}
            />
          )}

          {/* REELS VIEW */}
          {currentPage === 'reels' && (
            <ReelsView
              reels={reels}
              channels={channels}
              commentsMap={reelComments}
              onToggleFollow={handleToggleSubscribe}
              onSelectChannel={handleSelectChannel}
              onAddComment={handleAddReelComment}
              onLikeComment={handleLikeReelComment}
              onToggleLikeReel={handleToggleLikeReel}
              onToggleSaveReel={handleToggleSaveReel}
              onNavigateHome={() => setCurrentPage('home')}
              onOpenUpload={() => {
                setCreateTarget('reel');
                setIsCreateOpen(true);
              }}
              initialReelId={initialReelId}
            />
          )}

          {/* CREATOR STUDIO VIEW */}
          {currentPage === 'studio' && (
            <CreatorDashboard
              channel={creatorChannel}
              videos={videos}
              comments={commentsMap}
              onPlayVideo={handlePlayVideo}
              onOpenUpload={() => {
                setCreateTarget('video');
                setIsCreateOpen(true);
              }}
              onUpdateVideo={handleUpdateVideo}
              onDeleteVideo={handleDeleteVideo}
              onUpdateChannel={handleUpdateChannel}
              onDeleteComment={handleDeleteComment}
            />
          )}

          {/* TRENDING VIEW */}
          {currentPage === 'trending' && (
            <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
              <div className="pb-3 border-b border-[var(--ink-faint)]">
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                  Trending on Vio streaming
                </h1>
                <p className="text-xs text-[var(--ink-medium)] mt-0.5">
                  The most watched animations, short films, and high-definition reels right now
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {trendingVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    channel={channels[video.channelId]}
                    onPlay={handlePlayVideo}
                    onSelectChannel={handleSelectChannel}
                    onToggleWatchLater={handleToggleWatchLater}
                    isWatchLater={watchLaterIds.includes(video.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS VIEW */}
          {currentPage === 'subscriptions' && (
            <SubscriptionsView
              subscribedChannels={Object.values(channels).filter((c) => c.isSubscribed)}
              allChannels={Object.values(channels)}
              videos={videos}
              channelsMap={channels}
              onPlayVideo={handlePlayVideo}
              onSelectChannel={handleSelectChannel}
              onToggleSubscribe={handleToggleSubscribe}
              onToggleWatchLater={handleToggleWatchLater}
              watchLaterIds={watchLaterIds}
            />
          )}

          {/* CHANNEL VIEW */}
          {currentPage === 'channel' && (
            <ChannelView
              channel={viewingChannel}
              channelVideos={channelVideos}
              onPlayVideo={handlePlayVideo}
              onToggleSubscribe={handleToggleSubscribe}
              onUpdateNotificationBell={handleUpdateNotificationBell}
              onToggleWatchLater={handleToggleWatchLater}
              watchLaterIds={watchLaterIds}
            />
          )}

          {/* LIBRARY / PLAYLIST VIEWS */}
          {(currentPage === 'history' || currentPage === 'liked' || currentPage === 'watchLater') && (
            <LibraryView
              initialTab={currentPage as 'history' | 'liked' | 'watchLater'}
              videos={videos}
              channelsMap={channels}
              history={history}
              likedVideoIds={likedVideoIds}
              watchLaterIds={watchLaterIds}
              onPlayVideo={handlePlayVideo}
              onSelectChannel={handleSelectChannel}
              onClearHistory={handleClearHistory}
              onToggleWatchLater={handleToggleWatchLater}
              onRemoveFromHistory={handleRemoveFromHistory}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <MobileBottomNav
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setMobileMenuOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenStudio={() => {
          setCurrentPage('studio');
          setMobileMenuOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenCreate={() => {
          setCreateTarget('video');
          setIsCreateOpen(true);
        }}
      />

      {/* Modals & Dialogs */}
      <CreateVideoModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPublishVideo={handlePublishVideo}
        onPublishReel={handlePublishReel}
        defaultTarget={createTarget}
        channels={Object.values(channels)}
        onOpenAuth={() => {
          setIsCreateOpen(false);
          setIsAuthOpen(true);
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <ProfileManagementModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <FilterControls
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onChangeFilters={setFilters}
        onResetFilters={() => setFilters(DEFAULT_FILTERS)}
      />

      <VideoInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        video={activeVideo}
        aspectRatio={aspectRatio}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onClearHistory={handleClearHistory}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onPreferencesChange={refreshPreferences}
      />



      {/* AI Assistant Button (hidden on reels/watch so player controls stay unobstructed) */}
      {currentPage !== 'reels' && currentPage !== 'watch' && (
        <AIAssistantButton
          currentVideoTitle={activeVideo?.title}
          videos={videos}
          channels={channels}
          onPlayVideo={handlePlayVideo}
          onSelectChannel={handleSelectChannel}
          onOpenSearch={(q) => {
            setActiveSearchTerm(q);
            setSearchQuery(q);
            if (currentPage !== 'home') setCurrentPage('home');
          }}
          onNavigateStudio={() => setCurrentPage('studio')}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
