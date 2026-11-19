import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { FieldValue } from 'firebase-admin/firestore';
import path from 'path';
import os from 'os';
import { serverConfig } from './server/config';
import {
  adminDb,
  AuthenticatedRequest,
  checkFirestoreAdminHealth,
  extractBearerToken,
  optionalFirebaseAuth,
  requireFirebaseAuth,
  verifyFirebaseAppCheck,
} from './server/firebaseAdmin';
import {
  checkBucketHealth,
  createAuthorizedResumableUpload,
  getMediaBucket,
  verifyUploadedObject,
  verifyUploadSessionToken,
} from './server/storageService';
import {
  checkTranscoderApiHealth,
  startCloudTranscodeJob,
  syncTranscodeJobStatus,
} from './server/transcoderService';
import {
  createPlaybackToken,
  isAuthorizedForMedia,
  lookupMediaRecord,
  resolveFallbackMediaUrl,
  resolveMediaRecordForRequest,
  rewriteHlsPlaylist,
  streamGcsObjectWithRange,
} from './server/playbackService';

// Bounded in-memory LRU caches (15 min view dedup + per-UID rate & notification anti-spam)
const VIEW_DEDUP_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 10_000;
const recentViewCache = new Map<string, number>();
const uidRateWindows = new Map<string, { count: number; resetAt: number }>();
const recentNotificationCache = new Map<string, number>();

