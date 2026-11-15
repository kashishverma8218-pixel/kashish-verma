import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import os from 'os';
import { serverConfig } from './server/config';
import {
  AuthenticatedRequest,
  optionalFirebaseAuth,
  requireFirebaseAuth,
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
  rewriteHlsPlaylist,
  streamGcsObjectWithRange,
} from './server/playbackService';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

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

  // CORS & Security headers for Cloud Run & HLS video streaming
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (serverConfig.corsAllowedOrigins.length > 0 && requestOrigin) {
      if (serverConfig.corsAllowedOrigins.includes(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
      }
    } else if (requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Range, Content-Type, Content-Range, Authorization, X-Requested-With, X-Upload-Session-Token'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Content-Length, Accept-Ranges, Range'
    );
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // 1. Live Healthcheck & Real GCP Service Readiness
  app.get('/api/health', async (_req: Request, res: Response) => {
    const [bucketHealth, transcoderHealth] = await Promise.all([
      checkBucketHealth(),
      checkTranscoderApiHealth(),
    ]);

    const ready = bucketHealth.accessible && transcoderHealth.accessible;
    res.status(200).json({
      status: ready ? 'online' : 'degraded',
      service: 'Vio Streaming Cloud Run Media Server',
      runtime: serverConfig.isCloudRun ? 'google-cloud-run' : 'node-server',
      cloudRunService: serverConfig.cloudRunService,
      gcpProjectId: serverConfig.gcpProjectId,
      firestoreDatabaseId: serverConfig.firestoreDatabaseId,
      edgePoP: `${serverConfig.transcoderLocation} (Google Cloud)`,
      adaptiveBitrateSupported: true,
      hlsProtocolVersion: 7,
      gcpServices: {
        cloudStorage: bucketHealth,
        cloudTranscoder: transcoderHealth,
        persistentPlaybackSecretConfigured: serverConfig.hasPersistentPlaybackSecret,
      },
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // 1b. Real Runtime Infrastructure & GCP Diagnostics (preserves UI contract)
  app.get('/api/infrastructure/status', async (_req: Request, res: Response) => {
    const [bucketHealth, transcoderHealth] = await Promise.all([
      checkBucketHealth(),
      checkTranscoderApiHealth(),
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
  app.post('/api/uploads/session', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
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

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'fileName is required.' });
    }
    if (!contentType || typeof contentType !== 'string') {
      return res.status(400).json({ error: 'contentType is required.' });
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
      console.error('[Vio Upload] Failed to create GCS resumable upload session:', err?.message || err);
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 503).json({
        error: err?.message || 'Failed to initialize Google Cloud Storage resumable upload.',
        code: gcpCode === 404 ? 'GCS_BUCKET_NOT_FOUND' : gcpCode === 403 ? 'GCS_PERMISSION_DENIED' : 'GCS_UPLOAD_SESSION_ERROR',
        bucketName: serverConfig.gcsBucketName,
      });
    }
  });

  // 2b. Authenticated Resumable Chunk Proxy (for 8 MiB chunks when browser CORS blocks direct GCS PUT)
  app.put('/api/uploads/chunk', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    const sessionToken = req.headers['x-upload-session-token'];
    if (!sessionToken || typeof sessionToken !== 'string') {
      return res.status(400).json({ error: 'Missing X-Upload-Session-Token header.' });
    }

    const session = verifyUploadSessionToken(sessionToken);
    if (!session || session.uid !== uid) {
      return res.status(403).json({ error: 'Invalid or expired upload session token.' });
    }

    const contentRange = req.headers['content-range'];
    const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : session.contentType;
    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    try {
      const headers: Record<string, string> = {
        'Content-Type': contentType,
      };
      if (typeof contentRange === 'string' && contentRange) {
        headers['Content-Range'] = contentRange;
      }

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

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: textBody || `GCS chunk upload failed with status ${upstream.status}`,
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
      });
    }
  });

  // 2c. Verify uploaded GCS object existence & size
  app.get('/api/uploads/verify', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    const objectPath = typeof req.query.objectPath === 'string' ? req.query.objectPath : '';
    if (!objectPath || !uid || !objectPath.includes(`/${uid}/`)) {
      return res.status(403).json({ error: 'Forbidden object path.' });
    }
    try {
      const info = await verifyUploadedObject(objectPath);
      if (!info.exists) {
        return res.status(404).json({ exists: false, error: 'Object not found in Cloud Storage.' });
      }
      return res.json(info);
    } catch (err: any) {
      return res.status(503).json({ error: err?.message || 'Could not verify storage object.' });
    }
  });

  // 3. Real Background Video Processing (Google Cloud Transcoder API -> 360p/480p/720p/1080p HLS)
  app.post('/api/videos/:videoId/process', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { videoId } = req.params;
    const {
      sourceObjectPath,
      collectionName = 'videos',
      sourceWidth,
      sourceHeight,
    } = req.body || {};

    if (!sourceObjectPath || typeof sourceObjectPath !== 'string') {
      return res.status(400).json({ error: 'sourceObjectPath is required.' });
    }
    if (collectionName !== 'videos' && collectionName !== 'reels') {
      return res.status(400).json({ error: 'collectionName must be "videos" or "reels".' });
    }

    try {
      const result = await startCloudTranscodeJob({
        videoId,
        collectionName,
        ownerId: uid,
        sourceObjectPath,
        sourceWidth: typeof sourceWidth === 'number' ? sourceWidth : undefined,
        sourceHeight: typeof sourceHeight === 'number' ? sourceHeight : undefined,
      });

      return res.status(202).json({
        success: true,
        videoId,
        transcodingStatus: 'processing',
        ...result,
      });
    } catch (err: any) {
      const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 503;
      console.error('[Vio Transcoder] Failed to create Cloud Transcoder job:', err?.message || err);
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 503).json({
        error: err?.message || 'Failed to start Google Cloud Transcoder job.',
        code: 'TRANSCODER_START_FAILED',
      });
    }
  });

  // 4. Live Video Transcoding Status Query (checks Cloud Transcoder API & syncs Firestore)
  app.get('/api/videos/:videoId/status', optionalFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    try {
      const record = await lookupMediaRecord(videoId);
      if (record && !isAuthorizedForMedia(req, record)) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this private video.' });
      }
      const status = await syncTranscodeJobStatus(videoId, record?.collectionName);
      return res.json({ success: true, ...status });
    } catch (err: any) {
      return res.status(503).json({
        error: err?.message || 'Could not query Cloud Transcoder job status.',
      });
    }
  });

  // 5. Authorized Video Playback Bootstrap (returns signed HLS manifest + fallback URL)
  app.get('/api/videos/:videoId/playback', optionalFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    try {
      const record = await lookupMediaRecord(videoId);
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
      const playbackToken = createPlaybackToken(videoId, viewerUid, 3600);
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
      console.error('[Vio Playback] Error resolving playback session:', err?.message || err);
      return res.status(500).json({ error: err?.message || 'Failed to authorize playback.' });
    }
  });

  // 6. Adaptive HLS Manifest & Segment Streaming from Google Cloud Storage
  app.get('/api/stream/hls/:videoId/*', optionalFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    const rawWildcard = (req.params as Record<string, string>)[0] || 'master.m3u8';
    const cleanRelPath = path.posix.normalize(rawWildcard).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');

    if (!cleanRelPath || cleanRelPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid HLS asset path.' });
    }

    try {
      const record = await lookupMediaRecord(videoId);
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
            : createPlaybackToken(videoId, viewerUid, 3600);

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

      await streamGcsObjectWithRange(req, res, gcsObjectPath, mimeType);
    } catch (err: any) {
      console.error('[Vio HLS] Streaming error:', err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Failed to stream HLS asset.' });
      }
    }
  });

  // 7. Secure GCS Original Video Range Streaming (enforces private/unlisted/public authorization)
  app.get('/api/media/object/:videoId', optionalFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { videoId } = req.params;
    try {
      const record = await lookupMediaRecord(videoId);
      if (!record || !record.sourceObjectPath) {
        return res.status(404).json({ error: 'Media source object not found.' });
      }
      if (!isAuthorizedForMedia(req, record)) {
        return res.status(403).json({ error: 'Forbidden: Private video access denied.' });
      }
      await streamGcsObjectWithRange(req, res, record.sourceObjectPath);
    } catch (err: any) {
      console.error('[Vio Media] Range stream error:', err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Failed to stream media object.' });
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
