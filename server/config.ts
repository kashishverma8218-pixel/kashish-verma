import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket: string;
  messagingSenderId?: string;
  recaptchaSiteKey?: string;
}

function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch (err) {
    console.warn('[Vio Config] Could not read firebase-applet-config.json, relying on environment variables:', err);
    return {
      projectId: process.env.GCP_PROJECT_ID || '',
      appId: '',
      apiKey: '',
      authDomain: '',
      firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
      storageBucket: process.env.GCS_BUCKET_NAME || '',
    };
  }
}

const appletConfig = loadFirebaseAppletConfig();
const runtimeEnvGcpProjectId = (process.env.GCP_PROJECT_ID || '').trim();
const resolvedFirebaseProjectId = appletConfig.projectId || runtimeEnvGcpProjectId || '';

if (runtimeEnvGcpProjectId && appletConfig.projectId && runtimeEnvGcpProjectId !== appletConfig.projectId) {
  console.warn(
    `[Vio Config Warning] Runtime GCP_PROJECT_ID ("${runtimeEnvGcpProjectId}") differs from Firebase projectId ("${appletConfig.projectId}"). Using "${appletConfig.projectId}" to keep Firebase, Cloud Storage, and Cloud Transcoder aligned.`
  );
}

// Ephemeral fallback secret if PLAYBACK_TOKEN_SECRET env var is not configured.
// Production Cloud Run deployments should set PLAYBACK_TOKEN_SECRET via Secret Manager
// so tokens remain valid across multiple container instances.
const runtimeSecret = crypto.randomBytes(32).toString('hex');

export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isCloudRun: Boolean(process.env.K_SERVICE),
  cloudRunService: process.env.K_SERVICE || null,
  cloudRunRevision: process.env.K_REVISION || null,

  firebaseProjectId: resolvedFirebaseProjectId,
  firebaseApiKey: appletConfig.apiKey || process.env.FIREBASE_API_KEY || '',
  gcpProjectId: appletConfig.projectId || runtimeEnvGcpProjectId || '',
  gcsBucketName: process.env.GCS_BUCKET_NAME || appletConfig.storageBucket,
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)',
  transcoderLocation: process.env.TRANSCODER_LOCATION || process.env.GCP_REGION || 'asia-northeast1',

  playbackTokenSecret: process.env.PLAYBACK_TOKEN_SECRET || runtimeSecret,
  hasPersistentPlaybackSecret: Boolean(process.env.PLAYBACK_TOKEN_SECRET),

  // Max upload sizes
  maxVideoUploadBytes: parseInt(process.env.MAX_VIDEO_UPLOAD_BYTES || String(5 * 1024 * 1024 * 1024), 10), // 5 GiB
  maxImageUploadBytes: parseInt(process.env.MAX_IMAGE_UPLOAD_BYTES || String(10 * 1024 * 1024), 10), // 10 MiB

  // Public app origin (used alongside CORS_ALLOWED_ORIGINS)
  appUrl: (process.env.APP_URL || '').trim(),

  // Firebase App Check backend enforcement: 'off' | 'audit' | 'strict'
  appCheckEnforcement: (['off', 'audit', 'strict'].includes((process.env.APP_CHECK_ENFORCEMENT || '').toLowerCase())
    ? process.env.APP_CHECK_ENFORCEMENT!.toLowerCase()
    : 'audit') as 'off' | 'audit' | 'strict',
  recaptchaSiteKey: (process.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || appletConfig.recaptchaSiteKey || '').trim(),

  // Allowed CORS origins (comma-separated in CORS_ALLOWED_ORIGINS)
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
