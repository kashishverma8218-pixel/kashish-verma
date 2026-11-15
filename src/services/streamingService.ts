/**
 * Vio Streaming Cloud & Adaptive Bitrate (ABR) Client Engine
 * Provides real authorized GCS resumable uploads, Cloud Transcoder job submission,
 * secure playback authorization, and adaptive bitrate calculation.
 */

import { auth } from '../firebase';
import { VideoStreamQuality } from '../types/video';

export const DEFAULT_PLAYABLE_VIDEO_URL =
  'https://media.w3.org/2010/05/bunny/movie.mp4';

export const DEFAULT_PLAYABLE_REEL_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

// Verified HTTP 200 mirrors for legacy sample items already stored in Firestore
export const CDN_STREAM_MIRRORS: Record<string, string[]> = {
  'video-bbb': [
    'https://media.w3.org/2010/05/bunny/movie.mp4',
    'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
  ],
  'video-sintel': [
    'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
    'https://media.w3.org/2010/05/sintel/trailer.mp4',
  ],
  'video-tears-of-steel': [
    'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4',
    'https://media.w3.org/2010/05/sintel/trailer.mp4',
  ],
  'video-elephants-dream': [
    'https://archive.org/download/ElephantsDream/ed_hd.mp4',
    'https://media.w3.org/2010/05/bunny/movie.mp4',
  ],
  'video-escapes': [
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  ],
  'video-blazes': [
    'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
  ],
  'video-joyrides': [
    'https://media.w3.org/2010/05/bunny/trailer.mp4',
  ],
  'video-we-are-going': [
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  ],
};

const LEGACY_SAMPLE_FILENAME_MAP: Record<string, string> = {
  'BigBuckBunny.mp4': 'https://media.w3.org/2010/05/bunny/movie.mp4',
  'Sintel.mp4': 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
  'TearsOfSteel.mp4': 'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4',
  'ElephantsDream.mp4': 'https://archive.org/download/ElephantsDream/ed_hd.mp4',
  'ForBiggerEscapes.mp4': 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'ForBiggerBlazes.mp4': 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
  'ForBiggerJoyBlazes.mp4': 'https://media.w3.org/2010/05/bunny/trailer.mp4',
  'ForBiggerJoyrides.mp4': 'https://media.w3.org/2010/05/bunny/trailer.mp4',
  'WeAreGoingOnBullrun.mp4': 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
};

/**
 * Normalizes legacy broken/403 sample URLs loaded from Firestore
 * so <video> always receives a valid source.
 */
export function sanitizePlayableVideoUrl(
  url?: string | null,
  itemId?: string,
  kind: 'video' | 'reel' = 'video',
  rejectBlob: boolean = false
): string {
  const defaultFallback = kind === 'reel' ? DEFAULT_PLAYABLE_REEL_URL : DEFAULT_PLAYABLE_VIDEO_URL;
  const trimmed = typeof url === 'string' ? url.trim() : '';

  if (!trimmed) {
    return (itemId && CDN_STREAM_MIRRORS[itemId]?.[0]) || defaultFallback;
  }

  if (trimmed.startsWith('blob:')) {
    return rejectBlob ? ((itemId && CDN_STREAM_MIRRORS[itemId]?.[0]) || defaultFallback) : trimmed;
  }

  if (trimmed.includes('gtv-videos-bucket/sample/')) {
    const fileName = trimmed.split('/').pop()?.split('?')[0] || '';
    if (fileName && LEGACY_SAMPLE_FILENAME_MAP[fileName]) {
      return LEGACY_SAMPLE_FILENAME_MAP[fileName];
    }
    return (itemId && CDN_STREAM_MIRRORS[itemId]?.[0]) || defaultFallback;
  }

  return trimmed;
}

/**
 * Builds fallback stream quality metadata when explicit HLS levels aren't parsed yet
 */
