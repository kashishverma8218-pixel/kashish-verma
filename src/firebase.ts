import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider, getToken, AppCheck } from 'firebase/app-check';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const storage = getStorage(app);

const appCheckSiteKey = (
  import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY ||
  (firebaseConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey ||
  ''
).trim();

let appCheckInstance: AppCheck | null = null;
if (typeof window !== 'undefined' && appCheckSiteKey.length > 0) {
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('Firebase App Check initialization skipped:', err);
  }
}

export const appCheck = appCheckInstance;

export async function getOptionalAppCheckToken(forceRefresh = false): Promise<string | null> {
  if (!appCheckInstance) return null;
  try {
    const result = await getToken(appCheckInstance, forceRefresh);
    return result?.token || null;
  } catch {
    return null;
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore appears offline or unreachable; continuing with local cache.');
    }
    return false;
  }
}

export default app;
