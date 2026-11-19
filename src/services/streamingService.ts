/**
 * Vio Streaming Cloud & Adaptive Bitrate (ABR) Client Engine
 * Provides real authorized GCS resumable uploads, Cloud Transcoder job submission,
 * secure playback authorization, and adaptive bitrate calculation.
 */

import { auth, getOptionalAppCheckToken } from '../firebase';
import { NotificationItem, VideoStreamQuality } from '../types/video';

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

export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const;
export const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
] as const;
export const MAX_SHORTS_DURATION_SECONDS = 180;
export const MAX_VIDEO_FILE_BYTES = 500 * 1024 * 1024;

export interface VideoFileValidationResult {
  valid: boolean;
  error?: string;
  formatLabel?: 'MP4' | 'MOV' | 'WebM';
}

export function validateUploadVideoFile(file: File): VideoFileValidationResult {
  const lowerName = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  let formatLabel: 'MP4' | 'MOV' | 'WebM' | undefined;
  if (lowerName.endsWith('.mp4') || lowerName.endsWith('.m4v') || mime === 'video/mp4' || mime === 'video/x-m4v') {
    formatLabel = 'MP4';
  } else if (lowerName.endsWith('.mov') || mime === 'video/quicktime') {
    formatLabel = 'MOV';
  } else if (lowerName.endsWith('.webm') || mime === 'video/webm') {
    formatLabel = 'WebM';
  }

  if (!formatLabel) {
    return {
      valid: false,
      error: 'Unsupported video format. Please upload an MP4, MOV, or WebM file.',
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Selected video file is empty.',
    };
  }

  if (file.size > MAX_VIDEO_FILE_BYTES) {
    return {
      valid: false,
      error: `Video file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 500 MB upload limit.`,
    };
  }

  return { valid: true, formatLabel };
}

/**
 * Builds truthful stream quality metadata:
 * - Multi-tier ladder only when masterUrl is an HLS .m3u8 playlist
 * - Single source entry when pointing to an untranscoded raw file
 */
export function buildStreamLadder(
  _videoId: string,
  masterUrl: string,
  sourceDims?: { width?: number; height?: number }
): VideoStreamQuality[] {
  const isHlsPlaylist = /\.m3u8(\?|$)/i.test(masterUrl);
  if (!isHlsPlaylist) {
    const w = sourceDims?.width && sourceDims.width > 0 ? sourceDims.width : 1280;
    const h = sourceDims?.height && sourceDims.height > 0 ? sourceDims.height : 720;
    const shortEdge = Math.min(w, h);
    const label = shortEdge >= 1080 ? '1080p Source' : shortEdge >= 720 ? '720p Source' : `${shortEdge}p Source`;
    return [
      {
        label,
        resolution: `${w}x${h}`,
        bitrateKbps: shortEdge >= 1080 ? 5000 : 2500,
        fps: 30,
        url: masterUrl,
        isMaster: true,
      },
    ];
  }

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

export type UploadStatusPhase =
  | 'idle'
  | 'staged'
  | 'validating'
  | 'uploading'
  | 'paused'
  | 'verifying'
  | 'processing'
  | 'completed'
  | 'failed';

export interface UploadPermissionCheck {
  authorized: boolean;
  uid?: string;
  email?: string | null;
  storageReady: boolean;
  transcoderReady: boolean;
  bucketName?: string;
  storageError?: string;
  transcoderError?: string;
  message?: string;
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

export class StreamingServiceError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = 'StreamingServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

async function getFirebaseAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new StreamingServiceError(
      'Firebase authentication required. Please sign in with Google or Email/Password (local demo accounts cannot upload to Cloud Storage).',
      'AUTH_REQUIRED',
      401
    );
  }
  return user.getIdToken();
}

async function buildProtectedHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...base };
  const appCheckToken = await getOptionalAppCheckToken();
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }
  return headers;
}

/**
 * Validates Firebase Auth permissions and queries backend GCP readiness
 * (bucket access & Transcoder API availability) before upload starts.
 */
