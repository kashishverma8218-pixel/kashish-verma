/**
 * Vio Streaming Platform - Centralized Firebase Database & Storage Service
 * Fully implements all 14 collections:
 * 1. users
 * 2. videos
 * 3. reels
 * 4. comments
 * 5. likes
 * 6. subscriptions
 * 7. followers
 * 8. notifications
 * 9. watchHistory
 * 10. playlists
 * 11. analytics
 * 12. reports
 * 13. categories
 * 14. searchHistory
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  Unsubscribe,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { VideoItem, Channel, Comment, ReelItem, ReelComment, NotificationItem, PlaylistItem } from '../types/video';
import { INITIAL_VIDEOS, CHANNELS, INITIAL_REELS, CATEGORIES } from '../data/mockData';
import { sanitizePlayableVideoUrl } from './streamingService';

// ----------------------------------------------------
// Error Handling conforming to Firebase Skill Guidelines
// ----------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------------------------------------------
// Collection Identifiers
// ----------------------------------------------------
export const COLLECTIONS = {
  USERS: 'users',
  VIDEOS: 'videos',
  REELS: 'reels',
  COMMENTS: 'comments',
  LIKES: 'likes',
  SUBSCRIPTIONS: 'subscriptions',
  FOLLOWERS: 'followers',
  NOTIFICATIONS: 'notifications',
  WATCH_HISTORY: 'watchHistory',
  PLAYLISTS: 'playlists',
  ANALYTICS: 'analytics',
  REPORTS: 'reports',
  CATEGORIES: 'categories',
  SEARCH_HISTORY: 'searchHistory',
} as const;

// ----------------------------------------------------
// 1. USERS COLLECTION
// ----------------------------------------------------
export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  photoURL: string;
  bannerURL: string;
  bio: string;
  subscribersCount: number;
  role?: string;
  createdAt: number;
}

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const path = `${COLLECTIONS.USERS}/${uid}`;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (snap.exists()) {
      return snap.data() as UserProfileDoc;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(profile: UserProfileDoc): Promise<void> {
  const path = `${COLLECTIONS.USERS}/${profile.uid}`;
  try {
    await setDoc(doc(db, COLLECTIONS.USERS, profile.uid), profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------
// 2. VIDEOS COLLECTION
// ----------------------------------------------------
// Safe timestamp normalizer (supports Firestore Timestamp objects, milliseconds, and ISO strings)
export const getCreatedAtMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Check admin using Firebase Custom Claims (request.auth.token.admin == true)
let isCustomClaimAdminCached = false;
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const token = await user.getIdTokenResult();
      isCustomClaimAdminCached = token.claims.admin === true;
    } catch {
      isCustomClaimAdminCached = false;
    }
  } else {
    isCustomClaimAdminCached = false;
  }
});

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult();
    isCustomClaimAdminCached = token.claims.admin === true;
    return isCustomClaimAdminCached;
  } catch {
    return false;
  }
}

export function subscribeVideos(
  callback: (videos: VideoItem[], lastDoc?: DocumentSnapshot | null) => void,
  categoryFilter?: string,
  limitCount: number = 50
): Unsubscribe {
  const colRef = collection(db, COLLECTIONS.VIDEOS);
  
  // 1. Firebase Query में orderBy('createdAt', 'desc') लागू किया गया
  let q;
  if (categoryFilter && categoryFilter !== 'All') {
    q = query(
      colRef,
      where('category', '==', categoryFilter),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  } else {
    q = query(
      colRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const vids: VideoItem[] = [];
      const seenIds = new Set<string>();

      const currentUid = auth.currentUser?.uid;
      const isAdminUser = isCustomClaimAdminCached;

      snapshot.forEach((d) => {
        if (seenIds.has(d.id)) return;
        const data = d.data();

        // 2. बिना URL वाले अधूरे/ड्राफ्ट वीडियो छोड़ें
        const rawUrl = typeof data.url === 'string' ? data.url.trim() : '';
        if (!rawUrl) return;
        const videoUrl = sanitizePlayableVideoUrl(rawUrl, d.id, 'video', true);

        // 3. Private वीडियो केवल उसके मालिक और अधिकृत Custom Claim Admin को दिखें
        const isPrivate = data.visibility === 'private';
        const isOwner = Boolean(currentUid && (data.ownerId === currentUid || data.userId === currentUid));
        if (isPrivate && !isOwner && !isAdminUser) {
          return;
        }

        seenIds.add(d.id);

        vids.push({
          id: d.id,
          ownerId: data.ownerId,
          userId: data.userId,
          title: data.title || 'Untitled',
          description: data.description || '',
          url: videoUrl,
          poster: data.poster || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
          channelId: data.channelId || 'channel-blender',
          views: data.views || 0,
          likes: data.likes || 0,
          dislikes: data.dislikes || 0,
          publishedAt: data.publishedAt || 'Recently',
          duration: data.duration || 120,
          category: data.category || 'Animation',
          tags: Array.isArray(data.tags) ? data.tags : [],
          isTrending: data.isTrending ?? false,
          visibility: data.visibility || 'public',
          hideLikes: data.hideLikes ?? false,
          commentsControl: data.commentsControl || 'allow_all',
          ageRestricted: data.ageRestricted ?? false,
          createdAt: getCreatedAtMillis(data.createdAt),
          streamQualities: data.streamQualities,
          hlsManifestUrl: data.hlsManifestUrl,
          backupStreams: data.backupStreams,
          transcodingStatus: data.transcodingStatus || 'ready',
          sourceObjectPath: data.sourceObjectPath,
          hlsOutputPrefix: data.hlsOutputPrefix,
          transcoderJobName: data.transcoderJobName,
          transcodingError: data.transcodingError,
          sourceWidth: data.sourceWidth,
          sourceHeight: data.sourceHeight,
        });
      });

      // Timestamp अनुसार नए वीडियो सबसे ऊपर
      vids.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      callback(vids, lastDoc);
    },
    (error) => {
      console.warn(`Firestore listener warning (${COLLECTIONS.VIDEOS}):`, error?.message || error);
    }
  );
}

// 2 & 3. startAfter() और DocumentSnapshot Cursor आधारित पेजिनेशन (Category Filter के साथ)
export interface PaginatedVideosResult {
  videos: VideoItem[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function fetchMoreVideos(
  lastVisibleDoc: DocumentSnapshot | null = null,
  pageSize: number = 24,
  categoryFilter?: string
): Promise<PaginatedVideosResult> {
  const colRef = collection(db, COLLECTIONS.VIDEOS);
  let q;

  if (categoryFilter && categoryFilter !== 'All') {
    if (lastVisibleDoc) {
      q = query(
        colRef,
        where('category', '==', categoryFilter),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisibleDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        colRef,
        where('category', '==', categoryFilter),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
    }
  } else {
    if (lastVisibleDoc) {
      q = query(
        colRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastVisibleDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        colRef,
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
    }
  }

  const snap = await getDocs(q);
  const vids: VideoItem[] = [];
  const currentUid = auth.currentUser?.uid;
  const isAdminUser = isCustomClaimAdminCached;

  snap.forEach((d) => {
    const data = d.data();
    const rawUrl = typeof data.url === 'string' ? data.url.trim() : '';
    if (!rawUrl) return;
    const videoUrl = sanitizePlayableVideoUrl(rawUrl, d.id, 'video', true);

    const isPrivate = data.visibility === 'private';
    const isOwner = Boolean(currentUid && (data.ownerId === currentUid || data.userId === currentUid));
    if (isPrivate && !isOwner && !isAdminUser) return;

    vids.push({
      id: d.id,
      ownerId: data.ownerId,
      userId: data.userId,
      title: data.title || 'Untitled',
      description: data.description || '',
      url: videoUrl,
      poster: data.poster || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      channelId: data.channelId || 'channel-blender',
      views: data.views || 0,
      likes: data.likes || 0,
      dislikes: data.dislikes || 0,
      publishedAt: data.publishedAt || 'Recently',
      duration: data.duration || 120,
      category: data.category || 'Animation',
      tags: Array.isArray(data.tags) ? data.tags : [],
      isTrending: data.isTrending ?? false,
      visibility: data.visibility || 'public',
      hideLikes: data.hideLikes ?? false,
      commentsControl: data.commentsControl || 'allow_all',
      ageRestricted: data.ageRestricted ?? false,
      createdAt: getCreatedAtMillis(data.createdAt),
      streamQualities: data.streamQualities,
      hlsManifestUrl: data.hlsManifestUrl,
      backupStreams: data.backupStreams,
      transcodingStatus: data.transcodingStatus || 'ready',
      sourceObjectPath: data.sourceObjectPath,
      hlsOutputPrefix: data.hlsOutputPrefix,
      transcoderJobName: data.transcoderJobName,
      transcodingError: data.transcodingError,
      sourceWidth: data.sourceWidth,
      sourceHeight: data.sourceHeight,
    });
  });

  vids.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  const hasMore = snap.docs.length === pageSize;

  return {
    videos: vids,
    lastDoc: newLastDoc,
    hasMore,
  };
}

export async function addVideoDoc(video: VideoItem): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error('Please sign in to publish videos.');
  }
  const videoId = video.id || `video-${Date.now()}`;
  const path = `${COLLECTIONS.VIDEOS}/${videoId}`;
  const ownerId = currentUser.uid;

  const docData = {
    id: videoId,
    ownerId,
    userId: ownerId,
    title: video.title,
    description: video.description || '',
    url: video.url,
    poster: video.poster,
    channelId: video.channelId || 'channel-blender',
    views: video.views || 0,
    likes: video.likes || 0,
    dislikes: video.dislikes || 0,
    publishedAt: video.publishedAt || 'Just now',
    duration: video.duration || 120,
    category: video.category || 'Animation',
    tags: video.tags || [],
    isTrending: video.isTrending ?? false,
    visibility: video.visibility || 'public',
    hideLikes: video.hideLikes ?? false,
    commentsControl: video.commentsControl || 'allow_all',
    ageRestricted: video.ageRestricted ?? false,
    status: 'published',
    createdAt: Date.now(),
    streamQualities: video.streamQualities || [],
    hlsManifestUrl: video.hlsManifestUrl || '',
    backupStreams: video.backupStreams || [],
    transcodingStatus: video.transcodingStatus || 'ready',
    ...(video.sourceObjectPath ? { sourceObjectPath: video.sourceObjectPath } : {}),
    ...(video.hlsOutputPrefix ? { hlsOutputPrefix: video.hlsOutputPrefix } : {}),
    ...(video.transcoderJobName ? { transcoderJobName: video.transcoderJobName } : {}),
    ...(video.sourceWidth ? { sourceWidth: video.sourceWidth } : {}),
    ...(video.sourceHeight ? { sourceHeight: video.sourceHeight } : {}),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.VIDEOS, videoId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

const viewedVideosInSession = new Set<string>();

export async function incrementVideoViews(videoId: string): Promise<void> {
  if (viewedVideosInSession.has(videoId)) {
    return; // Already counted view during this user session
  }
  viewedVideosInSession.add(videoId);

  const path = `${COLLECTIONS.VIDEOS}/${videoId}`;
  try {
    await updateDoc(doc(db, COLLECTIONS.VIDEOS, videoId), {
      views: increment(1),
    });
  } catch (error) {
    // Non-fatal if view increment fails
    console.warn(`Could not increment views for ${videoId}:`, error);
  }
}

/**
 * 6. Safe backfill for legacy videos that do not have a visibility field.
 * Safely updates docs with visibility='public' without deleting or overwriting any existing data.
 */
