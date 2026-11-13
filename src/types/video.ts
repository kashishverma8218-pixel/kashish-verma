export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  verified: boolean;
  subscribersCount: number;
  isSubscribed: boolean;
  followersCount?: number;
  isFollowing?: boolean;
  notificationBell: 'all' | 'personalized' | 'none';
  bio: string;
  joinedDate: string;
  videoCount?: number;
}

export interface CommentReply {
  id: string;
  commentId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  content: string;
  timestamp: string;
  likes: number;
  userLiked: boolean;
}

export interface Comment {
  id: string;
  videoId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  content: string;
  timestamp: string;
  likes: number;
  userLiked: boolean;
  userDisliked?: boolean;
  replies?: CommentReply[];
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  url: string;
  poster: string;
  channelId: string;
  channel?: Channel;
  author?: string;
  views: number;
  likes: number;
  dislikes: number;
  userLiked?: boolean;
  userDisliked?: boolean;
  publishedAt: string;
  duration: number; // in seconds
  category: string;
  tags: string[];
  isTrending?: boolean;
  isLocal?: boolean;
  fileSize?: string;
  subtitlesUrl?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  hideLikes?: boolean;
  commentsControl?: 'allow_all' | 'hold_inappropriate' | 'hold_all' | 'disabled';
  notifySubscribers?: boolean;
  allowRemix?: boolean;
  ageRestricted?: boolean;
  createdAt?: number;
  streamQualities?: VideoStreamQuality[];
  hlsManifestUrl?: string;
  backupStreams?: string[];
  transcodingStatus?: 'ready' | 'processing' | 'failed';
  chapters?: VideoChapter[];
}

export interface VideoChapter {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  timestamp: string; // e.g. "01:23"
}

export interface VideoStreamQuality {
  label: string;
  resolution: string;
  bitrateKbps: number;
  fps: number;
  url: string;
  isMaster?: boolean;
}

export interface TranscodingJob {
  id: string;
  videoId: string;
  status: 'queued' | 'analyzing' | 'transcoding' | 'generating_manifest' | 'ready' | 'failed';
  progress: number;
  currentStep: string;
  targetLadder: string[];
  codec: string;
  createdAt: number;
  completedAt?: number;
}

export interface Bookmark {
  id: string;
  videoId: string;
  time: number;
  label: string;
  createdAt: number;
  thumbnailUrl?: string;
}

export interface VideoFilters {
  brightness: number; // 100 default
  contrast: number;   // 100 default
  saturate: number;   // 100 default
  grayscale: number;  // 0 default
  sepia: number;      // 0 default
  blur: number;       // 0 default
  invert: number;     // 0 default
}

export type AspectRatioMode = 'auto' | '16:9' | '4:3' | '21:9' | '9:16' | 'cover';

export type QualityOption = '1080p60 HD' | '720p HD' | '480p' | '360p' | 'Auto';

export interface HistoryItem {
  videoId: string;
  watchedAt: number;
  progressSeconds: number;
}

export interface NotificationItem {
  id: string;
  type: 'upload' | 'reply' | 'milestone' | 'subscription';
  title: string;
  message: string;
  timestamp: string;
  createdAt: number;
  read: boolean;
  avatar?: string;
  thumbnailUrl?: string;
  videoId?: string;
  channelId?: string;
  linkText?: string;
}

export interface ReelComment {
  id: string;
  reelId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  content: string;
  timestamp: string;
  likes: number;
  userLiked?: boolean;
}

export interface ReelItem {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  poster: string;
  channelId: string;
  views: number;
  likes: number;
  commentsCount: number;
  audioTrack: string;
  audioArtist: string;
  tags: string[];
  userLiked?: boolean;
  userSaved?: boolean;
  createdAt?: string;
}