export function buildStreamLadder(_videoId: string, masterUrl: string): VideoStreamQuality[] {
  return [
    {
      label: '1080p HD',
      resolution: '1920x1080',
      bitrateKbps: 5500,
      fps: 30,
      url: masterUrl,
      isMaster: true,
    },
    {
      label: '720p HD',
      resolution: '1280x720',
      bitrateKbps: 2800,
      fps: 30,
      url: masterUrl,
    },
    {
      label: '480p',
      resolution: '854x480',
      bitrateKbps: 1400,
      fps: 30,
      url: masterUrl,
    },
    {
      label: '360p',
      resolution: '640x360',
      bitrateKbps: 800,
      fps: 30,
      url: masterUrl,
    },
  ];
}

/**
 * Calculates optimal streaming quality tier based on buffer health
 */
export function calculateAdaptiveBitrate(
  bufferSeconds: number,
  _currentResolution: string,
  qualities: VideoStreamQuality[]
): VideoStreamQuality {
  if (bufferSeconds < 2.5) {
    return qualities.find((q) => q.bitrateKbps <= 1500) || qualities[qualities.length - 1];
  }
  if (bufferSeconds > 8) {
    return qualities[0];
  }
  return qualities.find((q) => q.bitrateKbps >= 2500 && q.bitrateKbps <= 3500) || qualities[1] || qualities[0];
}

export interface UploadSessionResponse {
  success: boolean;
  videoId: string;
  uploadUrl: string;
  uploadSessionToken: string;
  objectPath: string;
  gcsUri: string;
  bucketName: string;
  maxChunkBytes: number;
  expiresAt: number;
}

async function getFirebaseAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to your Vio Firebase account before uploading or processing videos.');
  }
  return user.getIdToken();
}

/**
 * Requests an authorized Google Cloud Storage resumable upload session from the Cloud Run server.
 */
export async function requestResumableUploadSession(params: {
  videoId: string;
  folder: 'videos' | 'thumbnails' | 'profileImages';
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  visibility?: 'public' | 'unlisted' | 'private';
}): Promise<UploadSessionResponse> {
  const idToken = await getFirebaseAuthToken();
  const res = await fetch('/api/uploads/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Upload authorization failed (${res.status}).`);
  }
  return data as UploadSessionResponse;
}

function parseCommittedByteOffset(rangeHeader: string | null): number {
  if (!rangeHeader) return 0;
  const match = /bytes=0-(\d+)/i.exec(rangeHeader);
  if (!match) return 0;
  return parseInt(match[1], 10) + 1;
}

/**
 * Uploads a File in 8 MiB resumable chunks directly to GCS (with automatic
 * retry/resume offset probing and authenticated server chunk fallback if CORS blocks direct GCS PUT).
 */
export async function uploadFileResumableInChunks(params: {
  file: File;
  videoId: string;
  folder: 'videos' | 'thumbnails' | 'profileImages';
  visibility?: 'public' | 'unlisted' | 'private';
  onProgress?: (pct: number, bytesTransferred: number, totalBytes: number) => void;
}): Promise<{ objectPath: string; gcsUri: string; bucketName: string }> {
  const { file, videoId, folder, visibility = 'public', onProgress } = params;
  const contentType = file.type || (folder === 'videos' ? 'video/mp4' : 'image/jpeg');

  const session = await requestResumableUploadSession({
    videoId,
    folder,
    fileName: file.name,
    contentType,
    fileSizeBytes: file.size,
    visibility,
  });

  const totalSize = file.size;
  const chunkSize = Math.max(256 * 1024, session.maxChunkBytes || 8 * 1024 * 1024);
  let offset = 0;
  let useServerChunkProxy = false;

  onProgress?.(0, 0, totalSize);

  while (offset < totalSize) {
    const end = Math.min(offset + chunkSize, totalSize);
    const chunk = file.slice(offset, end);
    const contentRange = `bytes ${offset}-${end - 1}/${totalSize}`;
    let chunkSuccess = false;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < 3 && !chunkSuccess; attempt++) {
      try {
        if (!useServerChunkProxy) {
          try {
            const directRes = await fetch(session.uploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': contentType,
                'Content-Range': contentRange,
              },
              body: chunk,
            });

            if (directRes.status === 308) {
              const committed = parseCommittedByteOffset(directRes.headers.get('Range'));
              offset = committed > offset ? committed : end;
              chunkSuccess = true;
              break;
            }
            if (directRes.ok) {
              offset = totalSize;
              chunkSuccess = true;
              break;
            }
            const errText = await directRes.text().catch(() => '');
            throw new Error(errText || `Direct GCS upload returned HTTP ${directRes.status}`);
          } catch (directErr: any) {
            // TypeError typically indicates browser CORS restriction on GCS bucket before CORS is configured
            if (directErr instanceof TypeError) {
              useServerChunkProxy = true;
            } else {
              throw directErr;
            }
          }
        }

        if (useServerChunkProxy) {
          const idToken = await getFirebaseAuthToken();
          const proxyRes = await fetch('/api/uploads/chunk', {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'X-Upload-Session-Token': session.uploadSessionToken,
              'Content-Type': contentType,
              'Content-Range': contentRange,
            },
            body: chunk,
          });

          if (proxyRes.status === 308) {
            const body = await proxyRes.json().catch(() => ({}));
            const committed = parseCommittedByteOffset(body.range || proxyRes.headers.get('Range'));
            offset = committed > offset ? committed : end;
            chunkSuccess = true;
            break;
          }
          if (proxyRes.ok) {
            offset = totalSize;
            chunkSuccess = true;
            break;
          }
          const errJson = await proxyRes.json().catch(() => ({}));
          throw new Error(errJson.error || `Resumable chunk upload failed (${proxyRes.status})`);
        }
      } catch (err: any) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (!chunkSuccess) {
      throw lastErr || new Error('Resumable upload interrupted after 3 retries.');
    }

    const pct = totalSize > 0 ? Math.min(100, Math.round((offset / totalSize) * 100)) : 100;
    onProgress?.(pct, offset, totalSize);
  }

  return {
    objectPath: session.objectPath,
    gcsUri: session.gcsUri,
    bucketName: session.bucketName,
  };
}