export async function backfillLegacyVideosVisibility(): Promise<{ updated: number; total: number }> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.VIDEOS));
    let updated = 0;
    for (const d of snap.docs) {
      const data = d.data();
      if (!data.visibility) {
        await updateDoc(d.ref, { visibility: 'public' });
        updated++;
      }
    }
    return { updated, total: snap.size };
  } catch (err) {
    console.warn('Legacy video visibility backfill check:', err);
    return { updated: 0, total: 0 };
  }
}

export async function updateVideoDoc(
  videoId: string,
  updates: Partial<VideoItem>
): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    const cleanUpdates: Record<string, any> = {};
    if (updates.title !== undefined) cleanUpdates.title = updates.title;
    if (updates.description !== undefined) cleanUpdates.description = updates.description;
    if (updates.category !== undefined) cleanUpdates.category = updates.category;
    if (updates.visibility !== undefined) cleanUpdates.visibility = updates.visibility;
    if (updates.poster !== undefined) cleanUpdates.poster = updates.poster;
    if (updates.tags !== undefined) cleanUpdates.tags = updates.tags;

    await updateDoc(doc(db, COLLECTIONS.VIDEOS, videoId), cleanUpdates);
  } catch (error) {
    console.warn(`Could not sync video update for ${videoId} to Firestore:`, error);
  }
}