export async function checkUploadPermissions(): Promise<UploadPermissionCheck> {
  const user = auth.currentUser;
  if (!user?.uid) {
    return {
      authorized: false,
      storageReady: false,
      transcoderReady: false,
      message:
        'Please sign in with a real Firebase account (Google or Email/Password). Local demo sessions do not have Cloud Storage upload permissions.',
    };
  }

  try {
    await user.getIdToken();
  } catch (err: any) {
    return {
      authorized: false,
      uid: user.uid,
      email: user.email,
      storageReady: false,
      transcoderReady: false,
      message: err?.message || 'Could not verify your Firebase ID token. Please sign in again.',
    };
  }

  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return {
        authorized: true,
        uid: user.uid,
        email: user.email,
        storageReady: false,
        transcoderReady: false,
        message: `Media server health check returned HTTP ${res.status}.`,
      };
    }
    const data = await res.json();
    const cs = data?.gcpServices?.cloudStorage || {};
    const ct = data?.gcpServices?.cloudTranscoder || {};
    const storageReady = Boolean(cs.accessible);
    const transcoderReady = Boolean(ct.accessible);

    let message: string | undefined;
    if (!storageReady) {
      message = cs.error || `Cloud Storage bucket "${cs.bucketName || 'unconfigured'}" is not accessible.`;
    }

    return {
      authorized: true,
      uid: user.uid,
      email: user.email,
      storageReady,
      transcoderReady,
      bucketName: cs.bucketName,
      storageError: cs.error,
      transcoderError: ct.error,
      message,
    };
  } catch (err: any) {
    return {
      authorized: true,
      uid: user.uid,
      email: user.email,
      storageReady: false,
      transcoderReady: false,
      message: err?.message || 'Media server unreachable.',
    };
  }
}

/**
 * Requests an authorized Google Cloud Storage resumable upload session from the server.
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
  const headers = await buildProtectedHeaders({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  });
  const res = await fetch('/api/uploads/session', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StreamingServiceError(
      data.error || `Upload authorization failed (${res.status}).`,
      data.code,
      res.status
    );
  }
  return data as UploadSessionResponse;
}

export async function verifyUploadedStorageObject(objectPath: string): Promise<{
  exists: boolean;
  sizeBytes: number;
  contentType: string;
  ownerId?: string;
}> {
  const idToken = await getFirebaseAuthToken();
  const headers = await buildProtectedHeaders({
    Authorization: `Bearer ${idToken}`,
  });
  const res = await fetch(`/api/uploads/verify?objectPath=${encodeURIComponent(objectPath)}`, {
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StreamingServiceError(
      data.error || `Could not verify uploaded object (${res.status}).`,
      data.code,
      res.status
    );
  }
  return data;
}

function parseCommittedByteOffset(rangeHeader: string | null): number {
  if (!rangeHeader) return 0;
  const match = /bytes=0-(\d+)/i.exec(rangeHeader);
  if (!match) return 0;
  return parseInt(match[1], 10) + 1;
}

export type ResumableUploadControllerState =
  | 'idle'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface ResumableUploadResult {
  objectPath: string;
  gcsUri: string;
  bucketName: string;
  bytesTransferred: number;
  totalBytes: number;
}

/**
 * Stateful resumable chunked upload controller supporting Pause, Resume, Retry,
 * and Cancel while preserving the GCS session URI and committed byte offset.
 */
export class ResumableUploadController {
  readonly file: File;
  readonly videoId: string;
  readonly folder: 'videos' | 'thumbnails' | 'profileImages';
  readonly visibility: 'public' | 'unlisted' | 'private';
  readonly contentType: string;

  private session: UploadSessionResponse | null = null;
  private committedOffset = 0;
  private useServerChunkProxy = false;
  private abortController: AbortController | null = null;
  private state: ResumableUploadControllerState = 'idle';
  private hasAttemptedUpload = false;
  private onProgress?: (pct: number, bytesTransferred: number, totalBytes: number) => void;
  private onStateChange?: (state: ResumableUploadControllerState) => void;

  constructor(params: {
    file: File;
    videoId: string;
    folder: 'videos' | 'thumbnails' | 'profileImages';
    visibility?: 'public' | 'unlisted' | 'private';
    onProgress?: (pct: number, bytesTransferred: number, totalBytes: number) => void;
    onStateChange?: (state: ResumableUploadControllerState) => void;
  }) {
    this.file = params.file;
    this.videoId = params.videoId;
    this.folder = params.folder;
    this.visibility = params.visibility || 'public';
    this.contentType = params.file.type || (this.folder === 'videos' ? 'video/mp4' : 'image/jpeg');
    this.onProgress = params.onProgress;
    this.onStateChange = params.onStateChange;
  }

  getState(): ResumableUploadControllerState {
    return this.state;
  }

  getCommittedOffset(): number {
    return this.committedOffset;
  }

  getSession(): UploadSessionResponse | null {
    return this.session;
  }

