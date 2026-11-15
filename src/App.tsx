import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
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
import { CustomFeedView } from './components/CustomFeedView';
import { SettingsModal } from './components/SettingsModal';
import { MiniplayerDock } from './components/MiniplayerDock';
import { auth, testFirestoreConnection } from './firebase';
import {
  seedInitialFirestoreData,
  subscribeVideos,
  subscribeReels,
  subscribeComments,
  subscribeNotifications,
  markNotificationAsRead,
  deleteNotificationDoc,
  createNotification,
  toggleLike,
  toggleSubscription,
  addCommentDoc,
  toggleCommentLikeDoc,
  updateCommentContentDoc,
  pinCommentDoc,
  incrementCommentRepliesDoc,
  deleteCommentDoc,
  incrementVideoViews,
  incrementReelViews,
  recordWatchHistory,
  fetchWatchHistory,
  removeWatchHistoryDoc,
  clearWatchHistoryDocs,
  recordSearchQuery,
  recordStreamAnalytics,
  updateVideoDoc,
  deleteVideoDoc,
  updateReelDoc,
  deleteReelDoc,
  createPlaylist,
  subscribeUserPlaylists,
  updatePlaylistVideosDoc,
  deletePlaylistDoc,
  fetchUserSubscriptions,
  fetchUserReactions,
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
  ReelComment,
  PlaylistItem
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
  const [searchSortBy, setSearchSortBy] = useState<'relevance' | 'views' | 'likes'>('relevance');
  const [searchDurationFilter, setSearchDurationFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(() => {
    return localStorage.getItem('vio_pref_theater') === 'true';
  });
  const [miniplayerState, setMiniplayerState] = useState<{ videoId: string; startTime: number } | null>(null);
  const [activeQueue, setActiveQueue] = useState<{
    title: string;
    videoIds: string[];
    shuffle: boolean;
    loop: boolean;
  } | null>(null);

  // App Splash Screen State (shown once per browser session)
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('vio_splash_seen') !== '1';
    } catch {
      return true;
    }
  });

  // Reels State (with localStorage persistence for likes, saves, and comments)
  const [reels, setReels] = useState<ReelItem[]>(() => {
    try {
      const savedStates = localStorage.getItem('vio_streaming_reel_states');
      if (savedStates) {
        const stateMap = JSON.parse(savedStates) as Record<string, { userLiked?: boolean; userSaved?: boolean; likesDelta?: number }>;
        return INITIAL_REELS.map((r) => {
          const st = stateMap[r.id];
          if (!st) return r;
          return {
            ...r,
            userLiked: !!st.userLiked,
            userSaved: !!st.userSaved,
            likes: typeof st.likesDelta === 'number' ? Math.max(0, r.likes + st.likesDelta) : r.likes,
          };
        });
      }
    } catch {
      // ignore
    }
    return INITIAL_REELS;
  });
  const [reelComments, setReelComments] = useState<Record<string, ReelComment[]>>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_reel_comments');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_REEL_COMMENTS;
  });

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

  const [playlists, setPlaylists] = useState<PlaylistItem[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_playlists');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'pl-favorites',
        title: 'Cinematography & Open Films',
        description: 'Curated showcase of 4K open animations and VFX breakdowns',
        videoIds: ['video-bbb', 'video-sintel'],
        isPublic: true,
        createdAt: Date.now() - 86400000,
      },
    ];
  });

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vio_streaming_search_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
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
  const lastWatchSyncRef = useRef<Record<string, number>>({});

  // Resolve shared deep links (?v=id&t=sec, ?reel=id, or ?channel=id)
  useEffect(() => {
    if (deepLinkResolvedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const vParam = params.get('v');
    const tParam = params.get('t');
    const reelParam = params.get('reel');
    const channelParam = params.get('channel');

    if (!vParam && !reelParam && !channelParam) {
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

    if (channelParam) {
      const matchedChannel = channels[channelParam];
      if (matchedChannel) {
        setActiveChannelId(matchedChannel.id);
        setCurrentPage('channel');
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
  }, [videos, reels, channels]);

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

    // Live real-time sync for reels collection (preserving local userLiked/userSaved flags)
    const unsubReels = subscribeReels((firestoreReels) => {
      if (firestoreReels && firestoreReels.length > 0) {
        let stateMap: Record<string, { userLiked?: boolean; userSaved?: boolean }> = {};
        try {
          const savedStates = localStorage.getItem('vio_streaming_reel_states');
          if (savedStates) stateMap = JSON.parse(savedStates);
        } catch {
          // ignore
        }
        setReels(
          firestoreReels.map((r) => {
            const st = stateMap[r.id];
            return st
              ? { ...r, userLiked: !!st.userLiked, userSaved: !!st.userSaved }
              : r;
          })
        );
      }
    });

    return () => {
      unsubVideos();
      unsubReels();
    };
  }, []);

  // Firestore User Subscriptions, Reactions, History, Playlists, and Notifications (when signed in)
  useEffect(() => {
    if (currentUser?.uid && auth.currentUser && auth.currentUser.uid === currentUser.uid) {
      // Live notifications
      const unsubNotifs = subscribeNotifications(currentUser.uid, (userNotifs) => {
        if (userNotifs) {
          setNotifications(userNotifs);
        }
      });

      // Live user playlists
      const unsubPlaylists = subscribeUserPlaylists(currentUser.uid, (fsPlaylists) => {
        if (fsPlaylists) {
          setPlaylists(fsPlaylists);
        }
      });

      // User subscriptions from Firestore
      fetchUserSubscriptions(currentUser.uid)
        .then((subChannels) => {
          setChannels((prev) => {
            const next = { ...prev };
            for (const chId in next) {
              next[chId] = { ...next[chId], isSubscribed: subChannels.has(chId) };
            }
            return next;
          });
        })
        .catch(() => {});

      // User likes & dislikes from Firestore
      fetchUserReactions(currentUser.uid)
        .then(({ likes, dislikes }) => {
          setLikedVideoIds(Array.from(likes));
          setVideos((prev) =>
            prev.map((v) => ({
              ...v,
              userLiked: likes.has(v.id),
              userDisliked: dislikes.has(v.id),
            }))
          );
          setReels((prev) =>
            prev.map((r) => ({
              ...r,
              userLiked: likes.has(r.id),
            }))
          );
        })
        .catch(() => {});

      // User watch history from Firestore
      fetchWatchHistory(currentUser.uid)
        .then((rows) => {
          if (Array.isArray(rows) && rows.length > 0) {
            const mapped: HistoryItem[] = rows
              .filter((r) => r.videoId)
              .map((r) => ({
                videoId: r.videoId,
                watchedAt: typeof r.watchedAt === 'number' ? r.watchedAt : Date.now(),
                progressSeconds: typeof r.progressSeconds === 'number' ? r.progressSeconds : 0,
              }))
              .sort((a, b) => b.watchedAt - a.watchedAt);
            if (mapped.length > 0) {
              setHistory(mapped);
            }
          }
        })
        .catch(() => {});

      return () => {
        unsubNotifs();
        unsubPlaylists();
      };
    } else if (currentUser === null) {
      // Clear signed-in user flags cleanly when signed out
      setChannels((prev) => {
        const next = { ...prev };
        for (const chId in next) {
          next[chId] = { ...next[chId], isSubscribed: false };
        }
        return next;
      });
      setVideos((prev) =>
        prev.map((v) => ({
          ...v,
          userLiked: false,
          userDisliked: false,
        }))
      );
      setReels((prev) =>
        prev.map((r) => ({
          ...r,
          userLiked: false,
        }))
      );
      setLikedVideoIds([]);
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
    localStorage.setItem('vio_streaming_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_search_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('vio_streaming_reel_comments', JSON.stringify(reelComments));
  }, [reelComments]);

  useEffect(() => {
    const stateMap: Record<string, { userLiked: boolean; userSaved: boolean; likesDelta: number }> = {};
    reels.forEach((r) => {
      const baseLikes = INITIAL_REELS.find((ir) => ir.id === r.id)?.likes ?? r.likes;
      if (r.userLiked || r.userSaved || r.likes !== baseLikes) {
        stateMap[r.id] = {
          userLiked: !!r.userLiked,
          userSaved: !!r.userSaved,
          likesDelta: r.likes - baseLikes,
        };
      }
    });
    localStorage.setItem('vio_streaming_reel_states', JSON.stringify(stateMap));
  }, [reels]);

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
  const handleToggleTheaterMode = useCallback(() => {
    setIsTheaterMode((prev) => {
      const next = !prev;
      localStorage.setItem('vio_pref_theater', String(next));
      return next;
    });
  }, []);

  const handlePlayVideo = (video: VideoItem, seekSeconds: number | null = null) => {
    setMiniplayerState(null);
    setInitialSeekTime(seekSeconds);
    setActiveVideoId(video.id);
    setCurrentPage('watch');

    if (saveHistoryPref) {
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.videoId !== video.id);
        return [{ videoId: video.id, watchedAt: Date.now(), progressSeconds: seekSeconds ?? 15 }, ...filtered];
      });
      if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
        recordWatchHistory(currentUser.uid, video, seekSeconds ?? 15);
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

  const handlePlayQueue = (title: string, videoIds: string[]) => {
    const validIds = videoIds.filter((id) => videos.some((v) => v.id === id));
    if (validIds.length === 0) return;
    setActiveQueue({
      title,
      videoIds: validIds,
      shuffle: false,
      loop: false,
    });
    const first = videos.find((v) => v.id === validIds[0]);
    if (first) handlePlayVideo(first);
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
    const existingVideo = videos.find((v) => v.id === videoId);
    const wasLiked = !!existingVideo?.userLiked;

    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      toggleLike(currentUser.uid, videoId, 'video', 'dislike').catch(() => {});
    }

    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === videoId) {
          const isDisliked = !v.userDisliked;
          return {
            ...v,
            userDisliked: isDisliked,
            userLiked: false,
            likes: v.userLiked ? Math.max(0, v.likes - 1) : v.likes,
          };
        }
        return v;
      })
    );

    if (wasLiked) {
      setLikedVideoIds((prev) => prev.filter((id) => id !== videoId));
    }
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
      userId: currentUser?.uid,
      authorName,
      authorHandle,
      authorAvatar,
      content,
      timestamp: 'Just now',
      createdAt: Date.now(),
      likes: 0,
      userLiked: false,
      userDisliked: false,
      replies: [],
    };

    // Persist comment to Firestore with matching document ID
    addCommentDoc(videoId, content, authorName, authorAvatar, commentId, authorHandle).catch((err) => {
      console.warn('Could not persist comment to Firestore:', err);
    });

    setCommentsMap((prev) => ({
      ...prev,
      [videoId]: [newComment, ...(prev[videoId] || [])],
    }));
  };

  const handleLikeComment = (commentId: string) => {
    let toggledNextLiked: boolean | null = null;
    setCommentsMap((prev) => {
      const updated = { ...prev };
      for (const vid in updated) {
        updated[vid] = updated[vid].map((c) => {
          if (c.id === commentId) {
            const nextLiked = !c.userLiked;
            toggledNextLiked = nextLiked;
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
    if (toggledNextLiked !== null && currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      toggleCommentLikeDoc(commentId, toggledNextLiked).catch(() => {});
    }
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

    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      incrementCommentRepliesDoc(commentId).catch(() => {});
    }

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

  const handleEditComment = (commentId: string, content: string) => {
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      updateCommentContentDoc(commentId, content).catch(() => {});
    }
    setCommentsMap((prev) => {
      const updated = { ...prev };
      for (const vid in updated) {
        updated[vid] = updated[vid].map((c) =>
          c.id === commentId ? { ...c, content, isEdited: true } : c
        );
      }
      return updated;
    });
  };

  const handlePinComment = (commentId: string) => {
    const videoComments = commentsMap[activeVideo.id] || [];
    const target = videoComments.find((c) => c.id === commentId);
    if (!target) return;
    const nextPinned = !target.isPinned;

    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      pinCommentDoc(commentId, nextPinned).catch(() => {});
      videoComments.forEach((c) => {
        if (c.id !== commentId && c.isPinned) {
          pinCommentDoc(c.id, false).catch(() => {});
        }
      });
    }

    setCommentsMap((prev) => ({
      ...prev,
      [activeVideo.id]: (prev[activeVideo.id] || []).map((c) =>
        c.id === commentId
          ? { ...c, isPinned: nextPinned }
          : nextPinned
          ? { ...c, isPinned: false }
          : c
      ),
    }));
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

    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      createNotification({
        userId: currentUser.uid,
        type: 'upload',
        title: 'Video Published',
        message: `Your video "${newVideo.title}" is now live on Vio streaming.`,
        avatar: userProfile?.photoURL || currentUser.photoURL || '',
        thumbnailUrl: newVideo.poster,
        videoId: newVideo.id,
        channelId: newVideo.channelId,
      }).catch(() => {});
    }

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
    const remaining = videos.filter((v) => v.id !== videoId);
    setVideos(remaining);
    if (activeVideoId === videoId) {
      setActiveVideoId(remaining[0]?.id || INITIAL_VIDEOS[0].id);
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
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      createNotification({
        userId: currentUser.uid,
        type: 'upload',
        title: 'Reel Published',
        message: `Your Reel "${newReel.title}" is live on Vio Reels.`,
        avatar: userProfile?.photoURL || currentUser.photoURL || '',
        thumbnailUrl: newReel.poster,
        channelId: newReel.channelId,
      }).catch(() => {});
    }
    setInitialReelId(newReel.id);
    setCurrentPage('reels');
  };

  const handleUpdateReel = (updatedReel: ReelItem) => {
    setReels((prev) => prev.map((r) => (r.id === updatedReel.id ? updatedReel : r)));
    updateReelDoc(updatedReel.id, updatedReel).catch(() => {});
  };

  const handleDeleteReel = (reelId: string) => {
    setReels((prev) => prev.filter((r) => r.id !== reelId));
    deleteReelDoc(reelId).catch(() => {});
  };

  const handleReelView = useCallback((reelId: string) => {
    setReels((prev) =>
      prev.map((r) => (r.id === reelId ? { ...r, views: (r.views || 0) + 1 } : r))
    );
    incrementReelViews(reelId);
  }, []);

  const handleDeleteComment = (videoId: string, commentId: string) => {
    deleteCommentDoc(commentId).catch(() => {});
    setCommentsMap((prev) => ({
      ...prev,
      [videoId]: (prev[videoId] || []).filter((c) => c.id !== commentId),
    }));
  };

  const handleClearHistory = () => {
    setHistory([]);
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      clearWatchHistoryDocs(currentUser.uid).catch(() => {});
    }
  };

  const handleRemoveFromHistory = (videoId: string) => {
    setHistory((prev) => prev.filter((h) => h.videoId !== videoId));
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      removeWatchHistoryDoc(currentUser.uid, videoId).catch(() => {});
    }
  };

  const handleUpdateWatchProgress = useCallback(
    (video: VideoItem, seconds: number) => {
      if (!saveHistoryPref) return;
      const rounded = Math.max(0, Math.round(seconds));
      setHistory((prev) => {
        const existing = prev.find((h) => h.videoId === video.id);
        const others = prev.filter((h) => h.videoId !== video.id);
        return [
          {
            videoId: video.id,
            watchedAt: existing?.watchedAt || Date.now(),
            progressSeconds: rounded,
          },
          ...others,
        ];
      });
      if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
        const now = Date.now();
        const lastSync = lastWatchSyncRef.current[video.id] || 0;
        if (now - lastSync >= 15000) {
          lastWatchSyncRef.current[video.id] = now;
          recordWatchHistory(currentUser.uid, video, rounded);
        }
      }
    },
    [saveHistoryPref, currentUser]
  );

  const handleCreatePlaylist = useCallback(
    (title: string, initialVideoId?: string) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;
      const newId = `pl-${Date.now()}`;
      const videoIds = initialVideoId ? [initialVideoId] : [];
      const newPlaylist: PlaylistItem = {
        id: newId,
        userId: currentUser?.uid,
        title: cleanTitle,
        description: '',
        videoIds,
        isPublic: true,
        createdAt: Date.now(),
      };
      setPlaylists((prev) => [newPlaylist, ...prev]);
      if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
        createPlaylist(currentUser.uid, cleanTitle, '', true, newId, videoIds).catch(() => {});
      }
    },
    [currentUser]
  );

  const handleToggleVideoInPlaylist = useCallback(
    (playlistId: string, videoId: string) => {
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          const exists = pl.videoIds.includes(videoId);
          const nextIds = exists
            ? pl.videoIds.filter((id) => id !== videoId)
            : [...pl.videoIds, videoId];
          if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
            updatePlaylistVideosDoc(playlistId, nextIds).catch(() => {});
          }
          return { ...pl, videoIds: nextIds, updatedAt: Date.now() };
        })
      );
    },
    [currentUser]
  );

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
      if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
        deletePlaylistDoc(playlistId).catch(() => {});
      }
    },
    [currentUser]
  );

  const handleRemoveSearchHistoryItem = useCallback((term: string) => {
    setSearchHistory((prev) => prev.filter((t) => t !== term));
  }, []);

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
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      notifications.forEach((n) => {
        if (!n.read) markNotificationAsRead(n.id).catch(() => {});
      });
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleToggleNotificationRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (target && !target.read && currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      markNotificationAsRead(id).catch(() => {});
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleDeleteNotification = (id: string) => {
    if (currentUser?.uid && auth.currentUser?.uid === currentUser.uid) {
      deleteNotificationDoc(id).catch(() => {});
    }
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
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setMobileMenuOpen((prev) => !prev);
    }
  };

  // Active Video & Channel Resolution (with dynamic fallback if video references an external/unlisted channel)
  const activeVideo = videos.find((v) => v.id === activeVideoId) || videos[0] || INITIAL_VIDEOS[0];
  const activeChannel =
    channels[activeVideo.channelId] || {
      id: activeVideo.channelId || 'channel-vio',
      name: activeVideo.author || 'Vio Creator',
      handle: `@${(activeVideo.author || 'viocreator').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      verified: true,
      subscribersCount: 1200,
      isSubscribed: false,
      notificationBell: 'personalized',
      bio: 'Creator on Vio streaming.',
      joinedDate: 'Joined recently',
      videoCount: 1,
    };
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

  // Filtered Videos for Homepage / Trending (includes title, description, category names, tags, and channel names + Search Filters)
  const searchTermLower = activeSearchTerm.toLowerCase().trim();
  const baseFilteredVideos = videos.filter((v) => {
    const matchesSearch =
      !searchTermLower ||
      v.title.toLowerCase().includes(searchTermLower) ||
      v.description.toLowerCase().includes(searchTermLower) ||
      v.category.toLowerCase().includes(searchTermLower) ||
      v.tags.some((t) => t.toLowerCase().includes(searchTermLower)) ||
      (channels[v.channelId]?.name?.toLowerCase().includes(searchTermLower) ?? false);

    const matchesCategory =
      selectedCategory === 'All'
        ? true
        : selectedCategory === 'Trending'
        ? v.isTrending
        : selectedCategory === 'Recently Uploaded'
        ? v.isLocal || v.publishedAt.includes('day') || v.publishedAt.includes('week')
        : v.category === selectedCategory;

    const matchesDuration =
      !searchTermLower || searchDurationFilter === 'all'
        ? true
        : searchDurationFilter === 'short'
        ? v.duration > 0 && v.duration < 240
        : searchDurationFilter === 'medium'
        ? v.duration >= 240 && v.duration <= 1200
        : v.duration > 1200;

    const matchesVisibility = (v.visibility || 'public') !== 'private';
    const matchesSafeSearch = !restrictedModePref || !v.ageRestricted;

    return matchesSearch && matchesCategory && matchesDuration && matchesVisibility && matchesSafeSearch;
  });

  const filteredVideos =
    searchTermLower && searchSortBy === 'views'
      ? [...baseFilteredVideos].sort((a, b) => b.views - a.views)
      : searchTermLower && searchSortBy === 'likes'
      ? [...baseFilteredVideos].sort((a, b) => b.likes - a.likes)
      : baseFilteredVideos;

  const matchingChannels = searchTermLower
    ? Object.values(channels).filter(
        (ch) =>
          ch.name.toLowerCase().includes(searchTermLower) ||
          ch.handle.toLowerCase().includes(searchTermLower)
      )
    : [];

  const matchingReels = searchTermLower
    ? reels.filter(
        (r) =>
          (r.visibility || 'public') !== 'private' &&
          (r.title.toLowerCase().includes(searchTermLower) ||
            r.description.toLowerCase().includes(searchTermLower) ||
            r.tags.some((t) => t.toLowerCase().includes(searchTermLower)))
      )
    : [];

  const trendingVideos = videos.filter(
    (v) => v.isTrending && (v.visibility || 'public') !== 'private' && (!restrictedModePref || !v.ageRestricted)
  );

  // Creator studio channel (either current user channel or first channel)
  const creatorChannelId = userProfile ? `channel-${userProfile.uid}` : 'channel-blender';
  const creatorChannel = channels[creatorChannelId] || channels['channel-blender'] || Object.values(channels)[0];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col antialiased selection:bg-[#FF0000] selection:text-white transition-colors">
      {/* Vio App Splash Screen (once per session) */}
      {showSplash && (
        <SplashScreen
          onFinish={() => {
            try {
              sessionStorage.setItem('vio_splash_seen', '1');
            } catch {
              // ignore
            }
            setShowSplash(false);
          }}
        />
      )}

      {/* Streamlined Navbar */}
      <Navbar
        onToggleSidebar={handleToggleSidebar}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={(overrideQuery) => {
          const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
          setActiveSearchTerm(q);
          if (q) {
            setSearchHistory((prev) => [q, ...prev.filter((t) => t.toLowerCase() !== q.toLowerCase())].slice(0, 12));
          }
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
        hideOnMobile={currentPage === 'reels'}
        searchHistory={searchHistory}
        onRemoveSearchHistoryItem={handleRemoveSearchHistoryItem}
        videos={videos}
        channels={Object.values(channels)}
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

        {/* Content View Switcher (Reels sits flush above MobileBottomNav; other pages include safe bottom padding) */}
        <div
          className={
            currentPage === 'reels'
              ? 'flex-1 min-w-0 h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-3.5rem)] overflow-hidden'
              : 'flex-1 min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0'
          }
        >
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
              onEditComment={handleEditComment}
              onPinComment={handlePinComment}
              canPinComments={Boolean(
                currentUser?.uid &&
                  (activeVideo.ownerId === currentUser.uid ||
                    activeVideo.channelId === `channel-${currentUser.uid}`)
              )}
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
              currentUserId={currentUser?.uid}
              savedProgressSeconds={history.find((h) => h.videoId === activeVideo.id)?.progressSeconds || 0}
              onWatchProgress={handleUpdateWatchProgress}
              playlists={playlists}
              onToggleVideoInPlaylist={handleToggleVideoInPlaylist}
              onCreatePlaylist={handleCreatePlaylist}
              ambientMode={ambientModePref}
              isTheaterMode={isTheaterMode}
              onToggleTheaterMode={handleToggleTheaterMode}
              onEnterMiniplayer={(currTime) => {
                setMiniplayerState({ videoId: activeVideo.id, startTime: Math.floor(currTime) });
                setCurrentPage('home');
              }}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
              activePlaylist={
                activeQueue
                  ? {
                      title: activeQueue.title,
                      videos: activeQueue.videoIds
                        .map((id) => videos.find((v) => v.id === id))
                        .filter(Boolean) as VideoItem[],
                      shuffle: activeQueue.shuffle,
                      loop: activeQueue.loop,
                    }
                  : null
              }
              onToggleQueueShuffle={() =>
                setActiveQueue((prev) => (prev ? { ...prev, shuffle: !prev.shuffle } : null))
              }
              onToggleQueueLoop={() =>
                setActiveQueue((prev) => (prev ? { ...prev, loop: !prev.loop } : null))
              }
              onCloseQueue={() => setActiveQueue(null)}
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
                    <div className="space-y-5">
                      {/* Search Header + Filters */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--ink-faint)]">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            Results for <span className="text-[var(--accent-ink)]">"{activeSearchTerm}"</span>
                          </p>
                          <p className="text-xs text-[var(--ink-medium)] tabular-nums mt-0.5">
                            {filteredVideos.length} videos · {matchingReels.length} reels · {matchingChannels.length} channels
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label="Sort search results"
                            value={searchSortBy}
                            onChange={(e) => setSearchSortBy(e.target.value as 'relevance' | 'views' | 'likes')}
                            className="min-h-[34px] rounded-full border border-[var(--ink-faint)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--ink)] focus:outline-none cursor-pointer"
                          >
                            <option value="relevance">Relevance</option>
                            <option value="views">Most Viewed</option>
                            <option value="likes">Most Liked</option>
                          </select>

                          <select
                            aria-label="Filter by video duration"
                            value={searchDurationFilter}
                            onChange={(e) => setSearchDurationFilter(e.target.value as 'all' | 'short' | 'medium' | 'long')}
                            className="min-h-[34px] rounded-full border border-[var(--ink-faint)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--ink)] focus:outline-none cursor-pointer"
                          >
                            <option value="all">Any duration</option>
                            <option value="short">Under 4 min</option>
                            <option value="medium">4–20 min</option>
                            <option value="long">Over 20 min</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveSearchTerm('');
                              setSearchQuery('');
                              setSearchSortBy('relevance');
                              setSearchDurationFilter('all');
                            }}
                            className="min-h-[34px] text-xs font-medium text-[var(--ink-medium)] hover:text-[var(--ink)] px-3 py-1.5 rounded-full bg-[var(--card-hover)] transition-colors cursor-pointer"
                          >
                            Clear search
                          </button>
                        </div>
                      </div>

                      {/* Matching Channels */}
                      {matchingChannels.length > 0 && (
                        <div className="space-y-2.5">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                            Channels
                          </h2>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {matchingChannels.map((ch) => (
                              <div
                                key={ch.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-3"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSelectChannel(ch.id)}
                                  className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                                >
                                  <img
                                    src={ch.avatar}
                                    alt={ch.name}
                                    referrerPolicy="no-referrer"
                                    className="h-12 w-12 rounded-full object-cover shrink-0 bg-[var(--thumb-bg)]"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-sm font-bold text-[var(--ink)] truncate">
                                        {ch.name}
                                      </span>
                                      {ch.verified && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-ink)] shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-xs text-[var(--ink-medium)] truncate">
                                      {ch.handle}
                                    </p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubscribe(ch.id)}
                                  className={`min-h-[36px] rounded-full px-4 py-1.5 text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                                    ch.isSubscribed
                                      ? 'bg-[var(--card-hover)] text-[var(--ink)] border border-[var(--ink-faint)]'
                                      : 'bg-[#FF0000] text-white hover:bg-[#CC0000]'
                                  }`}
                                >
                                  {ch.isSubscribed ? 'Following' : 'Follow'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matching Reels */}
                      {matchingReels.length > 0 && (
                        <div className="space-y-2.5">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-medium)]">
                            Matching Shorts & Reels
                          </h2>
                          <div className="flex overflow-x-auto gap-3 pb-1 no-scrollbar">
                            {matchingReels.slice(0, 8).map((reel) => (
                              <button
                                key={`sr-${reel.id}`}
                                type="button"
                                onClick={() => {
                                  setInitialReelId(reel.id);
                                  setCurrentPage('reels');
                                }}
                                className="group text-left w-36 shrink-0 cursor-pointer"
                              >
                                <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-[var(--thumb-bg)] border border-[var(--ink-faint)]">
                                  <img
                                    src={reel.poster}
                                    alt={reel.title}
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 to-transparent" />
                                  <div className="absolute bottom-2 inset-x-2 text-white">
                                    <p className="text-[11px] font-bold line-clamp-2 leading-tight">{reel.title}</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {filteredVideos.length === 0 && matchingChannels.length === 0 && matchingReels.length === 0 ? (
                    <div className="py-20 text-center text-[var(--ink-medium)]">
                      <p className="text-base font-semibold text-[var(--ink)]">No matching videos found</p>
                      <p className="text-xs mt-1">Try another search query, duration filter, or category.</p>
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
                            playlists={playlists}
                            onAddToPlaylist={handleToggleVideoInPlaylist}
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

                          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 no-scrollbar sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3.5">
                            {reels.slice(0, 6).map((reel) => (
                              <button
                                key={reel.id}
                                onClick={() => {
                                  setInitialReelId(reel.id);
                                  setCurrentPage('reels');
                                }}
                                className="group text-left flex flex-col focus:outline-none w-[42vw] max-w-[170px] shrink-0 snap-start sm:w-auto sm:max-w-none"
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
                              playlists={playlists}
                              onAddToPlaylist={handleToggleVideoInPlaylist}
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

          {/* CUSTOM FEED VIEW */}
          {currentPage === 'customFeed' && (
            <CustomFeedView
              videos={videos}
              channels={channels}
              onPlayVideo={handlePlayVideo}
              onSelectChannel={handleSelectChannel}
              onToggleWatchLater={handleToggleWatchLater}
              watchLaterIds={watchLaterIds}
              playlists={playlists}
              onAddToPlaylist={handleToggleVideoInPlaylist}
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
              onReelView={handleReelView}
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
              reels={reels}
              comments={commentsMap}
              onPlayVideo={handlePlayVideo}
              onPlayReel={(reelId) => {
                setInitialReelId(reelId);
                setCurrentPage('reels');
              }}
              onOpenUpload={() => {
                setCreateTarget('video');
                setIsCreateOpen(true);
              }}
              onUpdateVideo={handleUpdateVideo}
              onDeleteVideo={handleDeleteVideo}
              onUpdateReel={handleUpdateReel}
              onDeleteReel={handleDeleteReel}
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

              {trendingVideos.length === 0 ? (
                <div className="py-20 text-center text-[var(--ink-medium)]">
                  <p className="text-base font-semibold text-[var(--ink)]">
                    No trending videos right now
                  </p>
                  <p className="text-xs mt-1">
                    Check back soon or adjust Restricted Mode in Settings.
                  </p>
                </div>
              ) : (
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
                      playlists={playlists}
                      onAddToPlaylist={handleToggleVideoInPlaylist}
                    />
                  ))}
                </div>
              )}
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
              playlists={playlists}
              onAddToPlaylist={handleToggleVideoInPlaylist}
            />
          )}

          {/* CHANNEL VIEW */}
          {currentPage === 'channel' && (
            <ChannelView
              channel={viewingChannel}
              channelVideos={channelVideos}
              channelReels={reels.filter((r) => r.channelId === viewingChannel.id)}
              playlists={playlists}
              onPlayVideo={handlePlayVideo}
              onToggleSubscribe={handleToggleSubscribe}
              onUpdateNotificationBell={handleUpdateNotificationBell}
              onToggleWatchLater={handleToggleWatchLater}
              watchLaterIds={watchLaterIds}
              onAddToPlaylist={handleToggleVideoInPlaylist}
              onOpenReel={(reelId) => {
                setInitialReelId(reelId);
                setCurrentPage('reels');
              }}
              onPlayQueue={handlePlayQueue}
            />
          )}

          {/* LIBRARY / PLAYLIST VIEWS */}
          {(currentPage === 'history' || currentPage === 'liked' || currentPage === 'watchLater' || currentPage === 'playlists') && (
            <LibraryView
              initialTab={currentPage as 'history' | 'liked' | 'watchLater' | 'playlists'}
              videos={videos}
              reels={reels}
              channelsMap={channels}
              history={history}
              likedVideoIds={likedVideoIds}
              watchLaterIds={watchLaterIds}
              playlists={playlists}
              onPlayVideo={handlePlayVideo}
              onSelectChannel={handleSelectChannel}
              onClearHistory={handleClearHistory}
              onToggleWatchLater={handleToggleWatchLater}
              onRemoveFromHistory={handleRemoveFromHistory}
              onCreatePlaylist={(title) => handleCreatePlaylist(title)}
              onDeletePlaylist={handleDeletePlaylist}
              onToggleVideoInPlaylist={handleToggleVideoInPlaylist}
              onOpenReel={(reelId) => {
                setInitialReelId(reelId);
                setCurrentPage('reels');
              }}
              onToggleSaveReel={handleToggleSaveReel}
              onPlayQueue={handlePlayQueue}
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

      {/* Persistent Floating Miniplayer Dock */}
      {miniplayerState && currentPage !== 'watch' && (() => {
        const miniVid = videos.find((v) => v.id === miniplayerState.videoId);
        if (!miniVid) return null;
        const nextCandidates = videos.filter((v) => v.id !== miniVid.id && (v.visibility || 'public') !== 'private');
        const nextMiniVid = nextCandidates[0];
        return (
          <MiniplayerDock
            video={miniVid}
            channelName={channels[miniVid.channelId]?.name || miniVid.author || 'Creator'}
            initialTime={miniplayerState.startTime}
            hasNext={Boolean(nextMiniVid)}
            onNext={
              nextMiniVid
                ? () => setMiniplayerState({ videoId: nextMiniVid.id, startTime: 0 })
                : undefined
            }
            onExpand={(currTime) => {
              handlePlayVideo(miniVid, Math.floor(currTime));
            }}
            onClose={() => setMiniplayerState(null)}
          />
        );
      })()}

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
