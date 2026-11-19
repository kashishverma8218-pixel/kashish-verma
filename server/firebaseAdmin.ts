import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps, getApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { serverConfig } from './config';

let adminApp: App;

if (getApps().length === 0) {
  adminApp = initializeApp({
    credential: applicationDefault(),
    projectId: serverConfig.firebaseProjectId || serverConfig.gcpProjectId,
    storageBucket: serverConfig.gcsBucketName,
  });
} else {
  adminApp = getApp();
}

export const adminAuth = getAuth(adminApp);
export const adminAppCheck = getAppCheck(adminApp);
export const adminDb: Firestore =
  serverConfig.firestoreDatabaseId && serverConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(adminApp, serverConfig.firestoreDatabaseId)
    : getFirestore(adminApp);

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
  appCheckVerified?: boolean;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }
  return null;
}

export async function verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  return adminAuth.verifyIdToken(token, false);
}

/**
 * Firebase App Check verification middleware.
 * - 'off': skips App Check verification
 * - 'audit' (default): verifies X-Firebase-AppCheck whenever provided (rejects invalid/forged tokens), allows requests without a token when client App Check is not configured
 * - 'strict': requires a valid X-Firebase-AppCheck token on every protected call
 */
export async function verifyFirebaseAppCheck(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (serverConfig.appCheckEnforcement === 'off') {
    req.appCheckVerified = false;
    next();
    return;
  }

  const rawHeader = req.headers['x-firebase-appcheck'];
  const appCheckToken = typeof rawHeader === 'string' ? rawHeader.trim() : '';

  if (!appCheckToken) {
    if (serverConfig.appCheckEnforcement === 'strict') {
      res.status(401).json({
        error: 'Firebase App Check token required.',
        code: 'APP_CHECK_MISSING',
      });
      return;
    }
    req.appCheckVerified = false;
    next();
    return;
  }

  try {
    await adminAppCheck.verifyToken(appCheckToken);
    req.appCheckVerified = true;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid Firebase App Check token.';
    res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase App Check token.',
      code: 'APP_CHECK_INVALID',
      details: message,
    });
  }
}

export interface FirestoreAdminHealth {
  firebaseProjectId: string;
  databaseId: string;
  accessible: boolean;
  mode: 'admin-sdk' | 'rest-fallback';
  error?: string;
  errorCode?: string | number;
  remediation?: string;
}

export async function checkFirestoreAdminHealth(): Promise<FirestoreAdminHealth> {
  try {
    await adminDb.collection('videos').limit(1).get();
    return {
      firebaseProjectId: serverConfig.firebaseProjectId,
      databaseId: serverConfig.firestoreDatabaseId,
      accessible: true,
      mode: 'admin-sdk',
    };
  } catch (err: any) {
    const message = err?.message || 'Firestore Admin SDK query failed.';
    const isPermDenied =
      err?.code === 7 ||
      String(message).includes('PERMISSION_DENIED') ||
      String(err?.details || '').includes('Missing or insufficient permissions');

    return {
      firebaseProjectId: serverConfig.firebaseProjectId,
      databaseId: serverConfig.firestoreDatabaseId,
      accessible: false,
      mode: 'rest-fallback',
      error: message,
      errorCode: err?.code,
      remediation: isPermDenied
        ? `Grant Cloud Datastore User (roles/datastore.user) on project "${serverConfig.firebaseProjectId}" to the Cloud Run runtime service account, or deploy Cloud Run inside "${serverConfig.firebaseProjectId}". Public/authenticated playback falls back to Firestore REST under firestore.rules.`
        : undefined,
    };
  }
}

/**
 * Strict Firebase Authentication middleware for protected API endpoints
 * (upload authorization, transcode job submission, private media access).
 */
export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Missing Firebase ID Bearer token.',
      code: 'AUTH_MISSING_TOKEN',
    });
    return;
  }

  try {
    const decoded = await verifyFirebaseToken(token);
    req.user = decoded;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid or expired Firebase ID token.';
    res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase authentication token.',
      code: 'AUTH_INVALID_TOKEN',
      details: message,
    });
  }
}

/**
 * Optional Firebase Authentication middleware for endpoints that support
 * both public/unlisted content and authenticated private access.
 */
export async function optionalFirebaseAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.user = await verifyFirebaseToken(token);
  } catch {
    // Ignore invalid optional token; route handler decides whether auth is required
  }
  next();
}