  private setState(next: ResumableUploadControllerState) {
    this.state = next;
    this.onStateChange?.(next);
  }

  pause(): void {
    if (this.state !== 'uploading') return;
    this.setState('paused');
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  cancel(): void {
    this.setState('canceled');
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Probes GCS for how many bytes were committed before interruption.
   * Returns -1 if session expired (404/410), or committed byte offset >= 0.
   */
  private async probeRemoteCommittedOffset(session: UploadSessionResponse): Promise<number> {
    const totalSize = this.file.size;
    const probeRange = `bytes */${totalSize}`;

    if (!this.useServerChunkProxy) {
      try {
        const directRes = await fetch(session.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': probeRange,
          },
        });
        if (directRes.status === 308) {
          return parseCommittedByteOffset(directRes.headers.get('Range'));
        }
        if (directRes.ok) {
          return totalSize;
        }
        if (directRes.status === 404 || directRes.status === 410) {
          return -1;
        }
      } catch (err) {
        if (err instanceof TypeError) {
          this.useServerChunkProxy = true;
        }
      }
    }

    const idToken = await getFirebaseAuthToken();
    const proxyHeaders = await buildProtectedHeaders({
      Authorization: `Bearer ${idToken}`,
      'X-Upload-Session-Token': session.uploadSessionToken,
      'Content-Type': this.contentType,
      'Content-Range': probeRange,
    });
    const proxyRes = await fetch('/api/uploads/chunk', {
      method: 'PUT',
      headers: proxyHeaders,
    });

    if (proxyRes.status === 308) {
      const body = await proxyRes.json().catch(() => ({}));
      return parseCommittedByteOffset(body.range || proxyRes.headers.get('Range'));
    }
    if (proxyRes.ok) {
      return totalSize;
    }
    if (proxyRes.status === 404 || proxyRes.status === 410) {
      return -1;
    }
    return this.committedOffset;
  }

