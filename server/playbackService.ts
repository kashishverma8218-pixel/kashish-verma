import crypto from 'crypto';
import { Request, Response } from 'express';
import { serverConfig } from './config';
import { adminDb, AuthenticatedRequest } from './firebaseAdmin';
import { getMediaBucket, tryCreateSignedReadUrl } from './storageService';

interface PlaybackTokenPayload {
  vid: string;
  uid: string;
  exp: number;
}

export function createPlaybackToken(videoId: string, uid: string, ttlSeconds: number = 3600): string {
  const payload: PlaybackTokenPayload = {
    vid: videoId,
    uid: uid || 'anonymous',
    exp: Date.now() + ttlSeconds * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', serverConfig.playbackTokenSecret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyPlaybackToken(token: string, expectedVideoId: string): PlaybackTokenPayload | null {
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
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as PlaybackTokenPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (parsed.vid !== expectedVideoId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface MediaRecord {
  id: string;
  collectionName: 'videos' | 'reels';
  ownerId: string;
  visibility: 'public' | 'unlisted' | 'private';
  sourceObjectPath?: string;
  hlsOutputPrefix?: string;
  hlsManifestUrl?: string;
  transcodingStatus?: 'processing' | 'ready' | 'failed';
  url?: string;
  poster?: string;
}

export async function lookupMediaRecord(videoId: string): Promise<MediaRecord | null> {
  const videoSnap = await adminDb.collection('videos').doc(videoId).get();
  if (videoSnap.exists) {
    const d = videoSnap.data() || {};
    return {
      id: videoId,
      collectionName: 'videos',
      ownerId: d.ownerId || d.userId || '',
      visibility: d.visibility || 'public',
      sourceObjectPath: d.sourceObjectPath,
      hlsOutputPrefix: d.hlsOutputPrefix,
      hlsManifestUrl: d.hlsManifestUrl,
      transcodingStatus: d.transcodingStatus,
      url: d.url,
      poster: d.poster,
    };
  }

  const reelSnap = await adminDb.collection('reels').doc(videoId).get();
  if (reelSnap.exists) {
    const d = reelSnap.data() || {};
    return {
      id: videoId,
      collectionName: 'reels',
      ownerId: d.ownerId || d.userId || '',
      visibility: d.visibility || 'public',
      sourceObjectPath: d.sourceObjectPath,
      hlsOutputPrefix: d.hlsOutputPrefix,
      hlsManifestUrl: d.hlsManifestUrl,
      transcodingStatus: d.transcodingStatus,
      url: d.videoUrl || d.url,
      poster: d.poster,
    };
  }

  return null;
}

/**
 * Checks whether the current request is authorized to stream the given media item.
 * Enforces owner/admin identity when visibility === 'private', or validates a signed playback token.
 */
export function isAuthorizedForMedia(
  req: AuthenticatedRequest,
  record: MediaRecord
): boolean {
  if (record.visibility !== 'private') {
    return true;
  }

  // Check Firebase ID Token user
  if (req.user) {
    if (req.user.uid === record.ownerId || req.user.admin === true) {
      return true;
    }
  }

  // Check scoped playback token query param (?pt=...)
  const pt = typeof req.query.pt === 'string' ? req.query.pt : '';
  if (pt) {
    const decoded = verifyPlaybackToken(pt, record.id);
    if (decoded && decoded.uid === record.ownerId) {
      return true;
    }
  }

  return false;
}

/**
 * Rewrites relative URIs inside an HLS .m3u8 playlist so variant playlists
 * and .ts/.m4s segments carry the signed playback token (?pt=...) or V4 signed URL.
 */
export function rewriteHlsPlaylist(
  content: string,
  videoId: string,
  currentSubDir: string,
  playbackToken: string
): string {
  const lines = content.split(/\r?\n/);
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Rewrite URI="..." inside tags such as #EXT-X-MAP:URI="..."
    if (trimmed.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uriValue: string) => {
        if (/^https?:\/\//i.test(uriValue) || uriValue.startsWith('/api/')) {
          return `URI="${uriValue}"`;
        }
        const joined = currentSubDir ? `${currentSubDir}/${uriValue}` : uriValue;
        const cleanPath = joined.replace(/^\/+/, '');
        return `URI="/api/stream/hls/${encodeURIComponent(videoId)}/${cleanPath}?pt=${encodeURIComponent(playbackToken)}"`;
      });
    }

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/api/')) {
      return trimmed;
    }

    const joined = currentSubDir ? `${currentSubDir}/${trimmed}` : trimmed;
    const cleanPath = joined.replace(/^\/+/, '');
    return `/api/stream/hls/${encodeURIComponent(videoId)}/${cleanPath}?pt=${encodeURIComponent(playbackToken)}`;
  });

  return rewritten.join('\n');
}

/**
 * Streams a Google Cloud Storage object to the HTTP response with full
 * HTTP 206 Partial Content byte-range support for smooth scrubbing and playback.
 */
export async function streamGcsObjectWithRange(
  req: Request,
  res: Response,
  objectPath: string,
  contentTypeOverride?: string
): Promise<void> {
  const bucket = getMediaBucket();
  const file = bucket.file(objectPath);

  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ error: 'Media object not found in Google Cloud Storage.' });
    return;
  }

  const [metadata] = await file.getMetadata();
  const fileSize = parseInt(String(metadata.size || '0'), 10);
  const contentType = contentTypeOverride || metadata.contentType || 'application/octet-stream';

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');

  const rangeHeader = req.headers.range;
  if (rangeHeader && fileSize > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', String(end - start + 1));

    const stream = file.createReadStream({ start, end });
    stream.on('error', (err) => {
      console.error('[Vio Media] GCS range stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream read failure.' });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
    return;
  }

  if (fileSize > 0) {
    res.setHeader('Content-Length', String(fileSize));
  }
  const stream = file.createReadStream();
  stream.on('error', (err) => {
    console.error('[Vio Media] GCS stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream read failure.' });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

export async function resolveFallbackMediaUrl(record: MediaRecord, playbackToken: string): Promise<string | null> {
  if (record.sourceObjectPath) {
    const signed = await tryCreateSignedReadUrl(record.sourceObjectPath, 3600);
    if (signed) return signed;
    return `/api/media/object/${encodeURIComponent(record.id)}?pt=${encodeURIComponent(playbackToken)}`;
  }
  return record.url || null;
}
