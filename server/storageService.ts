import crypto from 'crypto';
import { Storage, Bucket } from '@google-cloud/storage';
import { serverConfig } from './config';

const storageClient = new Storage({
  projectId: serverConfig.firebaseProjectId || serverConfig.gcpProjectId,
});

export function getMediaBucket(): Bucket {
  if (!serverConfig.gcsBucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured.');
  }
  return storageClient.bucket(serverConfig.gcsBucketName);
}

export interface BucketHealthStatus {
  configured: boolean;
  bucketName: string;
  accessible: boolean;
  location?: string;
  storageClass?: string;
  uniformBucketLevelAccess?: boolean;
  error?: string;
  errorCode?: number;
}

export async function checkBucketHealth(): Promise<BucketHealthStatus> {
  if (!serverConfig.gcsBucketName) {
    return {
      configured: false,
      bucketName: '',
      accessible: false,
      error: 'GCS bucket name is not configured.',
    };
  }

  try {
    const bucket = getMediaBucket();
    const [metadata] = await bucket.getMetadata();
    return {
      configured: true,
      bucketName: serverConfig.gcsBucketName,
      accessible: true,
      location: metadata.location,
      storageClass: metadata.storageClass,
      uniformBucketLevelAccess: Boolean(metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled),
    };
  } catch (err: any) {
    return {
      configured: true,
      bucketName: serverConfig.gcsBucketName,
      accessible: false,
      error: err?.message || 'Failed to access Google Cloud Storage bucket.',
      errorCode: typeof err?.code === 'number' ? err.code : undefined,
    };
  }
}

export interface UploadSessionParams {
  uid: string;
  videoId: string;
  folder: 'videos' | 'thumbnails' | 'profileImages';
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  visibility: 'public' | 'unlisted' | 'private';
  origin?: string;
}

export interface UploadSessionResult {
  uploadUrl: string;
  uploadSessionToken: string;
  objectPath: string;
  gcsUri: string;
  bucketName: string;
  maxChunkBytes: number;
  expiresAt: number;
}

export function sanitizeFileName(rawName: string): string {
  const base = rawName.split(/[/\\]/).pop() || 'upload.bin';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 120) || 'upload.bin';
}

export function buildStorageObjectPath(
  folder: 'videos' | 'thumbnails' | 'profileImages',
  uid: string,
  videoId: string,
  fileName: string
): string {
  const safeName = sanitizeFileName(fileName);
  const ts = Date.now();
  if (folder === 'videos') {
    return `videos/${uid}/${videoId}/${ts}_${safeName}`;
  }
  if (folder === 'thumbnails') {
    return `thumbnails/${uid}/${videoId}_${ts}_${safeName}`;
  }
  return `profileImages/${uid}/${ts}_${safeName}`;
}

/**
 * Signs an upload session descriptor with HMAC-SHA256 so /api/uploads/chunk
 * can securely proxy resumable byte chunks without acting as an open SSRF relay.
 */
export function signUploadSessionToken(payload: {
  uid: string;
  objectPath: string;
  uploadUrl: string;
  contentType: string;
  fileSizeBytes: number;
  exp: number;
}): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', serverConfig.playbackTokenSecret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyUploadSessionToken(token: string): {
  uid: string;
  objectPath: string;
  uploadUrl: string;
  contentType: string;
  fileSizeBytes: number;
  exp: number;
} | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', serverConfig.playbackTokenSecret)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (
      typeof parsed.uploadUrl !== 'string' ||
      !parsed.uploadUrl.startsWith('https://storage.googleapis.com/')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]);

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Creates a real Google Cloud Storage Resumable Upload session URI
 * inside the configured Firebase/GCS bucket.
 */
export async function createAuthorizedResumableUpload(
  params: UploadSessionParams
): Promise<UploadSessionResult> {
  const { uid, videoId, folder, fileName, contentType, fileSizeBytes, visibility, origin } = params;
  const normalizedMime = contentType.toLowerCase().split(';')[0].trim();
  const lowerName = fileName.toLowerCase();

  if (folder === 'videos') {
    const validVideoExt = /\.(mp4|mov|webm|m4v)$/i.test(lowerName);
    if (!ALLOWED_VIDEO_MIMES.has(normalizedMime) && !(normalizedMime === 'application/octet-stream' && validVideoExt)) {
      throw Object.assign(
        new Error('Unsupported video format. Allowed formats: MP4, MOV, and WebM.'),
        { statusCode: 400 }
      );
    }
    const maxBytes = Math.min(serverConfig.maxVideoUploadBytes, 500 * 1024 * 1024);
    if (fileSizeBytes <= 0 || fileSizeBytes > maxBytes) {
      throw Object.assign(
        new Error(`Video size must be between 1 byte and ${Math.round(maxBytes / (1024 * 1024))} MB.`),
        { statusCode: 400 }
      );
    }
  } else {
    if (!ALLOWED_IMAGE_MIMES.has(normalizedMime)) {
      throw Object.assign(
        new Error('Unsupported image format. Allowed formats: JPG, PNG, WebP, or GIF.'),
        { statusCode: 400 }
      );
    }
    const maxImageBytes = Math.min(serverConfig.maxImageUploadBytes, 5 * 1024 * 1024);
    if (fileSizeBytes <= 0 || fileSizeBytes > maxImageBytes) {
      throw Object.assign(
        new Error(`Image size must be between 1 byte and ${Math.round(maxImageBytes / (1024 * 1024))} MB.`),
        { statusCode: 400 }
      );
    }
  }

  const bucket = getMediaBucket();
  const objectPath = buildStorageObjectPath(folder, uid, videoId, fileName);
  const file = bucket.file(objectPath);

  const [uploadUrl] = await file.createResumableUpload({
    origin: origin || undefined,
    metadata: {
      contentType,
      metadata: {
        ownerId: uid,
        videoId,
        visibility,
        originalFileName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const uploadSessionToken = signUploadSessionToken({
    uid,
    objectPath,
    uploadUrl,
    contentType,
    fileSizeBytes,
    exp: expiresAt,
  });

  return {
    uploadUrl,
    uploadSessionToken,
    objectPath,
    gcsUri: `gs://${serverConfig.gcsBucketName}/${objectPath}`,
    bucketName: serverConfig.gcsBucketName,
    maxChunkBytes: 8 * 1024 * 1024, // 8 MiB (multiple of 256 KiB required by GCS)
    expiresAt,
  };
}

/**
 * Verifies an uploaded object exists in GCS and returns its metadata.
 */
export async function verifyUploadedObject(objectPath: string): Promise<{
  exists: boolean;
  sizeBytes: number;
  contentType: string;
  ownerId?: string;
}> {
  const bucket = getMediaBucket();
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) {
    return { exists: false, sizeBytes: 0, contentType: '' };
  }
  const [metadata] = await file.getMetadata();
  const customMeta = (metadata.metadata || {}) as Record<string, string>;
  return {
    exists: true,
    sizeBytes: parseInt(String(metadata.size || '0'), 10),
    contentType: metadata.contentType || 'application/octet-stream',
    ownerId: customMeta.ownerId,
  };
}

/**
 * Generates a short-lived V4 Signed URL when the runtime service account
 * has iam.serviceAccounts.signBlob permission; returns null otherwise so
 * callers can stream via authenticated Cloud Run proxy routes cleanly.
 */
export async function tryCreateSignedReadUrl(
  objectPath: string,
  expiresInSeconds: number = 900
): Promise<string | null> {
  try {
    const bucket = getMediaBucket();
    const [signedUrl] = await bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
    return signedUrl;
  } catch {
    return null;
  }
}