/**
 * Triggers a real Google Cloud Transcoder API HLS job (360p/480p/720p/1080p) on Cloud Run.
 */
export async function startVideoProcessing(params: {
  videoId: string;
  sourceObjectPath: string;
  collectionName?: 'videos' | 'reels';
  sourceWidth?: number;
  sourceHeight?: number;
}): Promise<{
  success: boolean;
  jobName: string;
  state: string;
  hlsOutputPrefix: string;
}> {
  const idToken = await getFirebaseAuthToken();
  const res = await fetch(`/api/videos/${encodeURIComponent(params.videoId)}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      sourceObjectPath: params.sourceObjectPath,
      collectionName: params.collectionName || 'videos',
      sourceWidth: params.sourceWidth,
      sourceHeight: params.sourceHeight,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to start Cloud Transcoder job (${res.status}).`);
  }
  return data;
}

export async function getVideoProcessingStatus(videoId: string): Promise<{
  videoId: string;
  state: string;
  transcodingStatus: 'processing' | 'ready' | 'failed';
  hlsManifestUrl?: string;
  errorMessage?: string;
}> {
  const headers: Record<string, string> = {};
  if (auth.currentUser) {
    try {
      headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    } catch {
      // optional
    }
  }
  const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/status`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to check transcode status (${res.status}).`);
  }
  return data;
}

export async function fetchPlaybackSession(videoId: string): Promise<{
  videoId: string;
  visibility: 'public' | 'unlisted' | 'private';
  transcodingStatus: 'processing' | 'ready' | 'failed';
  hlsUrl: string | null;
  fallbackUrl: string | null;
}> {
  const headers: Record<string, string> = {};
  if (auth.currentUser) {
    try {
      headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    } catch {
      // optional
    }
  }
  const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/playback`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Playback authorization failed (${res.status}).`);
  }
  return data;
}

/**
 * Checks streaming server and GCP readiness
 */
export async function checkStreamingServerHealth(): Promise<{
  online: boolean;
  edgeRegion: string;
  latencyMs: number;
  gcpReady?: boolean;
}> {
  const start = performance.now();
  try {
    const res = await fetch('/api/health');
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        edgeRegion: data.edgePoP || 'Google Cloud Run',
        latencyMs,
        gcpReady: data.status === 'online',
      };
    }
  } catch {
    // ignore
  }
  return {
    online: false,
    edgeRegion: 'Server Unreachable',
    latencyMs: 0,
    gcpReady: false,
  };
}