export async function deleteVideoDoc(videoId: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  const path = `${COLLECTIONS.VIDEOS}/${videoId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.VIDEOS, videoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------
// 3. REELS COLLECTION
// ----------------------------------------------------
export function subscribeReels(callback: (reels: ReelItem[]) => void): Unsubscribe {
  const colRef = collection(db, COLLECTIONS.REELS);
  const q = query(colRef, limit(40));

  return onSnapshot(
    q,
    (snapshot) => {
      const reelList: (ReelItem & { _createdAtMs: number })[] = [];
      const currentUid = auth.currentUser?.uid;
      const isAdminUser = isCustomClaimAdminCached;

      snapshot.forEach((d) => {
        const data = d.data();
        const rawUrl = typeof data.videoUrl === 'string' ? data.videoUrl.trim() : '';
        if (!rawUrl) return;

        const isPrivate = data.visibility === 'private';
        const isOwner = Boolean(currentUid && (data.ownerId === currentUid || data.userId === currentUid));
        if (isPrivate && !isOwner && !isAdminUser) {
          return;
        }

        const createdMs = getCreatedAtMillis(data.createdAt);

        reelList.push({
          id: d.id,
          title: data.title || '',
          description: data.description || '',
          videoUrl: sanitizePlayableVideoUrl(rawUrl, d.id, 'reel', true),
          poster: data.poster || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
          channelId: data.channelId || 'channel-blender',
          views: data.views || 0,
          likes: data.likes || 0,
          commentsCount: data.commentsCount || 0,
          audioTrack: data.audioTrack || 'Original Audio',
          audioArtist: data.audioArtist || 'Vio Sounds',
          tags: Array.isArray(data.tags) ? data.tags : [],
          visibility: data.visibility || 'public',
          createdAt: createdMs ? new Date(createdMs).toISOString() : undefined,
          sourceObjectPath: data.sourceObjectPath,
          hlsOutputPrefix: data.hlsOutputPrefix,
          hlsManifestUrl: data.hlsManifestUrl,
          transcodingStatus: data.transcodingStatus || 'ready',
          streamQualities: data.streamQualities,
          _createdAtMs: createdMs,
        });
      });

      reelList.sort((a, b) => b._createdAtMs - a._createdAtMs);
      callback(reelList.map(({ _createdAtMs, ...rest }) => rest));
    },
    (error) => {
      console.warn(`Firestore listener warning (${COLLECTIONS.REELS}):`, error?.message || error);
    }
  );
}

const viewedReelsInSession = new Set<string>();

export async function incrementReelViews(reelId: string): Promise<void> {
  if (viewedReelsInSession.has(reelId)) return;
  viewedReelsInSession.add(reelId);

  if (!auth.currentUser?.uid) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.REELS, reelId), {
      views: increment(1),
    });
  } catch (error) {
    console.warn(`Could not increment reel views for ${reelId}:`, error);
  }
}

export async function updateReelDoc(
  reelId: string,
  updates: Partial<ReelItem>
): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    const cleanUpdates: Record<string, any> = {};
    if (updates.title !== undefined) cleanUpdates.title = updates.title;
    if (updates.description !== undefined) cleanUpdates.description = updates.description;
    if (updates.visibility !== undefined) cleanUpdates.visibility = updates.visibility;
    if (updates.audioTrack !== undefined) cleanUpdates.audioTrack = updates.audioTrack;
    if (updates.tags !== undefined) cleanUpdates.tags = updates.tags;

    await updateDoc(doc(db, COLLECTIONS.REELS, reelId), cleanUpdates);
  } catch (error) {
    console.warn(`Could not sync reel update for ${reelId} to Firestore:`, error);
  }
}

export async function deleteReelDoc(reelId: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  const path = `${COLLECTIONS.REELS}/${reelId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.REELS, reelId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addReelDoc(reel: ReelItem): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error('Please sign in with Google to publish reels to cloud.');
  }
  const reelId = reel.id || `reel-${Date.now()}`;
  const path = `${COLLECTIONS.REELS}/${reelId}`;
  const ownerId = currentUser.uid;

  const docData = {
    id: reelId,
    ownerId,
    userId: ownerId,
    title: reel.title,
    description: reel.description || '',
    videoUrl: reel.videoUrl,
    poster: reel.poster,
    channelId: reel.channelId || 'channel-blender',
    views: reel.views || 0,
    likes: reel.likes || 0,
    commentsCount: reel.commentsCount || 0,
    audioTrack: reel.audioTrack || 'Original Sound',
    audioArtist: reel.audioArtist || 'Vio Creator',
    tags: reel.tags || [],
    visibility: reel.visibility || 'public',
    status: 'published',
    createdAt: Date.now(),
    ...(reel.sourceObjectPath ? { sourceObjectPath: reel.sourceObjectPath } : {}),
    ...(reel.hlsOutputPrefix ? { hlsOutputPrefix: reel.hlsOutputPrefix } : {}),
    ...(reel.hlsManifestUrl ? { hlsManifestUrl: reel.hlsManifestUrl } : {}),
    ...(reel.transcodingStatus ? { transcodingStatus: reel.transcodingStatus } : {}),
    ...(reel.streamQualities ? { streamQualities: reel.streamQualities } : {}),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.REELS, reelId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ----------------------------------------------------
// 4. COMMENTS COLLECTION
// ----------------------------------------------------
export function subscribeComments(
  targetId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe {
  const colRef = collection(db, COLLECTIONS.COMMENTS);
  const q = query(colRef, where('targetId', '==', targetId), limit(80));

  return onSnapshot(
    q,
    (snapshot) => {
      const comms: Comment[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        comms.push({
          id: d.id,
          videoId: data.targetId || targetId,
          userId: data.userId,
          authorName: data.authorName || 'User',
          authorHandle: data.authorHandle || '@user',
          authorAvatar: data.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          content: data.content || data.text || '',
          timestamp: data.timestamp || 'Just now',
          createdAt: getCreatedAtMillis(data.createdAt),
          likes: data.likes || 0,
          userLiked: false,
          isPinned: Boolean(data.isPinned),
          isEdited: Boolean(data.isEdited),
        });
      });
      comms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(comms);
    },
    (error) => {
      console.warn(`Firestore listener warning (${COLLECTIONS.COMMENTS}?targetId=${targetId}):`, error?.message || error);
    }
  );
}

export async function addCommentDoc(
  targetId: string,
  content: string,
  authorName: string,
  authorAvatar: string,
  customId?: string,
  authorHandle?: string
): Promise<void> {
  if (!auth.currentUser?.uid) return;
  const commentId = customId || `comment-${Date.now()}`;
  const path = `${COLLECTIONS.COMMENTS}/${commentId}`;
  const userId = auth.currentUser.uid;
  const normalizedHandle = authorHandle
    ? (authorHandle.startsWith('@') ? authorHandle : `@${authorHandle}`)
    : `@${authorName.toLowerCase().replace(/\s+/g, '')}`;

  const docData = {
    id: commentId,
    targetId,
    userId,
    authorName,
    authorHandle: normalizedHandle,
    authorAvatar,
    content,
    text: content,
    likes: 0,
    timestamp: 'Just now',
    createdAt: Date.now(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.COMMENTS, commentId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleCommentLikeDoc(commentId: string, nextLiked: boolean): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.COMMENTS, commentId), {
      likes: increment(nextLiked ? 1 : -1),
    });
  } catch (error) {
    console.warn(`Could not sync comment like for ${commentId}:`, error);
  }
}

export async function updateCommentContentDoc(commentId: string, content: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.COMMENTS, commentId), {
      content,
      text: content,
      isEdited: true,
    });
  } catch (error) {
    console.warn(`Could not update comment ${commentId}:`, error);
  }
}

