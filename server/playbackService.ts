import crypto from 'crypto';
import { Request, Response } from 'express';
import { serverConfig } from './config';
import { adminDb, AuthenticatedRequest, extractBearerToken } from './firebaseAdmin';
import { getMediaBucket } from './storageService';

interface PlaybackTokenPayload {
  vid: string;
  uid: string;
  exp: number;
  col?: 'videos' | 'reels';
  oid?: string;
  vis?: 'public' | 'unlisted' | 'private';
  obj?: string;
  hls?: string;
}

export function createPlaybackToken(
  videoId: string,
  uid: string,
  ttlSeconds: number = 3600,
  record?: Partial<MediaRecord>
): string {
  const payload: PlaybackTokenPayload = {
    vid: videoId,
    uid: uid || 'anonymous',
    exp: Date.now() + ttlSeconds * 1000,
    ...(record?.collectionName ? { col: record.collectionName } : {}),
    ...(record?.ownerId ? { oid: record.ownerId } : {}),
    ...(record?.visibility ? { vis: record.visibility } : {}),
    ...(record?.sourceObjectPath ? { obj: record.sourceObjectPath } : {}),
    ...(record?.hlsOutputPrefix ? { hls: record.hlsOutputPrefix } : {}),
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

function decodeFirestoreRestFields(fields: Record<string, any> | undefined): Record<string, any> {
  if (!fields || typeof fields !== 'object') return {};
  const decodeVal = (v: any): any => {
    if (!v || typeof v !== 'object') return undefined;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return Boolean(v.booleanValue);
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) {
      return Array.isArray(v.arrayValue?.values) ? v.arrayValue.values.map(decodeVal) : [];
    }
    if ('mapValue' in v) {
      return decodeFirestoreRestFields(v.mapValue?.fields);
    }
    return undefined;
  };
  const out: Record<string, any> = {};
  for (const [k, raw] of Object.entries(fields)) {
    out[k] = decodeVal(raw);
  }
  return out;
}

export async function fetchFirestoreDocViaRest(
  collectionName: 'videos' | 'reels',
  videoId: string,
  idToken?: string | null
): Promise<Record<string, any> | null | 'FORBIDDEN'> {
  if (!serverConfig.firebaseProjectId) return null;
  const dbId = encodeURIComponent(serverConfig.firestoreDatabaseId || '(default)');
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(serverConfig.firebaseProjectId)}/databases/${dbId}/documents/${collectionName}/${encodeURIComponent(videoId)}`;
  const url = serverConfig.firebaseApiKey ? `${base}?key=${encodeURIComponent(serverConfig.firebaseApiKey)}` : base;
  const headers: Record<string, string> = {};
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) return 'FORBIDDEN';
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw Object.assign(new Error(errText || `Firestore REST lookup failed (${res.status})`), {
      statusCode: res.status,
    });
  }
  const json = (await res.json()) as { fields?: Record<string, any> };
  return decodeFirestoreRestFields(json.fields);
}

function mapDocToMediaRecord(
  videoId: string,
  collectionName: 'videos' | 'reels',
  d: Record<string, any>
): MediaRecord {
  return {
    id: videoId,
    collectionName,
    ownerId: d.ownerId || d.userId || '',
    visibility: d.visibility || 'public',
    sourceObjectPath: d.sourceObjectPath,
    hlsOutputPrefix: d.hlsOutputPrefix,
    hlsManifestUrl: d.hlsManifestUrl,
    transcodingStatus: d.transcodingStatus,
    url: collectionName === 'reels' ? d.videoUrl || d.url : d.url,
    poster: d.poster,
  };
}

export async function lookupMediaRecord(
  videoId: string,
  idToken?: string | null
): Promise<MediaRecord | null> {
  try {
    const videoSnap = await adminDb.collection('videos').doc(videoId).get();
    if (videoSnap.exists) {
      return mapDocToMediaRecord(videoId, 'videos', videoSnap.data() || {});
    }

    const reelSnap = await adminDb.collection('reels').doc(videoId).get();
    if (reelSnap.exists) {
      return mapDocToMediaRecord(videoId, 'reels', reelSnap.data() || {});
    }
    return null;
  } catch (err: any) {
    const isPermDenied =
      err?.code === 7 ||
      String(err?.message || '').includes('PERMISSION_DENIED') ||
      String(err?.details || '').includes('Missing or insufficient permissions');

    if (!isPermDenied) {
      throw err;
    }

    // Fallback to Firestore REST API (governed by firestore.rules + caller ID token)
    let sawForbidden = false;
    for (const col of ['videos', 'reels'] as const) {
      const restDoc = await fetchFirestoreDocViaRest(col, videoId, idToken);
      if (restDoc === 'FORBIDDEN') {
        sawForbidden = true;
        continue;
      }
      if (restDoc) {
        return mapDocToMediaRecord(videoId, col, restDoc);
      }
    }

    if (sawForbidden) {
      const deniedErr = new Error(
        idToken
          ? 'Video not found or you do not have permission to access this private media.'
          : 'Authentication required or media does not exist.'
      );
      (deniedErr as any).statusCode = idToken ? 403 : 404;
      throw deniedErr;
    }

    return null;
  }
}

export async function resolveMediaRecordForRequest(
  req: AuthenticatedRequest,
  videoId: string
): Promise<MediaRecord | null> {
  const pt = typeof req.query.pt === 'string' ? req.query.pt : '';
  const bearerToken = extractBearerToken(req);

  if (pt) {
    const decoded = verifyPlaybackToken(pt, videoId);
    try {
      const liveRecord = await lookupMediaRecord(videoId, bearerToken);
      if (!liveRecord) {
        return null;
      }
      return liveRecord;
    } catch (err: any) {
      // If Firestore Admin SDK lacks IAM (cross-project rest-fallback) and <video>/HLS segment
      // requests do not carry a Bearer token, unauthenticated REST returns 403 -> statusCode 404.
      // Only allow fallback for tokens originally minted for an authenticated private owner;
      // if decoded.vis was 'public'/'unlisted' and REST now denies access, visibility changed to private -> reject.
      if (
        decoded &&
        decoded.vis === 'private' &&
        decoded.uid &&
        decoded.uid !== 'anonymous' &&
        decoded.uid === decoded.oid &&
        (decoded.obj || decoded.hls)
      ) {
        return {
          id: videoId,
          collectionName: decoded.col || 'videos',
          ownerId: decoded.oid || '',
          visibility: 'private',
          sourceObjectPath: decoded.obj,
          hlsOutputPrefix: decoded.hls,
        };
      }
      throw err;
    }
  }

  return lookupMediaRecord(videoId, bearerToken);
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
    if (
      decoded &&
      decoded.uid &&
      decoded.uid !== 'anonymous' &&
      decoded.uid === record.ownerId
    ) {
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
  contentTypeOverride?: string,
  isPrivate: boolean = false
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
  res.setHeader('Cache-Control', isPrivate ? 'private, no-store' : 'private, max-age=300');

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
    return `/api/media/object/${encodeURIComponent(record.id)}?pt=${encodeURIComponent(playbackToken)}`;
  }
  return record.url || null;
}
