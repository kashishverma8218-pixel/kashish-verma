import path from 'path';
import { TranscoderServiceClient, protos } from '@google-cloud/video-transcoder';
import { serverConfig } from './config';
import { adminDb } from './firebaseAdmin';
import { fetchFirestoreDocViaRest, lookupMediaRecord } from './playbackService';
import { verifyUploadedObject } from './storageService';
import { VideoStreamQuality } from '../src/types/video';

type IJob = protos.google.cloud.video.transcoder.v1.IJob;
type IElementaryStream = protos.google.cloud.video.transcoder.v1.IElementaryStream;
type IMuxStream = protos.google.cloud.video.transcoder.v1.IMuxStream;

const transcoderClient = new TranscoderServiceClient();

export interface ResolutionPreset {
  key: string;
  label: string;
  height: number;
  width: number;
  bitrateBps: number;
  bitrateKbps: number;
  fps: number;
  muxKey: string;
  fileName: string;
}

const STANDARD_LADDER: ResolutionPreset[] = [
  {
    key: 'video-1080p',
    label: '1080p HD',
    height: 1080,
    width: 1920,
    bitrateBps: 5_500_000,
    bitrateKbps: 5500,
    fps: 30,
    muxKey: 'hls-1080p',
    fileName: 'hls-1080p.m3u8',
  },
  {
    key: 'video-720p',
    label: '720p HD',
    height: 720,
    width: 1280,
    bitrateBps: 2_800_000,
    bitrateKbps: 2800,
    fps: 30,
    muxKey: 'hls-720p',
    fileName: 'hls-720p.m3u8',
  },
  {
    key: 'video-480p',
    label: '480p',
    height: 480,
    width: 854,
    bitrateBps: 1_400_000,
    bitrateKbps: 1400,
    fps: 30,
    muxKey: 'hls-480p',
    fileName: 'hls-480p.m3u8',
  },
  {
    key: 'video-360p',
    label: '360p',
    height: 360,
    width: 640,
    bitrateBps: 800_000,
    bitrateKbps: 800,
    fps: 30,
    muxKey: 'hls-360p',
    fileName: 'hls-360p.m3u8',
  },
];

export interface ActiveJobTracking {
  videoId: string;
  collectionName: 'videos' | 'reels';
  ownerId: string;
  jobName: string;
  hlsOutputPrefix: string;
  presets: ResolutionPreset[];
  state: string;
  startedAt: number;
  errorMessage?: string;
}

const activeJobsByVideoId = new Map<string, ActiveJobTracking>();
const activePollTimers = new Map<string, NodeJS.Timeout>();

/**
 * Selects target resolutions from [1080p, 720p, 480p, 360p] without upscaling
 * beyond the uploaded source resolution (always keeping at least 360p).
 * Automatically swaps width/height when source is vertical (e.g., 9:16 Reels).
 */
export function selectTranscodePresets(
  sourceWidth?: number,
  sourceHeight?: number
): ResolutionPreset[] {
  const hasDims = Boolean(sourceWidth && sourceHeight && sourceWidth > 0 && sourceHeight > 0);
  const isPortrait = Boolean(hasDims && (sourceHeight as number) > (sourceWidth as number));

  // For portrait video (e.g. 1080x1920), short edge determines the resolution tier (1080p, 720p, etc.)
  const shortEdge = hasDims
    ? Math.min(sourceWidth as number, sourceHeight as number)
    : 1080;

  let eligible = STANDARD_LADDER.filter((tier) => tier.height <= shortEdge);
  if (eligible.length === 0) {
    eligible = [STANDARD_LADDER[STANDARD_LADDER.length - 1]]; // 360p floor
  }

  return eligible.map((tier) => {
    if (!isPortrait) return tier;
    return {
      ...tier,
      width: tier.height,
      height: tier.width,
    };
  });
}

export function buildHlsStreamQualities(
  videoId: string,
  presets: ResolutionPreset[]
): VideoStreamQuality[] {
  return presets.map((p, index) => ({
    label: p.label,
    resolution: `${p.width}x${p.height}`,
    bitrateKbps: p.bitrateKbps,
    fps: p.fps,
    url: `/api/stream/hls/${videoId}/${p.fileName}`,
    isMaster: index === 0,
  }));
}

