import { TranscoderServiceClient, protos } from '@google-cloud/video-transcoder';
import { serverConfig } from './config';
import { adminDb } from './firebaseAdmin';
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
  error?: string;
}

export async function checkTranscoderApiHealth(): Promise<TranscoderApiHealth> {
  const parent = transcoderClient.locationPath(serverConfig.gcpProjectId, serverConfig.transcoderLocation);
  try {
    await transcoderClient.listJobs({ parent, pageSize: 1 });
    return {
      projectId: serverConfig.gcpProjectId,
      location: serverConfig.transcoderLocation,
      accessible: true,
    };
  } catch (err: any) {
    return {
      projectId: serverConfig.gcpProjectId,
      location: serverConfig.transcoderLocation,
      accessible: false,
      error: err?.message || 'Cloud Transcoder API is not enabled or accessible.',
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
  sourceObjectPath: string;
  sourceWidth?: number;
  sourceHeight?: number;
}): Promise<{
  jobName: string;
  state: string;
  hlsOutputPrefix: string;
  presets: ResolutionPreset[];
}> {
  const { videoId, collectionName, ownerId, sourceObjectPath, sourceWidth, sourceHeight } = params;

  const expectedPrefix = `videos/${ownerId}/`;
  if (!sourceObjectPath.startsWith(expectedPrefix)) {
    throw Object.assign(new Error('Forbidden: source object does not belong to authenticated user.'), {
      statusCode: 403,
    });
  }

  const objInfo = await verifyUploadedObject(sourceObjectPath);
  if (!objInfo.exists) {
    throw Object.assign(new Error('Uploaded source video object was not found in Google Cloud Storage.'), {
      statusCode: 404,
    });
  }

  const presets = selectTranscodePresets(sourceWidth, sourceHeight);
  const inputUri = `gs://${serverConfig.gcsBucketName}/${sourceObjectPath}`;
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
    {
      key: 'audio-aac',
      audioStream: {
        codec: 'aac',
        bitrateBps: 128_000,
        channelCount: 2,
        sampleRateHertz: 48_000,
      },
    },
  ];

  const muxStreams: IMuxStream[] = presets.map((preset) => ({
    key: preset.muxKey,
    container: 'ts',
    fileName: preset.fileName,
    elementaryStreams: [preset.key, 'audio-aac'],
    segmentSettings: {
      segmentDuration: { seconds: 4 },
      individualSegments: true,
    },
  }));

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
          startTimeOffset: { seconds: 0 },
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

  const parent = transcoderClient.locationPath(serverConfig.gcpProjectId, serverConfig.transcoderLocation);
  const [createdJob] = await transcoderClient.createJob({
    parent,
    job: jobConfig,
  });

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

  activeJobsByVideoId.set(videoId, tracking);

  // Persist initial processing state to Firestore without overwriting existing metadata
  await adminDb
    .collection(collectionName)
    .doc(videoId)
    .set(
      {
        sourceObjectPath,
        hlsOutputPrefix,
        transcoderJobName: jobName,
        transcodingStatus: 'processing',
        transcodingError: null,
        streamQualities: buildHlsStreamQualities(videoId, presets),
      },
      { merge: true }
    );

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
      const result = await syncTranscodeJobStatus(tracking.videoId, tracking.collectionName, tracking.jobName);
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
 */
export async function syncTranscodeJobStatus(
  videoId: string,
  collectionName?: 'videos' | 'reels',
  explicitJobName?: string
): Promise<{
  videoId: string;
  state: string;
  transcodingStatus: 'processing' | 'ready' | 'failed';
  hlsManifestUrl?: string;
  streamQualities?: VideoStreamQuality[];
  errorMessage?: string;
}> {
  let targetCollection: 'videos' | 'reels' = collectionName || 'videos';
  let jobName = explicitJobName || activeJobsByVideoId.get(videoId)?.jobName || '';
  let presets = activeJobsByVideoId.get(videoId)?.presets || STANDARD_LADDER;

  if (!jobName) {
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
  }

  if (!jobName) {
    // Return current Firestore state if no GCP Transcoder job is attached
    const snap = await adminDb.collection(targetCollection).doc(videoId).get();
    const data = snap.data();
    return {
      videoId,
      state: data?.transcodingStatus === 'ready' ? 'SUCCEEDED' : 'UNKNOWN',
      transcodingStatus: (data?.transcodingStatus as 'processing' | 'ready' | 'failed') || 'ready',
      hlsManifestUrl: data?.hlsManifestUrl,
      streamQualities: data?.streamQualities,
    };
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
    await adminDb.collection(targetCollection).doc(videoId).set(
      {
        transcodingStatus: 'ready',
        hlsManifestUrl,
        streamQualities,
        transcodingError: null,
        transcodedAt: Date.now(),
      },
      { merge: true }
    );
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
    await adminDb.collection(targetCollection).doc(videoId).set(
      {
        transcodingStatus: 'failed',
        transcodingError: errorMessage,
      },
      { merge: true }
    );
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
