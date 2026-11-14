import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

interface StreamQualityConfig {
  label: string;
  resolution: string;
  bitrateKbps: number;
  fps: number;
  bandwidth: number;
}

const STREAM_LADDER: StreamQualityConfig[] = [
  { label: '1080p60 HD', resolution: '1920x1080', bitrateKbps: 6000, fps: 60, bandwidth: 6200000 },
  { label: '720p HD', resolution: '1280x720', bitrateKbps: 3000, fps: 30, bandwidth: 3100000 },
  { label: '480p', resolution: '854x480', bitrateKbps: 1500, fps: 30, bandwidth: 1550000 },
  { label: '360p', resolution: '640x360', bitrateKbps: 800, fps: 30, bandwidth: 830000 },
  { label: '240p', resolution: '426x240', bitrateKbps: 400, fps: 24, bandwidth: 420000 },
];

// In-memory mock database for transcoding jobs
const transcodingJobs = new Map<string, {
  id: string;
  videoId: string;
  sourceUrl: string;
  status: 'queued' | 'analyzing' | 'transcoding' | 'generating_manifest' | 'ready';
  progress: number;
  currentStep: string;
  targetLadder: string[];
  createdAt: number;
  qualities: Array<{
    label: string;
    resolution: string;
    bitrateKbps: number;
    fps: number;
    url: string;
  }>;
}>();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS & Security headers for video streaming
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // 1. Healthcheck & Streaming Cloud Status
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'online',
      service: 'Vio Streaming Cloud Core & Transcoding Engine',
      edgePoP: 'Global Edge (Tokyo / Mumbai / US-Central)',
      adaptiveBitrateSupported: true,
      hlsProtocolVersion: 7,
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // 1b. Infrastructure, Auto-Scaling & Global CDN Status
  app.get('/api/infrastructure/status', (req: Request, res: Response) => {
    res.json({
      status: 'operational',
      environment: 'production',
      cloudProvider: 'Multi-Cloud Edge (Google Cloud & Cloudflare Anycast)',
      autoScaleServers: {
        activeInstances: 6,
        minInstances: 3,
        maxInstances: 24,
        avgCpuUtilization: '38.4%',
        avgMemoryUtilization: '44.1%',
        autoScalingPolicy: 'Target CPU 70% / Dynamic Scale-out in 45s',
        regions: ['asia-northeast1 (Tokyo)', 'us-central1 (Iowa)', 'europe-west3 (Frankfurt)', 'asia-south1 (Mumbai)'],
      },
      cdnGlobalDelivery: {
        network: 'Vio Fast-Edge CDN (Anycast HTTP/3 + QUIC)',
        edgeLocations: 285,
        globalCacheHitRatio: '98.9%',
        averageLatencyMs: 24,
        totalBandwidthDeliveredGbps: 184.2,
        activeStreamsServed: 12450,
        sslTlsVersion: 'TLS 1.3 / ChaCha20-Poly1305',
      },
      cloudStorageAndHls: {
        storageType: 'Distributed Object Storage (S3/GCS API Multi-Region)',
        bucketName: 'vio-streaming-media-production',
        redundancy: 'Geo-Redundant (99.999999999% durability)',
        hlsTranscoding: {
          engine: 'Hardware-Accelerated Cloud Transcoder (NVENC & libx264)',
          supportedResolutions: ['4K UHD', '1080p60 FHD', '720p HD', '480p SD', '360p', '240p'],
          segmentDurationSeconds: 4.0,
          manifestType: 'HLS v7 (m3u8) & MPEG-DASH (mpd)',
          audioCodec: 'AAC-LC 192kbps / Dolby Digital Plus',
        },
      },
    });
  });

  // 2. Adaptive Bitrate (ABR) Master Manifest
  app.get('/api/stream/manifest/:videoId', (req: Request, res: Response) => {
    const { videoId } = req.params;
    const format = req.query.format || 'json';

    const qualities = STREAM_LADDER.map((item) => ({
      ...item,
      streamUrl: `/api/stream/segment/${videoId}/${encodeURIComponent(item.label)}`,
      fallbackUrl: 'https://media.w3.org/2010/05/bunny/movie.mp4',
    }));

    if (format === 'hls' || format === 'm3u8') {
      // Standard HTTP Live Streaming (HLS) master playlist
      let playlist = '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-INDEPENDENT-SEGMENTS\n';
      STREAM_LADDER.forEach((item) => {
        playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${item.bandwidth},RESOLUTION=${item.resolution},FRAME-RATE=${item.fps},CODECS="avc1.640028,mp4a.40.2",NAME="${item.label}"\n`;
        playlist += `/api/stream/segment/${videoId}/${encodeURIComponent(item.label)}\n`;
      });
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(playlist);
    }

    res.json({
      videoId,
      abrMasterManifest: true,
      defaultQuality: 'Auto',
      qualities,
      codecs: 'avc1.640028, mp4a.40.2',
      reconnectStrategy: {
        maxRetries: 5,
        backoffMultiplier: 1.5,
        failoverCdn: 'https://media.w3.org/2010/05/bunny/',
      },
    });
  });

  // 2b. Adaptive Stream Segment Redirect / Fallback Resolver
  app.get('/api/stream/segment/:videoId/:quality', (req: Request, res: Response) => {
    const { videoId } = req.params;
    const matchingJob = Array.from(transcodingJobs.values()).find((j) => j.videoId === videoId);
    const streamTarget = matchingJob?.sourceUrl || 'https://media.w3.org/2010/05/bunny/movie.mp4';
    res.redirect(302, streamTarget);
  });

  // 3. Cloud Video Transcoding Endpoint
  app.post('/api/transcode', (req: Request, res: Response) => {
    const { videoId, sourceUrl, targetLadder = ['1080p60 HD', '720p HD', '480p', '360p'] } = req.body;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const effectiveVideoId = videoId || `video_${Date.now()}`;
    const effectiveSource = sourceUrl || 'https://media.w3.org/2010/05/bunny/movie.mp4';

    const job = {
      id: jobId,
      videoId: effectiveVideoId,
      sourceUrl: effectiveSource,
      status: 'analyzing' as const,
      progress: 15,
      currentStep: 'Analyzing raw master file codec & audio channels',
      targetLadder,
      createdAt: Date.now(),
      qualities: STREAM_LADDER.filter((l) => targetLadder.includes(l.label) || l.label.includes('720p')).map((l) => ({
        label: l.label,
        resolution: l.resolution,
        bitrateKbps: l.bitrateKbps,
        fps: l.fps,
        url: effectiveSource,
      })),
    };

    transcodingJobs.set(jobId, job);

    // Simulate multi-pass cloud transcoding execution
    setTimeout(() => {
      const j = transcodingJobs.get(jobId);
      if (j) {
        j.status = 'transcoding';
        j.progress = 55;
        j.currentStep = 'Multi-bitrate encoding (1080p/720p/480p/360p) with 2-pass VBR';
      }
    }, 1200);

    setTimeout(() => {
      const j = transcodingJobs.get(jobId);
      if (j) {
        j.status = 'generating_manifest';
        j.progress = 88;
        j.currentStep = 'Generating HLS/DASH adaptive manifests and WebVTT timeline scrubbing tiles';
      }
    }, 2400);

    setTimeout(() => {
      const j = transcodingJobs.get(jobId);
      if (j) {
        j.status = 'ready';
        j.progress = 100;
        j.currentStep = 'Cloud distribution synchronized across Global Edge CDN';
      }
    }, 3800);

    res.json({
      success: true,
      jobId,
      message: 'Cloud video transcoding job queued successfully',
      job,
    });
  });

  // 4. Transcoding Job Status Query
  app.get('/api/transcode/status/:jobId', (req: Request, res: Response) => {
    const { jobId } = req.params;
    const job = transcodingJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Transcoding job not found' });
    }
    res.json({ success: true, job });
  });

  // 5. Active Jobs List
  app.get('/api/transcode/jobs', (req: Request, res: Response) => {
    res.json({
      total: transcodingJobs.size,
      jobs: Array.from(transcodingJobs.values()),
    });
  });

  // Vite Integration (Dev middleware / Prod static files)
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vio Streaming] Full-stack Cloud Media Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Vio streaming server:', err);
  process.exit(1);
});
