import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps, getApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { serverConfig } from './config';

let adminApp: App;

if (getApps().length === 0) {
  adminApp = initializeApp({
    credential: applicationDefault(),
    projectId: serverConfig.gcpProjectId,
    storageBucket: serverConfig.gcsBucketName,
  });
} else {
  adminApp = getApp();
}

export const adminAuth = getAuth(adminApp);
export const adminDb: Firestore =
  serverConfig.firestoreDatabaseId && serverConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(adminApp, serverConfig.firestoreDatabaseId)
    : getFirestore(adminApp);

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
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