function evictExpiredAndOldest(map: Map<string, number>, now: number, maxEntries: number): void {
  if (map.size < maxEntries) return;
  for (const [k, exp] of map.entries()) {
    if (exp <= now) map.delete(k);
  }
  while (map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

function recordRecentViewIfFresh(uid: string, videoId: string): boolean {
  const now = Date.now();
  const cacheKey = `${uid}:${videoId}`;
  const existingExp = recentViewCache.get(cacheKey);
  if (existingExp && existingExp > now) {
    return false;
  }
  if (existingExp !== undefined) {
    recentViewCache.delete(cacheKey);
  }
  evictExpiredAndOldest(recentViewCache, now, MAX_CACHE_ENTRIES);
  recentViewCache.set(cacheKey, now + VIEW_DEDUP_TTL_MS);
  return true;
}

function checkPerUidRateLimit(scope: string, uid: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${scope}:${uid}`;
  const existing = uidRateWindows.get(key);
  if (!existing || existing.resetAt <= now) {
    if (uidRateWindows.size >= MAX_CACHE_ENTRIES) {
      for (const [k, v] of uidRateWindows.entries()) {
        if (v.resetAt <= now) uidRateWindows.delete(k);
      }
      while (uidRateWindows.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = uidRateWindows.keys().next().value;
        if (oldestKey === undefined) break;
        uidRateWindows.delete(oldestKey);
      }
    }
    uidRateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) {
    return false;
  }
  existing.count += 1;
  return true;
}

function recordNotificationCooldownIfFresh(key: string, ttlMs: number = 60_000): boolean {
  const now = Date.now();
  const existingExp = recentNotificationCache.get(key);
  if (existingExp && existingExp > now) {
    return false;
  }
  if (existingExp !== undefined) {
    recentNotificationCache.delete(key);
  }
  evictExpiredAndOldest(recentNotificationCache, now, MAX_CACHE_ENTRIES);
  recentNotificationCache.set(key, now + ttlMs);
  return true;
}

function isSafeAssetOrHttpsUrl(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.length > 500 || /[\r\n\0]/.test(trimmed)) return false;
  if (trimmed.startsWith('/api/')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseOriginSafely(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function isOriginAllowedByPolicy(origin: string, req: Request): boolean {
  const host = req.get('host');
  if (host) {
    const sameOriginHttps = `https://${host}`;
    const sameOriginHttp = `http://${host}`;
    if (origin === sameOriginHttps || origin === sameOriginHttp) {
      return true;
    }
  }

  const appOrigin = serverConfig.appUrl ? parseOriginSafely(serverConfig.appUrl) : null;
  if (appOrigin && origin === appOrigin) {
    return true;
  }

  if (serverConfig.corsAllowedOrigins.length > 0) {
    return serverConfig.corsAllowedOrigins.includes(origin);
  }

  // Default preview/development origin allowlist when CORS_ALLOWED_ORIGINS is not explicitly configured
  try {
    const parsed = new URL(origin);
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.endsWith('.run.app') ||
      parsed.hostname === 'aistudio.google.com' ||
      parsed.hostname.endsWith('.aistudio.google.com')
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function isPermissionDeniedErr(err: any): boolean {
  const msg = String(err?.message || err?.details || '');
  return err?.code === 7 || /PERMISSION_DENIED|Missing or insufficient permissions/i.test(msg);
}

function isValidResourceId(id: string | undefined): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

function sanitizeLogError(err: any): string {
  const raw = String(err?.message || err || 'Unknown error');
  return raw
    .replace(/([?&](?:pt|token|sig|X-Goog-Signature|X-Goog-Credential|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  if (!serverConfig.hasPersistentPlaybackSecret) {
    const warningMsg =
      '[Vio Streaming Security Warning] PLAYBACK_TOKEN_SECRET is not set. Using an ephemeral per-instance secret; playback and upload session tokens will be invalidated on restart or across multi-instance Cloud Run containers.';
    if (serverConfig.nodeEnv === 'production') {
      console.error(warningMsg);
    } else {
      console.warn(warningMsg);
    }
  }

  // Helmet HTTP security headers (tuned for VIO Streaming HLS workers, Firebase popups, external video/image CDNs, and preview iframe)
  app.use(
    helmet({
      contentSecurityPolicy:
        serverConfig.nodeEnv === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://apis.google.com', 'https://www.gstatic.com'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
                connectSrc: ["'self'", 'https:', 'wss:'],
                frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
                workerSrc: ["'self'", 'blob:'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
              },
            }
          : false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Raw binary body parser exclusively for chunked resumable upload proxy (8 MiB chunks, 16 MiB cap)
  app.use(
    '/api/uploads/chunk',
    express.raw({
      type: () => true,
      limit: '16mb',
    })
  );

  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true, limit: '4mb' }));

  // Strict Configurable CORS Policy
  app.use((req, res, next) => {
    const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    let originAllowed = true;

    if (requestOrigin) {
      originAllowed = isOriginAllowedByPolicy(requestOrigin, req);
      if (originAllowed) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Range, Content-Type, Content-Range, Authorization, X-Requested-With, X-Upload-Session-Token, X-Firebase-AppCheck'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Content-Length, Accept-Ranges, Range'
    );

    if (requestOrigin && !originAllowed && (req.path.startsWith('/api/') || req.method === 'OPTIONS')) {
      return res.status(403).json({
        error: 'Origin not allowed by CORS policy.',
        code: 'CORS_ORIGIN_DENIED',
      });
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // API Rate Limiting Tiers
  const apiGeneralLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      req.path === '/health' ||
      req.path === '/infrastructure/status' ||
      req.path.startsWith('/media/') ||
      req.path.startsWith('/stream/'),
    message: {
      error: 'Too many API requests. Please slow down and try again shortly.',
      code: 'RATE_LIMITED',
    },
  });

  const uploadInitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many upload or transcoding requests. Please wait a few minutes before trying again.',
      code: 'UPLOAD_RATE_LIMITED',
    },
  });

  const chunkProxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 400,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many chunk upload requests. Please pause and resume in a moment.',
      code: 'CHUNK_RATE_LIMITED',
    },
  });

  const interactionLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many view or notification requests. Please slow down.',
      code: 'INTERACTION_RATE_LIMITED',
    },
  });

  app.use('/api', apiGeneralLimiter);

  // 1. Live Healthcheck & Real GCP Service Readiness
  app.get('/api/health', async (_req: Request, res: Response) => {
    const [bucketHealth, transcoderHealth, firestoreAdminHealth] = await Promise.all([
      checkBucketHealth(),
      checkTranscoderApiHealth(),
      checkFirestoreAdminHealth(),
    ]);

    const ready = bucketHealth.accessible && transcoderHealth.accessible;
    res.status(200).json({
      status: ready ? 'online' : 'degraded',
      service: 'VIO Streaming Cloud Run Media Server',
      runtime: serverConfig.isCloudRun ? 'google-cloud-run' : 'node-server',
      cloudRunService: serverConfig.cloudRunService,
      firebaseProjectId: serverConfig.firebaseProjectId,
      gcpProjectId: serverConfig.gcpProjectId,
      firestoreDatabaseId: serverConfig.firestoreDatabaseId,
      edgePoP: `${serverConfig.transcoderLocation} (Google Cloud)`,
      adaptiveBitrateSupported: true,
      hlsProtocolVersion: 7,
      security: {
        helmetEnabled: true,
        rateLimitingEnabled: true,
        corsMode: serverConfig.corsAllowedOrigins.length > 0 ? 'strict-allowlist' : 'origin-policy',
        appCheckEnforcement: serverConfig.appCheckEnforcement,
        appCheckClientConfigured: Boolean(serverConfig.recaptchaSiteKey),
        persistentPlaybackSecretConfigured: serverConfig.hasPersistentPlaybackSecret,
      },
      gcpServices: {
        cloudStorage: bucketHealth,
        cloudTranscoder: transcoderHealth,
        firestoreAdmin: firestoreAdminHealth,
        persistentPlaybackSecretConfigured: serverConfig.hasPersistentPlaybackSecret,
      },
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // 1b. Real Runtime Infrastructure & GCP Diagnostics (preserves UI contract)
  app.get('/api/infrastructure/status', async (_req: Request, res: Response) => {
    const [bucketHealth, transcoderHealth, firestoreAdminHealth] = await Promise.all([
      checkBucketHealth(),
      checkTranscoderApiHealth(),
      checkFirestoreAdminHealth(),
    ]);

    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem() || 1;
    const memPct = ((memUsage.rss / totalMem) * 100).toFixed(1);
    const load1m = os.loadavg()[0] || 0;
    const cpuCount = os.cpus().length || 1;
    const cpuPct = Math.min(100, Math.round((load1m / cpuCount) * 1000) / 10).toFixed(1);

    res.json({
      status: bucketHealth.accessible && transcoderHealth.accessible ? 'operational' : 'degraded',
      environment: serverConfig.nodeEnv,
      cloudProvider: 'Google Cloud Platform (Cloud Run · GCS · Cloud Transcoder API)',
      autoScaleServers: {
        activeInstances: serverConfig.isCloudRun ? 1 : 1,
        minInstances: 0,
        maxInstances: 100,
        avgCpuUtilization: `${cpuPct}%`,
        avgMemoryUtilization: `${memPct}%`,
        autoScalingPolicy: 'Google Cloud Run request-based autoscaling',
        regions: [serverConfig.transcoderLocation],
      },
      cdnGlobalDelivery: {
        network: 'Google Cloud Run + Cloud Storage Streaming',
        edgeLocations: 1,
        globalCacheHitRatio: bucketHealth.accessible ? '100%' : '0%',
        averageLatencyMs: 0,
        totalBandwidthDeliveredGbps: 0,
        activeStreamsServed: 0,
        sslTlsVersion: 'TLS 1.3',
      },
      cloudStorageAndHls: {
        storageType: 'Google Cloud Storage (Firebase Storage Bucket)',
        bucketName: bucketHealth.bucketName || 'unconfigured',
        bucketAccessible: bucketHealth.accessible,
        bucketError: bucketHealth.error || null,
        redundancy: bucketHealth.location || 'Regional / Multi-Region',
        firestoreAdminAccessible: firestoreAdminHealth.accessible,
        firestoreAdminMode: firestoreAdminHealth.mode,
        firestoreAdminError: firestoreAdminHealth.error || null,
        hlsTranscoding: {
          engine: 'Google Cloud Transcoder API (v1)',
          apiAccessible: transcoderHealth.accessible,
          apiError: transcoderHealth.error || null,
          supportedResolutions: ['1080p HD', '720p HD', '480p', '360p'],
          segmentDurationSeconds: 4.0,
          manifestType: 'HLS (master.m3u8)',
          audioCodec: 'AAC-LC 128kbps Stereo',
        },
      },
    });
  });

  // 2. Authorized Upload Session Creation (Google Cloud Storage Resumable Upload)
  app.post(
    '/api/uploads/session',
    uploadInitLimiter,
    verifyFirebaseAppCheck,
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authenticated Firebase user required.' });
    }

    const {
      videoId,
      folder = 'videos',
      fileName,
      contentType,
      fileSizeBytes,
      visibility = 'public',
    } = req.body || {};

    if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0 || fileName.length > 255) {
      return res.status(400).json({ error: 'fileName must be a non-empty string (max 255 chars).' });
    }
    if (!contentType || typeof contentType !== 'string' || contentType.trim().length === 0 || contentType.length > 128) {
      return res.status(400).json({ error: 'contentType must be a valid MIME type string.' });
    }
    if (typeof fileSizeBytes !== 'number' || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return res.status(400).json({ error: 'fileSizeBytes must be a positive number.' });
    }
    if (!['videos', 'thumbnails', 'profileImages'].includes(folder)) {
      return res.status(400).json({ error: 'Invalid upload folder.' });
    }
    if (!['public', 'unlisted', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility option.' });
    }

    const safeVideoId =
      typeof videoId === 'string' && videoId.trim()
        ? videoId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
        : `vid_${Date.now()}`;

    try {
      const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
      const session = await createAuthorizedResumableUpload({
        uid,
        videoId: safeVideoId,
        folder,
        fileName,
        contentType,
        fileSizeBytes,
        visibility,
        origin: originHeader,
      });

      return res.status(201).json({
        success: true,
        videoId: safeVideoId,
        ...session,
      });
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 503;
      const gcpCode = typeof err?.code === 'number' ? err.code : undefined;
      console.error('[Vio Upload] Failed to create GCS resumable upload session:', sanitizeLogError(err));
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 503).json({
        error: err?.message || 'Failed to initialize Google Cloud Storage resumable upload.',
        code: gcpCode === 404 ? 'GCS_BUCKET_NOT_FOUND' : gcpCode === 403 ? 'GCS_PERMISSION_DENIED' : 'GCS_UPLOAD_SESSION_ERROR',
        bucketName: serverConfig.gcsBucketName,
      });
    }
  });

  // 2b. Authenticated Resumable Chunk Proxy (for 8 MiB chunks when browser CORS blocks direct GCS PUT)
  app.put(
    '/api/uploads/chunk',
    chunkProxyLimiter,
    verifyFirebaseAppCheck,
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    const sessionToken = req.headers['x-upload-session-token'];
    if (!sessionToken || typeof sessionToken !== 'string') {
      return res.status(400).json({ error: 'Missing X-Upload-Session-Token header.' });
    }

    const session = verifyUploadSessionToken(sessionToken);
    if (!session || session.uid !== uid) {
      return res.status(403).json({ error: 'Invalid or expired upload session token.' });
    }

    const rawContentRange = req.headers['content-range'];
    if (typeof rawContentRange !== 'string' || !rawContentRange.trim()) {
      return res.status(400).json({
        error: 'Missing Content-Range header.',
        code: 'INVALID_CONTENT_RANGE',
      });
    }

    const contentRange = rawContentRange.trim();
    const isStatusProbe = /^bytes \*\/(\d+|\*)$/i.test(contentRange);
    const chunkRangeMatch = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange);

    if (!isStatusProbe && !chunkRangeMatch) {
      return res.status(400).json({
        error: 'Malformed Content-Range header.',
        code: 'INVALID_CONTENT_RANGE',
      });
    }

    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (chunkRangeMatch) {
      const start = Number(chunkRangeMatch[1]);
      const end = Number(chunkRangeMatch[2]);
      const total = chunkRangeMatch[3] === '*' ? null : Number(chunkRangeMatch[3]);
      const expectedLen = end - start + 1;

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end < start ||
        (total !== null && end >= total) ||
        bodyBuffer.length === 0 ||
        bodyBuffer.length !== expectedLen
      ) {
        return res.status(400).json({
          error: 'Chunk payload size does not match Content-Range byte window.',
          code: 'CHUNK_RANGE_MISMATCH',
        });
      }
    } else if (isStatusProbe && bodyBuffer.length > 0) {
      return res.status(400).json({
        error: 'Status probe requests must have an empty body.',
        code: 'INVALID_STATUS_PROBE',
      });
    }

    const contentType =
      typeof req.headers['content-type'] === 'string' && req.headers['content-type']
        ? req.headers['content-type']
        : session.contentType;

    try {
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Range': contentRange,
      };

      const upstream = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers,
        body: bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined,
      });

      const upstreamRange = upstream.headers.get('range');
      if (upstreamRange) {
        res.setHeader('Range', upstreamRange);
      }

      const textBody = await upstream.text();
      if (upstream.status === 308) {
        return res.status(308).json({
          status: 'incomplete',
          range: upstreamRange || null,
        });
      }

      if (upstream.status === 404 || upstream.status === 410) {
        return res.status(410).json({
          error: 'Resumable upload session expired or no longer exists in Cloud Storage.',
          code: 'UPLOAD_SESSION_EXPIRED',
        });
      }

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: textBody || `GCS chunk upload failed with status ${upstream.status}`,
          code: 'GCS_CHUNK_UPLOAD_FAILED',
        });
      }

      return res.status(upstream.status).json({
        success: true,
        objectPath: session.objectPath,
      });
    } catch (err: any) {
      console.error('[Vio Upload] Chunk forward error:', err?.message || err);
      return res.status(502).json({
        error: err?.message || 'Failed to forward upload chunk to Google Cloud Storage.',
        code: 'GCS_PROXY_ERROR',
      });
    }
  });

  // 2c. Verify uploaded GCS object existence & size
  app.get(
    '/api/uploads/verify',
    verifyFirebaseAppCheck,
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    const rawPath = typeof req.query.objectPath === 'string' ? req.query.objectPath.trim() : '';
    if (!rawPath) {
      return res.status(400).json({ error: 'objectPath query parameter is required.', code: 'MISSING_OBJECT_PATH' });
    }
    const objectPath = path.posix.normalize(rawPath).replace(/^\/+/, '');
    const isOwnedPath =
      Boolean(uid) &&
      !objectPath.includes('..') &&
      (objectPath.startsWith(`videos/${uid}/`) ||
        objectPath.startsWith(`thumbnails/${uid}/`) ||
        objectPath.startsWith(`profileImages/${uid}/`));

    if (!objectPath || !isOwnedPath) {
      return res.status(403).json({ error: 'Forbidden object path.' });
    }
    try {
      const info = await verifyUploadedObject(objectPath);
      if (!info.exists) {
        return res.status(404).json({ exists: false, error: 'Object not found in Cloud Storage.' });
      }
      return res.json(info);
    } catch (err: any) {
      return res.status(503).json({ error: sanitizeLogError(err) || 'Could not verify storage object.' });
    }
  });

  // 3. Real Background Video Processing (Google Cloud Transcoder API -> 360p/480p/720p/1080p HLS)
  app.post(
    '/api/videos/:videoId/process',
    uploadInitLimiter,
    verifyFirebaseAppCheck,
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { videoId } = req.params;
    if (!isValidResourceId(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId.', code: 'INVALID_VIDEO_ID' });
    }
    const {
      sourceObjectPath,
      collectionName = 'videos',
      sourceWidth,
      sourceHeight,
      trimStart,
      trimEnd,
      isMutedAudio,
    } = req.body || {};

    if (!sourceObjectPath || typeof sourceObjectPath !== 'string') {
      return res.status(400).json({ error: 'sourceObjectPath is required.', code: 'INVALID_INPUT' });
    }
    if (collectionName !== 'videos' && collectionName !== 'reels') {
      return res.status(400).json({ error: 'collectionName must be "videos" or "reels".', code: 'INVALID_INPUT' });
    }

    try {
      const result = await startCloudTranscodeJob({
        videoId,
        collectionName,
        ownerId: uid,
        callerIdToken: extractBearerToken(req),
        sourceObjectPath,
        sourceWidth: typeof sourceWidth === 'number' ? sourceWidth : undefined,
        sourceHeight: typeof sourceHeight === 'number' ? sourceHeight : undefined,
        trimStart: typeof trimStart === 'number' ? trimStart : undefined,
        trimEnd: typeof trimEnd === 'number' ? trimEnd : undefined,
        isMutedAudio: Boolean(isMutedAudio),
      });

      return res.status(202).json({
        success: true,
        videoId,
        transcodingStatus: 'processing',
        ...result,
      });
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 503;
      const errCode = typeof err?.code === 'string' ? err.code : 'TRANSCODER_START_FAILED';
      console.error('[Vio Transcoder] Failed to create Cloud Transcoder job:', err?.message || err);
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 503).json({
        error: err?.message || 'Failed to start Google Cloud Transcoder job.',
        code: errCode,
      });
    }
  });

  // 4. Live Video Transcoding Status Query (read-only for viewers; owner/admin may sync Cloud Transcoder state)
  app.get(
    '/api/videos/:videoId/status',
    verifyFirebaseAppCheck,
    optionalFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    if (!isValidResourceId(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId.', code: 'INVALID_VIDEO_ID' });
    }
    try {
      const record = await lookupMediaRecord(videoId, extractBearerToken(req));
      if (!record) {
        return res.status(404).json({ error: 'Video record not found.', code: 'NOT_FOUND' });
      }
      if (!isAuthorizedForMedia(req, record)) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this private video.' });
      }

      const isOwnerOrAdmin = Boolean(
        req.user && (req.user.uid === record.ownerId || req.user.admin === true)
      );
      if (!isOwnerOrAdmin) {
        const transcodingStatus = record.transcodingStatus || 'ready';
        return res.json({
          success: true,
          videoId,
          state:
            transcodingStatus === 'ready'
              ? 'SUCCEEDED'
              : transcodingStatus === 'failed'
              ? 'FAILED'
              : 'PROCESSING',
          transcodingStatus,
          ...(record.hlsManifestUrl ? { hlsManifestUrl: record.hlsManifestUrl } : {}),
        });
      }

      const status = await syncTranscodeJobStatus(videoId, record.collectionName, undefined, {
        allowMutate: true,
      });
      return res.json({ success: true, ...status });
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 503;
      return res.status(statusCode).json({
        error: err?.message || 'Could not query Cloud Transcoder job status.',
      });
    }
  });

  // 5. Authorized Video Playback Bootstrap (returns signed HLS manifest + fallback URL)
  app.get(
    '/api/videos/:videoId/playback',
    verifyFirebaseAppCheck,
    optionalFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    if (!isValidResourceId(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId.', code: 'INVALID_VIDEO_ID' });
    }
    try {
      const record = await lookupMediaRecord(videoId, extractBearerToken(req));
      if (!record) {
        return res.status(404).json({ error: 'Video record not found in Firestore.' });
      }

      if (!isAuthorizedForMedia(req, record)) {
        return res.status(401).json({
          error: 'Authentication required to play this private video.',
          code: 'PRIVATE_MEDIA_UNAUTHORIZED',
        });
      }

      const viewerUid = req.user?.uid || (record.visibility === 'private' ? record.ownerId : 'anonymous');
      const playbackToken = createPlaybackToken(videoId, viewerUid, 3600, record);
      const fallbackUrl = await resolveFallbackMediaUrl(record, playbackToken);

      const hasRealHls =
        Boolean(record.hlsOutputPrefix) ||
        Boolean(record.hlsManifestUrl && record.hlsManifestUrl.startsWith('/api/stream/hls/'));

      const hlsUrl =
        hasRealHls && record.transcodingStatus === 'ready'
          ? `/api/stream/hls/${encodeURIComponent(videoId)}/master.m3u8?pt=${encodeURIComponent(playbackToken)}`
          : null;

      return res.json({
        videoId,
        visibility: record.visibility,
        transcodingStatus: record.transcodingStatus || 'ready',
        hlsUrl,
        fallbackUrl,
        expiresInSeconds: 3600,
      });
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      console.error('[Vio Playback] Error resolving playback session:', err?.message || err);
      return res.status(statusCode).json({ error: err?.message || 'Failed to authorize playback.' });
    }
  });

  // 6. Adaptive HLS Manifest & Segment Streaming from Google Cloud Storage
  app.get('/api/stream/hls/:videoId/*', optionalFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    if (!isValidResourceId(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId.', code: 'INVALID_VIDEO_ID' });
    }
    const rawWildcard = (req.params as Record<string, string>)[0] || 'master.m3u8';
    const cleanRelPath = path.posix.normalize(rawWildcard).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');

    if (!cleanRelPath || cleanRelPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid HLS asset path.' });
    }

    try {
      const record = await resolveMediaRecordForRequest(req, videoId);
      if (!record) {
        return res.status(404).json({ error: 'Video not found.' });
      }
      if (!isAuthorizedForMedia(req, record)) {
        return res.status(403).json({ error: 'Forbidden: Private HLS stream.' });
      }

      const hlsPrefix = (record.hlsOutputPrefix || `processed/${record.ownerId}/${videoId}/hls/`).replace(/\/?$/, '/');
      const gcsObjectPath = `${hlsPrefix}${cleanRelPath}`;

      if (cleanRelPath.endsWith('.m3u8')) {
        const bucket = getMediaBucket();
        const file = bucket.file(gcsObjectPath);
        const [exists] = await file.exists();
        if (!exists) {
          return res.status(404).json({ error: 'HLS manifest not ready yet.' });
        }

        const [contents] = await file.download();
        const viewerUid = req.user?.uid || (record.visibility === 'private' ? record.ownerId : 'anonymous');
        const pt =
          typeof req.query.pt === 'string' && req.query.pt
            ? req.query.pt
            : createPlaybackToken(videoId, viewerUid, 3600, record);

        const subDir = path.posix.dirname(cleanRelPath);
        const currentSubDir = subDir === '.' ? '' : subDir;
        const rewritten = rewriteHlsPlaylist(contents.toString('utf-8'), videoId, currentSubDir, pt);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'private, max-age=30');
        return res.send(rewritten);
      }

      const mimeType = cleanRelPath.endsWith('.ts')
        ? 'video/mp2t'
        : cleanRelPath.endsWith('.m4s') || cleanRelPath.endsWith('.mp4')
        ? 'video/iso.segment'
        : cleanRelPath.endsWith('.vtt')
        ? 'text/vtt'
        : undefined;

      await streamGcsObjectWithRange(req, res, gcsObjectPath, mimeType, record.visibility === 'private');
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      console.error('[Vio HLS] Streaming error:', err?.message || err);
      if (!res.headersSent) {
        res.status(statusCode).json({ error: err?.message || 'Failed to stream HLS asset.' });
      }
    }
  });

  // 7. Secure GCS Original Video Range Streaming (enforces private/unlisted/public authorization)
  app.get('/api/media/object/:videoId', optionalFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    if (!isValidResourceId(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId.', code: 'INVALID_VIDEO_ID' });
    }
    try {
      const record = await resolveMediaRecordForRequest(req, videoId);
      if (!record || !record.sourceObjectPath) {
        return res.status(404).json({ error: 'Media source object not found.' });
      }
      if (!isAuthorizedForMedia(req, record)) {
        return res.status(403).json({ error: 'Forbidden: Private video access denied.' });
      }
      await streamGcsObjectWithRange(req, res, record.sourceObjectPath, undefined, record.visibility === 'private');
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      console.error('[Vio Media] Range stream error:', err?.message || err);
      if (!res.headersSent) {
        res.status(statusCode).json({ error: err?.message || 'Failed to stream media object.' });
      }
    }
  });

  // 8. Public Image Asset Streaming (thumbnails & profileImages stored in GCS)
  app.get('/api/media/asset', async (req: Request, res: Response) => {
    const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
    const cleanPath = path.posix.normalize(rawPath).replace(/^\/+/, '');
    if (
      !cleanPath ||
      cleanPath.includes('..') ||
      (!cleanPath.startsWith('thumbnails/') && !cleanPath.startsWith('profileImages/'))
    ) {
      return res.status(400).json({ error: 'Invalid public image asset path.' });
    }
    try {
      await streamGcsObjectWithRange(req, res, cleanPath);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Failed to load asset.' });
      }
    }
  });

  // 9. Secure Server-Side View Counting (authenticated + creator self-view blocked + atomic Firestore dedup)
  app.post(
    '/api/videos/:videoId/view',
    interactionLimiter,
    verifyFirebaseAppCheck,
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
      }

      if (!checkPerUidRateLimit('view', uid, 20, 60_000)) {
        return res.status(429).json({
          error: 'Too many view requests from this account. Please slow down.',
          code: 'VIEW_RATE_LIMITED',
        });
      }

      const { videoId } = req.params;
      if (!isValidResourceId(videoId)) {
        return res.status(400).json({ error: 'Invalid videoId.', code: 'INVALID_VIDEO_ID' });
      }

      const rawToken = extractBearerToken(req);
      try {
        const record = await lookupMediaRecord(videoId, rawToken);
        if (!record) {
          return res.status(404).json({ error: 'Media record not found.', code: 'NOT_FOUND' });
        }
        if (!isAuthorizedForMedia(req, record)) {
          return res.status(403).json({
            error: 'Forbidden: Cannot record view for private media.',
            code: 'PRIVATE_MEDIA_UNAUTHORIZED',
          });
        }
        if (record.visibility === 'private') {
          return res.status(403).json({
            error: 'Views are not incremented on private media.',
            code: 'PRIVATE_VIEW_EXCLUDED',
          });
        }
        if (record.ownerId && record.ownerId === uid) {
          return res.status(403).json({
            error: 'Creators cannot increment views on their own media.',
            code: 'SELF_VIEW_FORBIDDEN',
          });
        }

        const isFreshInMemory = recordRecentViewIfFresh(uid, videoId);
        if (!isFreshInMemory) {
          return res.status(200).json({
            success: true,
            videoId,
            counted: false,
            deduplicated: true,
          });
        }

        try {
          const txResult = await adminDb.runTransaction(async (tx) => {
            const mediaRef = adminDb.collection(record.collectionName).doc(videoId);
            const viewLogRef = adminDb.collection('viewLogs').doc(`${uid}_${videoId}`);

            const [mediaSnap, viewLogSnap] = await Promise.all([tx.get(mediaRef), tx.get(viewLogRef)]);
            if (!mediaSnap.exists) {
              return { status: 'not_found' as const };
            }

            const mediaData = mediaSnap.data() || {};
            const liveOwnerId = mediaData.ownerId || mediaData.userId || '';
            const liveVisibility = mediaData.visibility || 'public';
            if (liveVisibility === 'private') {
              return { status: 'private_excluded' as const };
            }
            if (liveOwnerId && liveOwnerId === uid) {
              return { status: 'self_forbidden' as const };
            }

            const now = Date.now();
            const lastViewedAt = Number(viewLogSnap.data()?.lastViewedAt || 0);
            if (viewLogSnap.exists && lastViewedAt > 0 && now - lastViewedAt < VIEW_DEDUP_TTL_MS) {
              return { status: 'deduplicated' as const };
            }

            tx.set(viewLogRef, {
              uid,
              videoId,
              collectionName: record.collectionName,
              lastViewedAt: now,
            });
            tx.update(mediaRef, {
              views: FieldValue.increment(1),
            });
            return { status: 'counted' as const };
          });

          if (txResult.status === 'not_found') {
            return res.status(404).json({ error: 'Media record not found.', code: 'NOT_FOUND' });
          }
          if (txResult.status === 'private_excluded') {
            return res.status(403).json({
              error: 'Views are not incremented on private media.',
              code: 'PRIVATE_VIEW_EXCLUDED',
            });
          }
          if (txResult.status === 'self_forbidden') {
            return res.status(403).json({
              error: 'Creators cannot increment views on their own media.',
              code: 'SELF_VIEW_FORBIDDEN',
            });
          }
          if (txResult.status === 'deduplicated') {
            return res.status(200).json({
              success: true,
              videoId,
              counted: false,
              deduplicated: true,
              mode: 'admin-sdk',
            });
          }

          return res.status(200).json({
            success: true,
            videoId,
            counted: true,
            deduplicated: false,
            mode: 'admin-sdk',
          });
        } catch (dbErr: any) {
          if (!isPermissionDeniedErr(dbErr)) {
            throw dbErr;
          }

          return res.status(200).json({
            success: false,
            videoId,
            counted: false,
            deduplicated: false,
            code: 'FIRESTORE_ADMIN_PERMISSION_DENIED',
            diagnostic: `Firestore Admin SDK lacks write access on "${serverConfig.firebaseProjectId}".`,
          });
        }
      } catch (err: any) {
        const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
        return res.status(statusCode).json({
          error: err?.message || 'Failed to record media view.',
          code: err?.code || 'VIEW_COUNT_ERROR',
        });
      }
    }
  );

  // 10. Secure Server-Side Notification Creation (strict ID/URL validation + relationship verification)
  app.post(
    '/api/notifications',
    interactionLimiter,
    verifyFirebaseAppCheck,
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const senderUid = req.user?.uid;
      if (!senderUid) {
        return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
      }

      if (!checkPerUidRateLimit('notification', senderUid, 15, 60_000)) {
        return res.status(429).json({
          error: 'Too many notification requests from this account. Please slow down.',
          code: 'NOTIFICATION_RATE_LIMITED',
        });
      }

      const {
        userId,
        type,
        title,
        message,
        avatar = '',
        thumbnailUrl = '',
        videoId = '',
        channelId = '',
      } = req.body || {};

      const recipientUid = typeof userId === 'string' ? userId.trim() : '';
      if (!isValidResourceId(recipientUid)) {
        return res.status(400).json({ error: 'Invalid recipient userId.', code: 'INVALID_RECIPIENT' });
      }

      const allowedTypes = new Set(['upload', 'reply', 'milestone', 'subscription']);
      if (typeof type !== 'string' || !allowedTypes.has(type)) {
        return res.status(400).json({ error: 'Invalid notification type.', code: 'INVALID_TYPE' });
      }

      const trimmedVideoId = typeof videoId === 'string' ? videoId.trim() : '';
      const trimmedChannelId = typeof channelId === 'string' ? channelId.trim() : '';
      if (trimmedVideoId && !isValidResourceId(trimmedVideoId)) {
        return res.status(400).json({ error: 'Invalid videoId.', code: 'INVALID_VIDEO_ID' });
      }
      if (trimmedChannelId && !isValidResourceId(trimmedChannelId)) {
        return res.status(400).json({ error: 'Invalid channelId.', code: 'INVALID_CHANNEL_ID' });
      }

      if (!isSafeAssetOrHttpsUrl(avatar) || !isSafeAssetOrHttpsUrl(thumbnailUrl)) {
        return res.status(400).json({
          error: 'Notification image URLs must be relative /api/ paths or HTTPS URLs (max 500 chars).',
          code: 'INVALID_MEDIA_URL',
        });
      }

      if (type === 'milestone' && recipientUid !== senderUid) {
        return res.status(403).json({
          error: 'Forbidden: Milestone notifications can only target the authenticated creator.',
          code: 'NOTIFICATION_FORBIDDEN',
        });
      }
      if (type === 'subscription') {
        if (recipientUid === senderUid) {
          return res.status(403).json({
            error: 'Forbidden: Cannot send subscription notification to yourself.',
            code: 'NOTIFICATION_FORBIDDEN',
          });
        }
        if (!trimmedChannelId) {
          return res.status(400).json({
            error: 'channelId is required for subscription notifications.',
            code: 'INVALID_CHANNEL_ID',
          });
        }
      }
      if ((type === 'upload' || type === 'reply') && !trimmedVideoId) {
        return res.status(400).json({
          error: `videoId is required for ${type} notifications.`,
          code: 'INVALID_VIDEO_ID',
        });
      }

      if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 140) {
        return res.status(400).json({ error: 'Notification title must be 1–140 characters.', code: 'INVALID_TITLE' });
      }
      if (typeof message !== 'string' || message.trim().length === 0 || message.trim().length > 500) {
        return res.status(400).json({ error: 'Notification message must be 1–500 characters.', code: 'INVALID_MESSAGE' });
      }

      const dedupKey = `${senderUid}:${recipientUid}:${type}:${trimmedVideoId}:${trimmedChannelId}`;
      if (!recordNotificationCooldownIfFresh(dedupKey, 60_000)) {
        return res.status(429).json({
          error: 'Duplicate notification suppressed. Please wait before sending again.',
          code: 'NOTIFICATION_DUPLICATE',
        });
      }

      const notifId = `notif-${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const now = Date.now();
      const docData = {
        id: notifId,
        userId: recipientUid,
        senderId: senderUid,
        fromUserId: senderUid,
        type,
        title: title.trim(),
        message: message.trim(),
        avatar: typeof avatar === 'string' ? avatar.trim() : '',
        thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl.trim() : '',
        videoId: trimmedVideoId,
        channelId: trimmedChannelId,
        read: false,
        timestamp: 'Just now',
        createdAt: now,
      };

      try {
        // Verify authorization & real Firestore relationships before bypassing firestore.rules via adminDb
        if (type === 'subscription') {
          const [channelSnap, subSnap, followSnap] = await Promise.all([
            adminDb.collection('channels').doc(trimmedChannelId).get(),
            adminDb.collection('subscriptions').doc(`${senderUid}_${trimmedChannelId}`).get(),
            adminDb.collection('followers').doc(`${senderUid}_${recipientUid}`).get(),
          ]);
          const channelOwnerId = channelSnap.data()?.ownerId;
          if (!channelSnap.exists || channelOwnerId !== recipientUid) {
            return res.status(403).json({
              error: 'Forbidden: Recipient does not own the specified channel.',
              code: 'NOTIFICATION_FORBIDDEN',
            });
          }
          if (!subSnap.exists && !followSnap.exists) {
            return res.status(403).json({
              error: 'Forbidden: Active subscription or follow relationship required.',
              code: 'NOTIFICATION_FORBIDDEN',
            });
          }
        } else if (type === 'upload') {
          const [videoSnap, reelSnap] = await Promise.all([
            adminDb.collection('videos').doc(trimmedVideoId).get(),
            adminDb.collection('reels').doc(trimmedVideoId).get(),
          ]);
          const mediaSnap = videoSnap.exists ? videoSnap : reelSnap;
          if (!mediaSnap.exists) {
            return res.status(404).json({ error: 'Referenced media not found.', code: 'NOT_FOUND' });
          }
          const mediaData = mediaSnap.data() || {};
          const mediaOwnerId = mediaData.ownerId || mediaData.userId;
          if (!mediaOwnerId || mediaOwnerId !== senderUid) {
            return res.status(403).json({
              error: 'Forbidden: Only the media owner can send upload notifications.',
              code: 'NOTIFICATION_FORBIDDEN',
            });
          }
          if (mediaData.visibility === 'private') {
            return res.status(403).json({
              error: 'Forbidden: Cannot broadcast notifications for private media.',
              code: 'NOTIFICATION_FORBIDDEN',
            });
          }
          if (recipientUid !== senderUid) {
            let recipientSubscribed = false;
            if (trimmedChannelId) {
              const [channelSnap, subSnap] = await Promise.all([
                adminDb.collection('channels').doc(trimmedChannelId).get(),
                adminDb.collection('subscriptions').doc(`${recipientUid}_${trimmedChannelId}`).get(),
              ]);
              if (channelSnap.exists && channelSnap.data()?.ownerId === senderUid && subSnap.exists) {
                recipientSubscribed = true;
              }
            }
            if (!recipientSubscribed) {
              const followSnap = await adminDb.collection('followers').doc(`${recipientUid}_${senderUid}`).get();
              recipientSubscribed = followSnap.exists;
            }
            if (!recipientSubscribed) {
              return res.status(403).json({
                error: 'Forbidden: Recipient is not subscribed to or following this creator.',
                code: 'NOTIFICATION_FORBIDDEN',
              });
            }
          }
        } else if (type === 'reply') {
          const [videoSnap, reelSnap, senderCommentsSnap] = await Promise.all([
            adminDb.collection('videos').doc(trimmedVideoId).get(),
            adminDb.collection('reels').doc(trimmedVideoId).get(),
            adminDb.collection('comments').where('userId', '==', senderUid).limit(50).get(),
          ]);
          const mediaSnap = videoSnap.exists ? videoSnap : reelSnap;
          if (!mediaSnap.exists) {
            return res.status(404).json({ error: 'Referenced media not found.', code: 'NOT_FOUND' });
          }
          const mediaData = mediaSnap.data() || {};
          const mediaOwnerId = mediaData.ownerId || mediaData.userId;
          if (mediaData.visibility === 'private' && (senderUid !== mediaOwnerId || recipientUid !== mediaOwnerId)) {
            return res.status(403).json({
              error: 'Forbidden: Cannot send reply notifications on private media.',
              code: 'NOTIFICATION_FORBIDDEN',
            });
          }
          const hasCommentOnTarget = senderCommentsSnap.docs.some(
            (d) => d.data()?.targetId === trimmedVideoId
          );
          if (!hasCommentOnTarget) {
            return res.status(403).json({
              error: 'Forbidden: Sender has no comment on the referenced media.',
              code: 'NOTIFICATION_FORBIDDEN',
            });
          }
          if (recipientUid !== mediaOwnerId && recipientUid !== senderUid) {
            const recipientSnap = await adminDb.collection('users').doc(recipientUid).get();
            if (!recipientSnap.exists) {
              return res.status(404).json({ error: 'Recipient user not found.', code: 'NOT_FOUND' });
            }
          }
        }

        await adminDb.collection('notifications').doc(notifId).set(docData);
        return res.status(201).json({
          success: true,
          id: notifId,
          mode: 'admin-sdk',
          notification: docData,
        });
      } catch (dbErr: any) {
        if (!isPermissionDeniedErr(dbErr)) {
          return res.status(500).json({
            error: dbErr?.message || 'Failed to create notification.',
            code: 'NOTIFICATION_CREATE_ERROR',
          });
        }

        // Cross-project fallback: create via Firestore REST using authenticated sender's Bearer token (enforced by firestore.rules)
        const rawToken = extractBearerToken(req);
        if (rawToken && serverConfig.firebaseProjectId) {
          const createUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(serverConfig.firebaseProjectId)}/databases/${encodeURIComponent(serverConfig.firestoreDatabaseId || '(default)')}/documents/notifications?documentId=${encodeURIComponent(notifId)}${serverConfig.firebaseApiKey ? `&key=${encodeURIComponent(serverConfig.firebaseApiKey)}` : ''}`;
          const restRes = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${rawToken}`,
            },
            body: JSON.stringify({
              fields: {
                id: { stringValue: docData.id },
                userId: { stringValue: docData.userId },
                senderId: { stringValue: docData.senderId },
                fromUserId: { stringValue: docData.fromUserId },
                type: { stringValue: docData.type },
                title: { stringValue: docData.title },
                message: { stringValue: docData.message },
                avatar: { stringValue: docData.avatar },
                thumbnailUrl: { stringValue: docData.thumbnailUrl },
                videoId: { stringValue: docData.videoId },
                channelId: { stringValue: docData.channelId },
                read: { booleanValue: false },
                timestamp: { stringValue: docData.timestamp },
                createdAt: { integerValue: String(docData.createdAt) },
              },
            }),
          });

          if (restRes.ok) {
            return res.status(201).json({
              success: true,
              id: notifId,
              mode: 'rest-user-token',
              notification: docData,
            });
          }
          const restErr = await restRes.text().catch(() => '');
          return res.status(restRes.status).json({
            error: restErr || 'Firestore notification write denied.',
            code: 'FIRESTORE_NOTIFICATION_DENIED',
          });
        }

        return res.status(503).json({
          error: `Firestore Admin SDK permission denied on project "${serverConfig.firebaseProjectId}".`,
          code: 'FIRESTORE_ADMIN_PERMISSION_DENIED',
        });
      }
    }
  );

  // Vite Integration (Dev middleware / Prod static files)
  if (serverConfig.nodeEnv === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log(
      `[Vio Streaming] Production Media Server listening on http://0.0.0.0:${serverConfig.port} (project=${serverConfig.gcpProjectId}, bucket=${serverConfig.gcsBucketName}, transcoder=${serverConfig.transcoderLocation})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start Vio streaming server:', err);
  process.exit(1);
});