export async function pinCommentDoc(commentId: string, isPinned: boolean): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.COMMENTS, commentId), {
      isPinned,
    });
  } catch (error) {
    console.warn(`Could not persist pin state for comment ${commentId}:`, error);
  }
}

export async function incrementCommentRepliesDoc(commentId: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.COMMENTS, commentId), {
      repliesCount: increment(1),
    });
  } catch (error) {
    console.warn(`Could not increment repliesCount for comment ${commentId}:`, error);
  }
}

export async function deleteCommentDoc(commentId: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
  } catch (error) {
    console.warn(`Could not delete comment ${commentId}:`, error);
  }
}

// ----------------------------------------------------
// 5. LIKES COLLECTION
// ----------------------------------------------------
export async function toggleLike(
  userId: string,
  targetId: string,
  targetType: 'video' | 'reel' | 'comment',
  type: 'like' | 'dislike' = 'like'
): Promise<boolean> {
  const authUid = auth.currentUser?.uid;
  if (!authUid || authUid !== userId) {
    return false;
  }

  const likeId = `${authUid}_${targetId}`;
  const path = `${COLLECTIONS.LIKES}/${likeId}`;

  try {
    const likeRef = doc(db, COLLECTIONS.LIKES, likeId);
    const existingSnap = await getDoc(likeRef);
    if (existingSnap.exists()) {
      const prevType = existingSnap.data()?.type === 'dislike' ? 'dislike' : 'like';
      if (prevType === type) {
        // Toggle off existing reaction
        await deleteDoc(likeRef);
        if (targetType === 'video') {
          await updateDoc(doc(db, COLLECTIONS.VIDEOS, targetId), {
            [type === 'like' ? 'likes' : 'dislikes']: increment(-1),
          }).catch(() => {});
        } else if (targetType === 'reel' && type === 'like') {
          await updateDoc(doc(db, COLLECTIONS.REELS, targetId), {
            likes: increment(-1),
          }).catch(() => {});
        }
        return false;
      }

      // Switch reaction between 'like' <-> 'dislike'
      await setDoc(likeRef, {
        id: likeId,
        userId: authUid,
        targetId,
        targetType,
        type,
        createdAt: Date.now(),
      });
      if (targetType === 'video') {
        await updateDoc(doc(db, COLLECTIONS.VIDEOS, targetId), {
          likes: increment(type === 'like' ? 1 : -1),
          dislikes: increment(type === 'dislike' ? 1 : -1),
        }).catch(() => {});
      }
      return true;
    } else {
      // Create new reaction
      await setDoc(likeRef, {
        id: likeId,
        userId: authUid,
        targetId,
        targetType,
        type,
        createdAt: Date.now(),
      });
      if (targetType === 'video') {
        await updateDoc(doc(db, COLLECTIONS.VIDEOS, targetId), {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1),
        }).catch(() => {});
      } else if (targetType === 'reel' && type === 'like') {
        await updateDoc(doc(db, COLLECTIONS.REELS, targetId), {
          likes: increment(1),
        }).catch(() => {});
      }
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserReactions(
  userId: string
): Promise<{ likes: Set<string>; dislikes: Set<string> }> {
  const path = `${COLLECTIONS.LIKES}?userId=${userId}`;
  try {
    const q = query(collection(db, COLLECTIONS.LIKES), where('userId', '==', userId));
    const snap = await getDocs(q);
    const likes = new Set<string>();
    const dislikes = new Set<string>();
    snap.forEach((d) => {
      const data = d.data();
      if (data.type === 'dislike') {
        dislikes.add(data.targetId);
      } else {
        likes.add(data.targetId);
      }
    });
    return { likes, dislikes };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchUserLikes(userId: string): Promise<Set<string>> {
  const { likes } = await fetchUserReactions(userId);
  return likes;
}

// ----------------------------------------------------
// 6. SUBSCRIPTIONS COLLECTION
// ----------------------------------------------------
export async function toggleSubscription(
  userId: string,
  channelId: string,
  channelName: string,
  channelAvatar: string
): Promise<boolean> {
  const subId = `${userId}_${channelId}`;
  const path = `${COLLECTIONS.SUBSCRIPTIONS}/${subId}`;

  try {
    const existingSnap = await getDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, subId));
    if (existingSnap.exists()) {
      await deleteDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, subId));
      return false;
    } else {
      await setDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, subId), {
        id: subId,
        userId,
        channelId,
        channelName,
        channelAvatar,
        createdAt: Date.now(),
      });
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserSubscriptions(userId: string): Promise<Set<string>> {
  const path = `${COLLECTIONS.SUBSCRIPTIONS}?userId=${userId}`;
  try {
    const q = query(collection(db, COLLECTIONS.SUBSCRIPTIONS), where('userId', '==', userId));
    const snap = await getDocs(q);
    const subscribedChannels = new Set<string>();
    snap.forEach((d) => {
      subscribedChannels.add(d.data().channelId);
    });
    return subscribedChannels;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ----------------------------------------------------
// 7. FOLLOWERS COLLECTION
// ----------------------------------------------------
export async function toggleFollow(followerId: string, creatorId: string): Promise<boolean> {
  const followId = `${followerId}_${creatorId}`;
  const path = `${COLLECTIONS.FOLLOWERS}/${followId}`;

  try {
    const existing = await getDoc(doc(db, COLLECTIONS.FOLLOWERS, followId));
    if (existing.exists()) {
      await deleteDoc(doc(db, COLLECTIONS.FOLLOWERS, followId));
      return false;
    } else {
      await setDoc(doc(db, COLLECTIONS.FOLLOWERS, followId), {
        id: followId,
        followerId,
        creatorId,
        createdAt: Date.now(),
      });
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------
// 8. NOTIFICATIONS COLLECTION
// ----------------------------------------------------
export function subscribeNotifications(
  userId: string,
  callback: (notifications: NotificationItem[]) => void
): Unsubscribe {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return () => {};
  }

  const colRef = collection(db, COLLECTIONS.NOTIFICATIONS);
  const q = query(colRef, where('userId', '==', userId), limit(30));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: NotificationItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          type: data.type || 'upload',
          title: data.title || 'Notification',
          message: data.message || '',
          timestamp: data.timestamp || 'Just now',
          createdAt: data.createdAt || Date.now(),
          read: data.read ?? false,
          avatar: data.avatar,
          thumbnailUrl: data.thumbnailUrl,
          videoId: data.videoId,
          channelId: data.channelId,
        });
      });
      callback(items);
    },
    (error) => {
      if (!auth.currentUser) {
        console.warn('Notifications subscription skipped: user not signed into Firebase Auth.');
        return;
      }
      console.warn(`Firestore listener warning (${COLLECTIONS.NOTIFICATIONS}):`, error?.message || error);
    }
  );
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
      read: true,
    });
  } catch (error) {
    console.warn(`Could not mark notification ${notificationId} as read:`, error);
  }
}