  async startOrResume(): Promise<ResumableUploadResult> {
    if (this.state === 'canceled') {
      throw new StreamingServiceError('Upload was canceled.', 'UPLOAD_CANCELED');
    }

    const totalSize = this.file.size;
    this.setState('uploading');

    try {
      // Create a fresh session if none exists or token expired
      if (!this.session || Date.now() >= this.session.expiresAt - 60_000) {
        this.committedOffset = 0;
        this.session = await requestResumableUploadSession({
          videoId: this.videoId,
          folder: this.folder,
          fileName: this.file.name,
          contentType: this.contentType,
          fileSizeBytes: totalSize,
          visibility: this.visibility,
        });
      } else if (this.committedOffset > 0 || this.hasAttemptedUpload) {
        const probed = await this.probeRemoteCommittedOffset(this.session);
        if (probed < 0) {
          // Session expired remotely — cleanly create a new session from byte 0
          this.committedOffset = 0;
          this.session = await requestResumableUploadSession({
            videoId: this.videoId,
            folder: this.folder,
            fileName: this.file.name,
            contentType: this.contentType,
            fileSizeBytes: totalSize,
            visibility: this.visibility,
          });
        } else {
          this.committedOffset = probed;
        }
      }
    } catch (initErr: any) {
      this.setState('failed');
      throw initErr;
    }

    this.hasAttemptedUpload = true;
    const session = this.session;
    const chunkSize = Math.max(256 * 1024, session.maxChunkBytes || 8 * 1024 * 1024);

    const initialPct = totalSize > 0 ? Math.min(100, Math.round((this.committedOffset / totalSize) * 100)) : 100;
    this.onProgress?.(initialPct, this.committedOffset, totalSize);

    while (this.committedOffset < totalSize) {
      if (this.getState() === 'paused') {
        throw new StreamingServiceError('Upload paused by user.', 'UPLOAD_PAUSED');
      }
      if (this.getState() === 'canceled') {
        throw new StreamingServiceError('Upload canceled by user.', 'UPLOAD_CANCELED');
      }

      const end = Math.min(this.committedOffset + chunkSize, totalSize);
      const chunk = this.file.slice(this.committedOffset, end);
      const contentRange = `bytes ${this.committedOffset}-${end - 1}/${totalSize}`;
      let chunkSuccess = false;
      let lastErr: Error | null = null;

      for (let attempt = 0; attempt < 3 && !chunkSuccess; attempt++) {
        if (this.getState() === 'paused') {
          throw new StreamingServiceError('Upload paused by user.', 'UPLOAD_PAUSED');
        }
        if (this.getState() === 'canceled') {
          throw new StreamingServiceError('Upload canceled by user.', 'UPLOAD_CANCELED');
        }

        const controller = new AbortController();
        this.abortController = controller;

        try {
          if (!this.useServerChunkProxy) {
            try {
              const directRes = await fetch(session.uploadUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': this.contentType,
                  'Content-Range': contentRange,
                },
                body: chunk,
                signal: controller.signal,
              });

              if (directRes.status === 308) {
                const committed = parseCommittedByteOffset(directRes.headers.get('Range'));
                this.committedOffset = committed > this.committedOffset ? committed : end;
                chunkSuccess = true;
                break;
              }
              if (directRes.ok) {
                this.committedOffset = totalSize;
                chunkSuccess = true;
                break;
              }
              if (directRes.status === 404 || directRes.status === 410) {
                this.session = null;
                this.committedOffset = 0;
                throw new StreamingServiceError(
                  'Upload session expired. Click Retry Upload to start a fresh session.',
                  'UPLOAD_SESSION_EXPIRED',
                  directRes.status
                );
              }
              const errText = await directRes.text().catch(() => '');
              throw new StreamingServiceError(
                errText || `Direct GCS upload returned HTTP ${directRes.status}`,
                'GCS_DIRECT_UPLOAD_FAILED',
                directRes.status
              );
            } catch (directErr: any) {
              if (directErr?.name === 'AbortError') {
                throw directErr;
              }
              if (directErr instanceof TypeError) {
                this.useServerChunkProxy = true;
              } else {
                throw directErr;
              }
            }
          }

          if (this.useServerChunkProxy) {
            const idToken = await getFirebaseAuthToken();
            const proxyHeaders = await buildProtectedHeaders({
              Authorization: `Bearer ${idToken}`,
              'X-Upload-Session-Token': session.uploadSessionToken,
              'Content-Type': this.contentType,
              'Content-Range': contentRange,
            });
            const proxyRes = await fetch('/api/uploads/chunk', {
              method: 'PUT',
              headers: proxyHeaders,
              body: chunk,
              signal: controller.signal,
            });

            if (proxyRes.status === 308) {
              const body = await proxyRes.json().catch(() => ({}));
              const committed = parseCommittedByteOffset(body.range || proxyRes.headers.get('Range'));
              this.committedOffset = committed > this.committedOffset ? committed : end;
              chunkSuccess = true;
              break;
            }
            if (proxyRes.ok) {
              this.committedOffset = totalSize;
              chunkSuccess = true;
              break;
            }
            const errJson = await proxyRes.json().catch(() => ({}));
            if (proxyRes.status === 404 || proxyRes.status === 410 || errJson.code === 'UPLOAD_SESSION_EXPIRED') {
              this.session = null;
              this.committedOffset = 0;
              throw new StreamingServiceError(
                errJson.error || 'Upload session expired. Click Retry Upload to restart.',
                'UPLOAD_SESSION_EXPIRED',
                410
              );
            }
            throw new StreamingServiceError(
              errJson.error || `Resumable chunk upload failed (${proxyRes.status})`,
              errJson.code,
              proxyRes.status
            );
          }
        } catch (err: any) {
          this.abortController = null;
          const currentState = this.getState();
          if (err?.name === 'AbortError' || currentState === 'paused' || currentState === 'canceled') {
            throw new StreamingServiceError(
              currentState === 'paused' ? 'Upload paused by user.' : 'Upload canceled by user.',
              currentState === 'paused' ? 'UPLOAD_PAUSED' : 'UPLOAD_CANCELED'
            );
          }

          lastErr = err instanceof Error ? err : new Error(String(err));
          const status = (err as StreamingServiceError)?.statusCode;
          // Do not retry non-transient 4xx validation/permission/session-expired errors
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
            break;
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        } finally {
          if (this.abortController === controller) {
            this.abortController = null;
          }
        }
      }

      if (!chunkSuccess) {
        this.setState('failed');
        throw lastErr || new StreamingServiceError('Resumable upload interrupted after 3 retries.');
      }