export interface TranscoderApiHealth {
  projectId: string;
  location: string;
  accessible: boolean;
  code?: string;
  error?: string;
  remediation?: string;
}

function isPermissionDeniedError(err: any): boolean {
  const msg = String(err?.message || err?.details || '');
  return err?.code === 7 || /PERMISSION_DENIED|Missing or insufficient permissions|has not been used|disabled/i.test(msg);
}

export async function checkTranscoderApiHealth(): Promise<TranscoderApiHealth> {
  const projectId = serverConfig.firebaseProjectId || serverConfig.gcpProjectId;
  const parent = transcoderClient.locationPath(projectId, serverConfig.transcoderLocation);
  try {
    await transcoderClient.listJobs({ parent, pageSize: 1 }, { autoPaginate: false });
    return {
      projectId,
      location: serverConfig.transcoderLocation,
      accessible: true,
    };
  } catch (err: any) {
    const msg = err?.message || 'Cloud Transcoder API is not enabled or accessible.';
    const isDisabled = /has not been used|disabled/i.test(msg);
    const isPerm = isPermissionDeniedError(err);
    return {
      projectId,
      location: serverConfig.transcoderLocation,
      accessible: false,
      code: isDisabled ? 'TRANSCODER_API_DISABLED' : isPerm ? 'TRANSCODER_PERMISSION_DENIED' : 'TRANSCODER_UNAVAILABLE',
      error: msg,
      remediation: isDisabled
        ? `Enable transcoder.googleapis.com in project "${projectId}" when ready for paid HLS transcoding (or keep raw source playback without billing).`
        : isPerm
        ? `Grant Cloud Transcoder Admin/Viewer IAM on "${projectId}" to the Cloud Run service account.`
        : undefined,
    };
  }
}

/**
 * Starts a real Google Cloud Transcoder API job producing:
 * - Adaptive 360p, 480p, 720p, and 1080p H.264 + AAC streams (capped to source resolution)
 * - HLS v4+ segmented streams + master.m3u8 manifest
 * - Background polling that updates Firestore when job SUCCEEDS or FAILS
 */