export async function deleteNotificationDoc(notificationId: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId));
  } catch (error) {
    console.warn(`Could not delete notification ${notificationId}:`, error);
  }
}

/**
 * 2. Authorized notification creation.
 * Automatically stamps senderId and fromUserId with auth.currentUser.uid to prevent impersonation.
 */
export async function createNotification(notification: {
  userId: string;
  type: NotificationItem['type'];
  title: string;
  message: string;
  avatar?: string;
  thumbnailUrl?: string;
  videoId?: string;
  channelId?: string;
}): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    console.warn('Cannot create notification: User is not authenticated.');
    return;
  }

  const notifId = `notif-${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `${COLLECTIONS.NOTIFICATIONS}/${notifId}`;

  const docData = {
    id: notifId,
    userId: notification.userId,
    senderId: currentUid,
    fromUserId: currentUid,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    avatar: notification.avatar || '',
    thumbnailUrl: notification.thumbnailUrl || '',
    videoId: notification.videoId || '',
    channelId: notification.channelId || '',
    read: false,
    timestamp: 'Just now',
    createdAt: Date.now(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ----------------------------------------------------
// 9. WATCH HISTORY COLLECTION
// ----------------------------------------------------
export async function recordWatchHistory(
  userId: string,
  video: VideoItem,
  progressSeconds: number = 0
): Promise<void> {
  const historyId = `${userId}_${video.id}`;
  const path = `${COLLECTIONS.WATCH_HISTORY}/${historyId}`;

  try {
    await setDoc(doc(db, COLLECTIONS.WATCH_HISTORY, historyId), {
      id: historyId,
      userId,
      videoId: video.id,
      videoTitle: video.title,
      videoPoster: video.poster,
      videoDuration: video.duration,
      progressSeconds,
      completed: progressSeconds >= (video.duration * 0.9),
      watchedAt: Date.now(),
    });
  } catch (error) {
    console.warn('Could not record watch history:', error);
  }
}

export async function fetchWatchHistory(userId: string): Promise<any[]> {
  const path = `${COLLECTIONS.WATCH_HISTORY}?userId=${userId}`;
  try {
    const q = query(
      collection(db, COLLECTIONS.WATCH_HISTORY),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    const results: any[] = [];
    snap.forEach((d) => results.push(d.data()));
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function removeWatchHistoryDoc(userId: string, videoId: string): Promise<void> {
  if (!auth.currentUser?.uid || auth.currentUser.uid !== userId) return;
  const historyId = `${userId}_${videoId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.WATCH_HISTORY, historyId));
  } catch (error) {
    console.warn(`Could not delete watch history entry ${historyId}:`, error);
  }
}