      const pct = totalSize > 0 ? Math.min(100, Math.round((this.committedOffset / totalSize) * 100)) : 100;
      this.onProgress?.(pct, this.committedOffset, totalSize);
    }

    this.setState('completed');
    return {
      objectPath: session.objectPath,
      gcsUri: session.gcsUri,
      bucketName: session.bucketName,
      bytesTransferred: this.committedOffset,
      totalBytes: totalSize,
    };
  }
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
  const controller = new ResumableUploadController(params);
  const result = await controller.startOrResume();
  return {
    objectPath: result.objectPath,
    gcsUri: result.gcsUri,
    bucketName: result.bucketName,
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
  trimStart?: number;
  trimEnd?: number;
  isMutedAudio?: boolean;
}): Promise<{
  success: boolean;
  jobName: string;
  state: string;
  hlsOutputPrefix: string;
}> {
  const idToken = await getFirebaseAuthToken();
  const headers = await buildProtectedHeaders({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  });
  const res = await fetch(`/api/videos/${encodeURIComponent(params.videoId)}/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sourceObjectPath: params.sourceObjectPath,
      collectionName: params.collectionName || 'videos',
      sourceWidth: params.sourceWidth,
      sourceHeight: params.sourceHeight,
      trimStart: params.trimStart,
      trimEnd: params.trimEnd,
      isMutedAudio: params.isMutedAudio,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StreamingServiceError(
      data.error || `Failed to start Cloud Transcoder job (${res.status}).`,
      data.code,
      res.status
    );
  }
  return data;
}

export async function getVideoProcessingStatus(videoId: string): Promise<{
  videoId: string;
  state: string;
  transcodingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  hlsManifestUrl?: string;
  errorMessage?: string;
}> {
  const baseHeaders: Record<string, string> = {};
  if (auth.currentUser) {
    try {
      baseHeaders.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    } catch {
      // optional
    }
  }
  const headers = await buildProtectedHeaders(baseHeaders);
  const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/status`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StreamingServiceError(
      data.error || `Failed to check transcode status (${res.status}).`,
      data.code,
      res.status
    );
  }
  return data;
}

export async function fetchPlaybackSession(videoId: string): Promise<{
  videoId: string;
  visibility: 'public' | 'unlisted' | 'private';
  transcodingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  hlsUrl: string | null;
  fallbackUrl: string | null;
}> {
  const baseHeaders: Record<string, string> = {};
  if (auth.currentUser) {
    try {
      baseHeaders.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    } catch {
      // optional
    }
  }
  const headers = await buildProtectedHeaders(baseHeaders);
  const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/playback`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StreamingServiceError(
      data.error || `Playback authorization failed (${res.status}).`,
      data.code,
      res.status
    );
  }
  return data;
}

/**
 * Records a rate-limited, server-deduplicated video/reel view.
 */
export async function recordVideoViewOnServer(videoId: string): Promise<{
  success: boolean;
  counted: boolean;
  deduplicated?: boolean;
  mode?: string;
}> {
  if (!auth.currentUser) {
    return {
      success: false,
      counted: false,
    };
  }

  const baseHeaders: Record<string, string> = {};
  try {
    baseHeaders.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  } catch {
    return {
      success: false,
      counted: false,
    };
  }

  try {
    const headers = await buildProtectedHeaders(baseHeaders);
    const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/view`, {
      method: 'POST',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        success: Boolean(data.success),
        counted: Boolean(data.counted),
        deduplicated: Boolean(data.deduplicated),
        mode: data.mode,
      };
    }
    return {
      success: false,
      counted: false,
    };
  } catch {
    return {
      success: false,
      counted: false,
    };
  }
}

/**
 * Creates a validated notification via the backend API (stamps senderId server-side).
 */
export async function createNotificationOnServer(notification: {
  userId: string;
  type: NotificationItem['type'];
  title: string;
  message: string;
  avatar?: string;
  thumbnailUrl?: string;
  videoId?: string;
  channelId?: string;
}): Promise<{
  success: boolean;
  id?: string;
  mode?: string;
  fallbackToClient?: boolean;
}> {
  const idToken = await getFirebaseAuthToken();
  try {
    const headers = await buildProtectedHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    });
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers,
      body: JSON.stringify(notification),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        success: true,
        id: data.id,
        mode: data.mode,
      };
    }
    if (res.status >= 500 || data.code === 'FIRESTORE_ADMIN_PERMISSION_DENIED') {
      return {
        success: false,
        fallbackToClient: true,
      };
    }
    throw new StreamingServiceError(
      data.error || `Failed to create notification (${res.status}).`,
      data.code,
      res.status
    );
  } catch (err) {
    if (err instanceof StreamingServiceError) {
      throw err;
    }
    return {
      success: false,
      fallbackToClient: true,
    };
  }
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