export async function startCloudTranscodeJob(params: {
  videoId: string;
  collectionName: 'videos' | 'reels';
  ownerId: string;
  callerIdToken?: string | null;
  sourceObjectPath: string;
  sourceWidth?: number;
  sourceHeight?: number;
  trimStart?: number;
  trimEnd?: number;
  isMutedAudio?: boolean;
}): Promise<{
  jobName: string;
  state: string;
  hlsOutputPrefix: string;
  presets: ResolutionPreset[];
}> {
  const {
    videoId,
    collectionName,
    ownerId,
    callerIdToken,
    sourceObjectPath,
    sourceWidth,
    sourceHeight,
    trimStart,
    trimEnd,
    isMutedAudio,
  } = params;

  if (
    sourceWidth !== undefined &&
    (!Number.isFinite(sourceWidth) || sourceWidth <= 0 || sourceWidth > 7680)
  ) {
    throw Object.assign(new Error('Invalid sourceWidth parameter.'), {
      statusCode: 400,
      code: 'INVALID_INPUT',
    });
  }
  if (
    sourceHeight !== undefined &&
    (!Number.isFinite(sourceHeight) || sourceHeight <= 0 || sourceHeight > 7680)
  ) {
    throw Object.assign(new Error('Invalid sourceHeight parameter.'), {
      statusCode: 400,
      code: 'INVALID_INPUT',
    });
  }
  if (trimStart !== undefined && (!Number.isFinite(trimStart) || trimStart < 0 || trimStart > 86400)) {
    throw Object.assign(new Error('Invalid trimStart parameter.'), {
      statusCode: 400,
      code: 'INVALID_INPUT',
    });
  }
  if (
    trimEnd !== undefined &&
    (!Number.isFinite(trimEnd) || trimEnd <= (trimStart ?? 0) || trimEnd > 86400)
  ) {
    throw Object.assign(new Error('Invalid trimEnd parameter.'), {
      statusCode: 400,
      code: 'INVALID_INPUT',
    });
  }

  const normalizedSourcePath = path.posix.normalize(sourceObjectPath).replace(/^\/+/, '');
  const expectedPrefix = `videos/${ownerId}/`;
  if (normalizedSourcePath.includes('..') || !normalizedSourcePath.startsWith(expectedPrefix)) {
    throw Object.assign(new Error('Forbidden: source object does not belong to authenticated user.'), {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const siblingCollection: 'videos' | 'reels' = collectionName === 'videos' ? 'reels' : 'videos';

  // Require an existing Firestore document owned by ownerId (prevents orphan doc creation & cross-collection ID hijacking)
  try {
    const [existingDoc, siblingDoc] = await Promise.all([
      adminDb.collection(collectionName).doc(videoId).get(),
      adminDb.collection(siblingCollection).doc(videoId).get(),
    ]);

    if (siblingDoc.exists) {
      const siblingOwner = siblingDoc.data()?.ownerId || siblingDoc.data()?.userId;
      if (siblingOwner && siblingOwner !== ownerId) {
        throw Object.assign(new Error('Forbidden: Media ID belongs to another creator.'), {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }
    }

    if (!existingDoc.exists) {
      throw Object.assign(
        new Error('Media document must exist in Firestore before starting transcoding.'),
        {
          statusCode: 404,
          code: 'MEDIA_DOC_NOT_FOUND',
        }
      );
    }

    const existingOwner = existingDoc.data()?.ownerId || existingDoc.data()?.userId;
    if (!existingOwner || existingOwner !== ownerId) {
      throw Object.assign(new Error('Forbidden: You do not own this media document.'), {
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    }
  } catch (dbErr: any) {
    if (dbErr?.statusCode === 403 || dbErr?.statusCode === 404) throw dbErr;
    if (isPermissionDeniedError(dbErr)) {
      // Fall back to Firestore REST with caller's ID token under firestore.rules
      const [restDoc, restSibling] = await Promise.all([
        fetchFirestoreDocViaRest(collectionName, videoId, callerIdToken),
        fetchFirestoreDocViaRest(siblingCollection, videoId, callerIdToken),
      ]);
      if (restSibling === 'FORBIDDEN' || (restSibling && (restSibling.ownerId || restSibling.userId) !== ownerId)) {
        throw Object.assign(new Error('Forbidden: Media ID belongs to another creator.'), {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }
      if (restDoc === 'FORBIDDEN') {
        throw Object.assign(new Error('Forbidden: You do not own this media document.'), {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }
      if (!restDoc) {
        throw Object.assign(
          new Error('Media document must exist in Firestore before starting transcoding.'),
          {
            statusCode: 404,
            code: 'MEDIA_DOC_NOT_FOUND',
          }
        );
      }
      const restOwner = restDoc.ownerId || restDoc.userId;
      if (!restOwner || restOwner !== ownerId) {
        throw Object.assign(new Error('Forbidden: You do not own this media document.'), {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }
    } else {
      throw dbErr;
    }
  }

  const existingActiveJob = activeJobsByVideoId.get(videoId);
  if (existingActiveJob) {
    if (existingActiveJob.ownerId !== ownerId) {
      throw Object.assign(new Error('Forbidden: Active transcoding job belongs to another user.'), {
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    }
    if (existingActiveJob.state === 'PENDING' || existingActiveJob.state === 'RUNNING') {
      throw Object.assign(new Error('A transcoding job is already running for this video.'), {
        statusCode: 409,
        code: 'TRANSCODE_ALREADY_IN_PROGRESS',
      });
    }
  }

  const objInfo = await verifyUploadedObject(normalizedSourcePath);
  if (!objInfo.exists) {
    throw Object.assign(new Error('Uploaded source video object was not found in Google Cloud Storage.'), {
      statusCode: 404,
      code: 'GCS_OBJECT_NOT_FOUND',
    });
  }
  if (objInfo.ownerId && objInfo.ownerId !== ownerId) {
    throw Object.assign(new Error('Forbidden: Uploaded object owner mismatch.'), {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const presets = selectTranscodePresets(sourceWidth, sourceHeight);
  const inputUri = `gs://${serverConfig.gcsBucketName}/${normalizedSourcePath}`;
  const hlsOutputPrefix = `processed/${ownerId}/${videoId}/hls/`;
  const outputUri = `gs://${serverConfig.gcsBucketName}/${hlsOutputPrefix}`;

  const elementaryStreams: IElementaryStream[] = [
    ...presets.map(
      (preset): IElementaryStream => ({
        key: preset.key,
        videoStream: {
          h264: {
            widthPixels: preset.width,
            heightPixels: preset.height,
            bitrateBps: preset.bitrateBps,
            frameRate: preset.fps,
            profile: 'high',
            rateControlMode: 'vbr',
            gopDuration: { seconds: 2 },
          },
        },
      })
    ),
    ...(!isMutedAudio
      ? [
          {
            key: 'audio-aac',
            audioStream: {
              codec: 'aac',
              bitrateBps: 128_000,
              channelCount: 2,
              sampleRateHertz: 48_000,
            },
          } satisfies IElementaryStream,
        ]
      : []),
  ];

  const muxStreams: IMuxStream[] = presets.map((preset) => ({
    key: preset.muxKey,
    container: 'ts',
    fileName: preset.fileName,
    elementaryStreams: isMutedAudio ? [preset.key] : [preset.key, 'audio-aac'],
    segmentSettings: {
      segmentDuration: { seconds: 4 },
      individualSegments: true,
    },
  }));

  const safeStartSec = typeof trimStart === 'number' && Number.isFinite(trimStart) && trimStart > 0 ? trimStart : 0;
  const safeEndSec =
    typeof trimEnd === 'number' && Number.isFinite(trimEnd) && trimEnd > safeStartSec
      ? trimEnd
      : undefined;

  const jobConfig: IJob = {
    inputUri,
    outputUri,
    config: {
      inputs: [
        {
          key: 'input0',
          uri: inputUri,
        },
      ],
      editList: [
        {
          key: 'atom0',
          inputs: ['input0'],
          startTimeOffset: { seconds: Math.floor(safeStartSec) },
          ...(safeEndSec !== undefined ? { endTimeOffset: { seconds: Math.ceil(safeEndSec) } } : {}),
        },
      ],
      elementaryStreams,
      muxStreams,
      manifests: [
        {
          fileName: 'master.m3u8',
          type: 'HLS',
          muxStreams: muxStreams.map((m) => m.key as string),
        },
      ],
    },
  };

  const targetProjectId = serverConfig.firebaseProjectId || serverConfig.gcpProjectId;
  const parent = transcoderClient.locationPath(targetProjectId, serverConfig.transcoderLocation);
  let createdJob: IJob;
  try {
    const [jobResp] = await transcoderClient.createJob({
      parent,
      job: jobConfig,
    });
    createdJob = jobResp;
  } catch (err: any) {
    const msg = err?.message || 'Google Cloud Transcoder API call failed.';
    const isPermissionOrDisabled =
      err?.code === 7 || /PERMISSION_DENIED|has not been used|disabled/i.test(msg);
    throw Object.assign(
      new Error(
        isPermissionOrDisabled
          ? 'Google Cloud Transcoder API is disabled or not permitted for this project. Raw uploaded file is preserved; enable Transcoder API when ready for HLS.'
          : msg
      ),
      {
        statusCode: isPermissionOrDisabled ? 503 : 502,
        code: isPermissionOrDisabled ? 'TRANSCODER_API_DISABLED' : 'TRANSCODER_JOB_ERROR',
      }
    );
  }

  const jobName = createdJob.name || '';
  const initialState = String(createdJob.state || 'PENDING');

  const tracking: ActiveJobTracking = {
    videoId,
    collectionName,
    ownerId,
    jobName,
    hlsOutputPrefix,
    presets,
    state: initialState,
    startedAt: Date.now(),
  };

  if (activeJobsByVideoId.size > 500) {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [k, v] of activeJobsByVideoId.entries()) {
      if (v.startedAt < cutoff && !activePollTimers.has(k)) {
        activeJobsByVideoId.delete(k);
      }
    }
  }
  activeJobsByVideoId.set(videoId, tracking);

  // Update existing Firestore document only (update() never creates orphan documents)
  try {
    await adminDb
      .collection(collectionName)
      .doc(videoId)
      .update({
        sourceObjectPath: normalizedSourcePath,
        hlsOutputPrefix,
        transcoderJobName: jobName,
        transcodingStatus: 'processing',
        transcodingError: null,
        streamQualities: buildHlsStreamQualities(videoId, presets),
      });
  } catch (dbErr: any) {
    if (isPermissionDeniedError(dbErr)) {
      console.warn(
        `[Vio Transcoder] Firestore Admin write denied for ${collectionName}/${videoId} (${dbErr?.message || 'PERMISSION_DENIED'}). Grant roles/datastore.user on "${serverConfig.firebaseProjectId}" to persist background job updates.`
      );
    } else if (dbErr?.code === 5) {
      throw Object.assign(
        new Error('Media document no longer exists in Firestore.'),
        { statusCode: 404, code: 'MEDIA_DOC_NOT_FOUND' }
      );
    } else {
      throw dbErr;
    }
  }

  scheduleBackgroundJobPoller(tracking);

  return {
    jobName,
    state: initialState,
    hlsOutputPrefix,
    presets,
  };
}

function scheduleBackgroundJobPoller(tracking: ActiveJobTracking): void {
  const existingTimer = activePollTimers.get(tracking.videoId);
  if (existingTimer) {
    clearInterval(existingTimer);
  }

  let attempts = 0;
  const maxAttempts = 180; // up to 30 minutes at 10s interval

  const timer = setInterval(async () => {
    attempts++;
    try {
      const result = await syncTranscodeJobStatus(
        tracking.videoId,
        tracking.collectionName,
        tracking.jobName,
        { allowMutate: true }
      );
      if (result.state === 'SUCCEEDED' || result.state === 'FAILED' || attempts >= maxAttempts) {
        clearInterval(timer);
        activePollTimers.delete(tracking.videoId);
      }
    } catch (err) {
      console.error(`[Vio Transcoder] Background poll error for ${tracking.videoId}:`, err);
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        activePollTimers.delete(tracking.videoId);
      }
    }
  }, 10_000);

  activePollTimers.set(tracking.videoId, timer);
}

/**
 * Fetches live status from Google Cloud Transcoder API and synchronizes Firestore.
 * Firestore updates are strictly gated behind allowMutate (never triggered by unauthenticated GET).
 */
export async function syncTranscodeJobStatus(
  videoId: string,
  collectionName?: 'videos' | 'reels',
  explicitJobName?: string,
  options?: { allowMutate?: boolean }
): Promise<{
  videoId: string;
  state: string;
  transcodingStatus: 'processing' | 'ready' | 'failed';
  hlsManifestUrl?: string;
  streamQualities?: VideoStreamQuality[];
  errorMessage?: string;
}> {
  const allowMutate = Boolean(options?.allowMutate);
  let targetCollection: 'videos' | 'reels' = collectionName || 'videos';
  let jobName = explicitJobName || activeJobsByVideoId.get(videoId)?.jobName || '';
  let presets = activeJobsByVideoId.get(videoId)?.presets || STANDARD_LADDER;

  let restFallbackUsed = false;
  if (!jobName) {
    try {
      const vidDoc = await adminDb.collection('videos').doc(videoId).get();
      if (vidDoc.exists) {
        const data = vidDoc.data() || {};
        jobName = data.transcoderJobName || '';
        targetCollection = 'videos';
      } else {
        const reelDoc = await adminDb.collection('reels').doc(videoId).get();
        if (reelDoc.exists) {
          const data = reelDoc.data() || {};
          jobName = data.transcoderJobName || '';
          targetCollection = 'reels';
        }
      }
    } catch (dbErr: any) {
      if (!isPermissionDeniedError(dbErr)) {
        throw dbErr;
      }
      restFallbackUsed = true;
      const record = await lookupMediaRecord(videoId);
      if (record) {
        return {
          videoId,
          state: record.transcodingStatus === 'ready' ? 'SUCCEEDED' : 'UNKNOWN',
          transcodingStatus: record.transcodingStatus || 'ready',
          hlsManifestUrl: record.hlsManifestUrl,
        };
      }
    }
  }

  if (!jobName) {
    if (restFallbackUsed) {
      return {
        videoId,
        state: 'UNKNOWN',
        transcodingStatus: 'ready',
      };
    }
    // Return current Firestore state if no GCP Transcoder job is attached
    try {
      const snap = await adminDb.collection(targetCollection).doc(videoId).get();
      const data = snap.data();
      return {
        videoId,
        state: data?.transcodingStatus === 'ready' ? 'SUCCEEDED' : 'UNKNOWN',
        transcodingStatus: (data?.transcodingStatus as 'processing' | 'ready' | 'failed') || 'ready',
        hlsManifestUrl: data?.hlsManifestUrl,
        streamQualities: data?.streamQualities,
      };
    } catch (dbErr: any) {
      if (isPermissionDeniedError(dbErr)) {
        throw Object.assign(
          new Error(
            `Firestore Admin SDK permission denied on project "${serverConfig.firebaseProjectId}". Grant roles/datastore.user to query live transcoder state.`
          ),
          { statusCode: 503, code: 'FIRESTORE_ADMIN_PERMISSION_DENIED' }
        );
      }
      throw dbErr;
    }
  }

  const [job] = await transcoderClient.getJob({ name: jobName });
  const state = String(job.state || 'PENDING');

  const tracked = activeJobsByVideoId.get(videoId);
  if (tracked) {
    tracked.state = state;
    if (job.error?.message) {
      tracked.errorMessage = job.error.message;
    }
  }

  if (state === 'SUCCEEDED') {
    const hlsManifestUrl = `/api/stream/hls/${videoId}/master.m3u8`;
    const streamQualities = buildHlsStreamQualities(videoId, presets);
    if (allowMutate) {
      try {
        await adminDb.collection(targetCollection).doc(videoId).update({
          transcodingStatus: 'ready',
          hlsManifestUrl,
          streamQualities,
          transcodingError: null,
          transcodedAt: Date.now(),
        });
      } catch (dbErr: any) {
        if (isPermissionDeniedError(dbErr)) {
          console.warn(
            `[Vio Transcoder] Firestore Admin write denied when marking ${targetCollection}/${videoId} ready (${dbErr?.message || 'PERMISSION_DENIED'}).`
          );
        } else if (dbErr?.code !== 5) {
          throw dbErr;
        }
      }
    }
    activeJobsByVideoId.delete(videoId);
    return {
      videoId,
      state,
      transcodingStatus: 'ready',
      hlsManifestUrl,
      streamQualities,
    };
  }

  if (state === 'FAILED') {
    const errorMessage = job.error?.message || 'Google Cloud Transcoder job failed.';
    if (allowMutate) {
      try {
        await adminDb.collection(targetCollection).doc(videoId).update({
          transcodingStatus: 'failed',
          transcodingError: errorMessage,
        });
      } catch (dbErr: any) {
        if (isPermissionDeniedError(dbErr)) {
          console.warn(
            `[Vio Transcoder] Firestore Admin write denied when marking ${targetCollection}/${videoId} failed (${dbErr?.message || 'PERMISSION_DENIED'}).`
          );
        } else if (dbErr?.code !== 5) {
          throw dbErr;
        }
      }
    }
    activeJobsByVideoId.delete(videoId);
    return {
      videoId,
      state,
      transcodingStatus: 'failed',
      errorMessage,
    };
  }

  return {
    videoId,
    state,
    transcodingStatus: 'processing',
  };
}