export async function clearWatchHistoryDocs(userId: string): Promise<void> {
  if (!auth.currentUser?.uid || auth.currentUser.uid !== userId) return;
  try {
    const q = query(
      collection(db, COLLECTIONS.WATCH_HISTORY),
      where('userId', '==', userId),
      limit(100)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (error) {
    console.warn('Could not clear watch history in Firestore:', error);
  }
}

// ----------------------------------------------------
// 10. PLAYLISTS COLLECTION
// ----------------------------------------------------
export async function createPlaylist(
  userId: string,
  title: string,
  description: string = '',
  isPublic: boolean = true,
  customId?: string,
  initialVideoIds: string[] = []
): Promise<string> {
  const playlistId = customId || `playlist-${Date.now()}`;
  const path = `${COLLECTIONS.PLAYLISTS}/${playlistId}`;

  try {
    await setDoc(doc(db, COLLECTIONS.PLAYLISTS, playlistId), {
      id: playlistId,
      userId,
      title,
      description,
      isPublic,
      isPrivate: !isPublic,
      videoIds: initialVideoIds,
      videoCount: initialVideoIds.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return playlistId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserPlaylists(
  userId: string,
  callback: (playlists: PlaylistItem[]) => void
): Unsubscribe {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return () => {};
  }

  const colRef = collection(db, COLLECTIONS.PLAYLISTS);
  const q = query(colRef, where('userId', '==', userId), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: PlaylistItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          userId: data.userId,
          title: data.title || 'Untitled Playlist',
          description: data.description || '',
          videoIds: Array.isArray(data.videoIds) ? data.videoIds : [],
          isPublic: data.isPublic ?? true,
          createdAt: getCreatedAtMillis(data.createdAt) || Date.now(),
          updatedAt: getCreatedAtMillis(data.updatedAt) || Date.now(),
        });
      });
      items.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      callback(items);
    },
    (error) => {
      console.warn(`Firestore listener warning (${COLLECTIONS.PLAYLISTS}):`, error?.message || error);
    }
  );
}

export async function updatePlaylistVideosDoc(
  playlistId: string,
  videoIds: string[]
): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.PLAYLISTS, playlistId), {
      videoIds,
      videoCount: videoIds.length,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.warn(`Could not update playlist ${playlistId}:`, error);
  }
}

export async function deletePlaylistDoc(playlistId: string): Promise<void> {
  if (!auth.currentUser?.uid) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.PLAYLISTS, playlistId));
  } catch (error) {
    console.warn(`Could not delete playlist ${playlistId}:`, error);
  }
}

// ----------------------------------------------------
// 11. ANALYTICS COLLECTION
// ----------------------------------------------------
export async function recordStreamAnalytics(
  videoId: string,
  metrics: {
    views?: number;
    watchTimeSeconds?: number;
    bufferEvents?: number;
    rebufferingDurationMs?: number;
  }
): Promise<void> {
  if (!auth.currentUser?.uid) return;
  const analyticsId = `metric-${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    await setDoc(doc(db, COLLECTIONS.ANALYTICS, analyticsId), {
      id: analyticsId,
      videoId,
      userId: auth.currentUser.uid,
      ...metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.warn('Could not record analytics:', error);
  }
}

// ----------------------------------------------------
// 12. REPORTS COLLECTION
// ----------------------------------------------------
export async function submitContentReport(
  targetId: string,
  targetType: 'video' | 'reel' | 'comment',
  reason: string,
  details: string = ''
): Promise<'cloud' | 'local'> {
  if (!auth.currentUser?.uid) {
    try {
      const existing = JSON.parse(localStorage.getItem('vio_local_reports') || '[]');
      existing.unshift({
        id: `report-${Date.now()}`,
        targetId,
        targetType,
        reason,
        details,
        createdAt: Date.now(),
      });
      localStorage.setItem('vio_local_reports', JSON.stringify(existing.slice(0, 50)));
    } catch {}
    return 'local';
  }

  const reportId = `report-${Date.now()}`;
  const path = `${COLLECTIONS.REPORTS}/${reportId}`;

  try {
    await setDoc(doc(db, COLLECTIONS.REPORTS, reportId), {
      id: reportId,
      userId: auth.currentUser.uid,
      targetId,
      targetType,
      reason,
      details,
      status: 'pending',
      createdAt: Date.now(),
    });
    return 'cloud';
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ----------------------------------------------------
// 13. CATEGORIES COLLECTION
// ----------------------------------------------------
export async function fetchCategories(): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.CATEGORIES));
    if (snap.empty) {
      return CATEGORIES;
    }
    const list: string[] = [];
    snap.forEach((d) => {
      const name = d.data().name;
      if (name) list.push(name);
    });
    return list.length > 0 ? list : CATEGORIES;
  } catch {
    return CATEGORIES;
  }
}

// ----------------------------------------------------
// 14. SEARCH HISTORY COLLECTION
// ----------------------------------------------------
export async function recordSearchQuery(userId: string, queryText: string): Promise<void> {
  if (!auth.currentUser?.uid || auth.currentUser.uid !== userId || !queryText.trim()) return;
  const searchId = `search-${Date.now()}`;

  try {
    await setDoc(doc(db, COLLECTIONS.SEARCH_HISTORY, searchId), {
      id: searchId,
      userId,
      query: queryText.trim(),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.warn('Could not save search history:', error);
  }
}

// ----------------------------------------------------
// FIREBASE STORAGE UPLOAD HANDLER
// ----------------------------------------------------
export async function uploadFileToStorage(
  file: File,
  folder: 'videos' | 'profileImages' | 'thumbnails' = 'videos',
  onProgress?: (progressPct: number, bytesTransferred: number, totalBytes: number) => void,
  metadata?: { visibility?: 'public' | 'unlisted' | 'private'; [key: string]: any }
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error('Please sign in to your Vio account before uploading files.');
  }

  // Enforce size limits matching Firebase Storage Security Rules
  if (folder === 'videos' && file.size > 500 * 1024 * 1024) {
    throw new Error(`Video file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed 500 MB limit.`);
  }
  if ((folder === 'thumbnails' || folder === 'profileImages') && file.size > 5 * 1024 * 1024) {
    throw new Error(`Image file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed 5 MB limit.`);
  }

  const userId = currentUser.uid;
  const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const storagePath = `${folder}/${userId}/${cleanFileName}`;
  const storageRef = ref(storage, storagePath);

  const uploadMetadata = {
    contentType: file.type || (folder === 'videos' ? 'video/mp4' : 'image/jpeg'),
    customMetadata: {
      userId,
      uploadedAt: new Date().toISOString(),
      visibility: metadata?.visibility || 'public',
      fileName: file.name,
      ...(metadata || {})
    }
  };

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, uploadMetadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = snapshot.totalBytes > 0
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
        if (onProgress) {
          onProgress(pct, snapshot.bytesTransferred, snapshot.totalBytes);
        }
      },
      (error) => {
        console.error('Firebase Storage upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (err) {
          console.error('Firebase Storage getDownloadURL error:', err);
          reject(err);
        }
      }
    );
  });
}

/**
 * Shared image asset processor & uploader for profile avatars, banners, and video thumbnails.
 * Uploads directly to Firebase Storage when Firebase Auth is active; otherwise compresses
 * cleanly on canvas into a persistent Data URL for local/offline sessions.
 */
export async function compressImageToDataUrl(
  file: File,
  maxWidth: number = 960,
  quality: number = 0.82
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (PNG, JPG, WebP, or GIF).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file could not be decoded as an image.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Image processing canvas is unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadImageAsset(
  file: File,
  folder: 'profileImages' | 'thumbnails' = 'thumbnails',
  onProgress?: (progressPct: number) => void
): Promise<{ url: string; storage: 'cloud' | 'local' }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (.jpg, .png, .webp).');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`Image file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB maximum limit.`);
  }

  if (auth.currentUser?.uid) {
    const downloadUrl = await uploadFileToStorage(
      file,
      folder,
      (pct) => onProgress?.(pct),
      { visibility: 'public' }
    );
    return { url: downloadUrl, storage: 'cloud' };
  }

  const maxWidth = folder === 'profileImages' ? 512 : 1280;
  const dataUrl = await compressImageToDataUrl(file, maxWidth, 0.8);
  onProgress?.(100);
  return { url: dataUrl, storage: 'local' };
}

// ----------------------------------------------------
// INITIAL DATABASE SEEDING
// Ensures database is populated with real production records on first boot
// ----------------------------------------------------
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const vidsSnap = await getDocs(query(collection(db, COLLECTIONS.VIDEOS), limit(1)));
    if (!vidsSnap.empty) {
      // Database already seeded
      return;
    }

    console.log('Seeding initial canonical videos and reels to Firestore...');

    // Seed Videos
    for (const v of INITIAL_VIDEOS) {
      await setDoc(doc(db, COLLECTIONS.VIDEOS, v.id), {
        id: v.id,
        ownerId: 'official-studio',
        userId: 'official-studio',
        title: v.title,
        description: v.description,
        url: v.url,
        poster: v.poster,
        channelId: v.channelId,
        views: v.views,
        likes: v.likes,
        dislikes: v.dislikes,
        publishedAt: v.publishedAt,
        duration: v.duration,
        category: v.category,
        tags: v.tags,
        isTrending: v.isTrending ?? false,
        visibility: 'public',
        status: 'published',
        createdAt: Date.now(),
      });
    }

    // Seed Reels
    for (const r of INITIAL_REELS) {
      await setDoc(doc(db, COLLECTIONS.REELS, r.id), {
        id: r.id,
        ownerId: 'official-studio',
        userId: 'official-studio',
        title: r.title,
        description: r.description,
        videoUrl: r.videoUrl,
        poster: r.poster,
        channelId: r.channelId,
        views: r.views,
        likes: r.likes,
        commentsCount: r.commentsCount,
        audioTrack: r.audioTrack,
        audioArtist: r.audioArtist,
        tags: r.tags,
        status: 'published',
        createdAt: Date.now(),
      });
    }

    // Seed Categories
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      if (cat !== 'All') {
        const catId = cat.toLowerCase().replace(/[^a-z0-9]/g, '-');
        await setDoc(doc(db, COLLECTIONS.CATEGORIES, catId), {
          id: catId,
          name: cat,
          slug: catId,
          sortOrder: i,
        });
      }
    }
  } catch (err) {
    console.warn('Initial Firestore seed check skipped or permitted:', err);
  }
}
