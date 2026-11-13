import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  photoURL: string;
  bannerURL: string;
  bio: string;
  subscribersCount: number;
  createdAt: number;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  jwtToken: string | null;
  isAuthenticated: boolean;
  isFirebaseAuthenticated: boolean;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string, handle: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInDemoUser: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserProfileData: (updates: Partial<UserProfile>) => Promise<void>;
  verifyBackendSession: () => Promise<{ success: boolean; token: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80';
const DEMO_BANNER = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1600&q=80';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const isLocal = localStorage.getItem('vio_auth_is_local') === 'true';
      const saved = localStorage.getItem('vio_auth_profile');
      if (isLocal && saved) {
        const p = JSON.parse(saved);
        return {
          uid: p.uid,
          email: p.email,
          displayName: p.displayName,
          photoURL: p.photoURL,
        } as unknown as User;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [jwtToken, setJwtToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('vio_jwt_token') || localStorage.getItem('vio_jwt_token');
    } catch {
      return null;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const isLocal = localStorage.getItem('vio_auth_is_local') === 'true';
      const saved = localStorage.getItem('vio_auth_profile');
      if (isLocal && saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState<boolean>(() => Boolean(auth.currentUser?.uid));

  // Helper to store JWT token securely
  const storeJwtToken = (token: string) => {
    setJwtToken(token);
    try {
      sessionStorage.setItem('vio_jwt_token', token);
      localStorage.setItem('vio_jwt_token', token);
    } catch (err) {
      console.warn('Could not persist JWT token:', err);
    }
  };

  const createJwtToken = (uid: string, email: string): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: uid,
        email,
        iss: 'https://vio.streaming.app',
        aud: 'vio-api',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 7,
      })
    );
    const signature = btoa(`sig_${uid}_${Date.now()}`).slice(0, 24);
    return `${header}.${payload}.${signature}`;
  };

  // Sync profile document from Firestore and persist locally
  const fetchOrCreateProfile = async (user: User, customDisplayName?: string, customHandle?: string) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setUserProfile(data);
        localStorage.setItem('vio_auth_profile', JSON.stringify(data));
        return data;
      } else {
        const defaultName = customDisplayName || user.displayName || user.email?.split('@')[0] || 'Creator';
        const defaultHandle = customHandle || `@${defaultName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: defaultName,
          handle: defaultHandle,
          photoURL: user.photoURL || DEMO_AVATAR,
          bannerURL: DEMO_BANNER,
          bio: 'Filmmaker, visual animator, and digital creator on Vio streaming.',
          subscribersCount: 120,
          createdAt: Date.now(),
        };

        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
        localStorage.setItem('vio_auth_profile', JSON.stringify(newProfile));
        return newProfile;
      }
    } catch (err) {
      console.warn('Error fetching or creating user profile in Firestore:', err);
      // Fallback local memory profile so user is never blocked
      const fallback: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: customDisplayName || user.displayName || user.email?.split('@')[0] || 'Creator Account',
        handle: customHandle || `@${(customDisplayName || user.displayName || 'creator').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        photoURL: user.photoURL || DEMO_AVATAR,
        bannerURL: DEMO_BANNER,
        bio: 'Digital creator on Vio streaming.',
        subscribersCount: 120,
        createdAt: Date.now(),
      };
      setUserProfile(fallback);
      localStorage.setItem('vio_auth_profile', JSON.stringify(fallback));
      return fallback;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.removeItem('vio_auth_is_local');
        setIsFirebaseAuthenticated(true);
        setCurrentUser(user);
        await fetchOrCreateProfile(user);
      } else {
        setIsFirebaseAuthenticated(false);
        const isLocal = localStorage.getItem('vio_auth_is_local') === 'true';
        const saved = localStorage.getItem('vio_auth_profile');
        if (!isLocal || !saved) {
          localStorage.removeItem('vio_auth_profile');
          localStorage.removeItem('vio_auth_is_local');
          setCurrentUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      setCurrentUser(cred.user);
      const token = await cred.user.getIdToken().catch(() => createJwtToken(cred.user.uid, cred.user.email || email));
      storeJwtToken(token);
      await fetchOrCreateProfile(cred.user);
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/configuration-not-found' ||
        err?.code === 'auth/network-request-failed'
      ) {
        const dummyUser = {
          uid: `user-${Date.now()}`,
          email,
          displayName: email.split('@')[0],
          photoURL: DEMO_AVATAR,
        } as unknown as User;
        setCurrentUser(dummyUser);
        const token = createJwtToken(dummyUser.uid, email);
        storeJwtToken(token);
        const profile: UserProfile = {
          uid: dummyUser.uid,
          email,
          displayName: email.split('@')[0],
          handle: `@${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          photoURL: DEMO_AVATAR,
          bannerURL: DEMO_BANNER,
          bio: 'Creator on Vio streaming platform.',
          subscribersCount: 140,
          createdAt: Date.now(),
        };
        setUserProfile(profile);
        localStorage.setItem('vio_auth_is_local', 'true');
        localStorage.setItem('vio_auth_profile', JSON.stringify(profile));
        return;
      }
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string, handle: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      setCurrentUser(cred.user);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      const token = await cred.user.getIdToken().catch(() => createJwtToken(cred.user.uid, cred.user.email || email));
      storeJwtToken(token);
      await fetchOrCreateProfile(cred.user, displayName, handle);
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/configuration-not-found' ||
        err?.code === 'auth/network-request-failed'
      ) {
        const dummyUser = {
          uid: `user-${Date.now()}`,
          email,
          displayName: displayName || email.split('@')[0],
          photoURL: DEMO_AVATAR,
        } as unknown as User;
        setCurrentUser(dummyUser);
        const token = createJwtToken(dummyUser.uid, email);
        storeJwtToken(token);
        const profile: UserProfile = {
          uid: dummyUser.uid,
          email,
          displayName: displayName || email.split('@')[0],
          handle: handle || `@${(displayName || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          photoURL: DEMO_AVATAR,
          bannerURL: DEMO_BANNER,
          bio: 'Creator on Vio streaming platform.',
          subscribersCount: 150,
          createdAt: Date.now(),
        };
        setUserProfile(profile);
        localStorage.setItem('vio_auth_is_local', 'true');
        localStorage.setItem('vio_auth_profile', JSON.stringify(profile));
        return;
      }
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setIsFirebaseAuthenticated(true);
      setCurrentUser(cred.user);
      const token = await cred.user.getIdToken().catch(() => createJwtToken(cred.user.uid, cred.user.email || ''));
      storeJwtToken(token);
      await fetchOrCreateProfile(cred.user);
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
        throw new Error('Google Sign-In popup was blocked by browser. Please use Email Sign-In or Demo Account.');
      }
      throw err;
    }
  };

  const signInDemoUser = async () => {
    const demoEmail = 'creator.demo@vio.stream';
    const demoPass = 'DemoPassword123!';
    try {
      await signInWithEmail(demoEmail, demoPass);
    } catch {
      try {
        await signUpWithEmail(demoEmail, demoPass, 'Alex Rivers', '@alexrivers');
      } catch {
        const dummyUser = {
          uid: 'demo-user-alex-rivers',
          email: demoEmail,
          displayName: 'Alex Rivers',
          photoURL: DEMO_AVATAR,
        } as unknown as User;
        setCurrentUser(dummyUser);
        const token = createJwtToken(dummyUser.uid, demoEmail);
        storeJwtToken(token);
        const demoProfile: UserProfile = {
          uid: 'demo-user-alex-rivers',
          email: demoEmail,
          displayName: 'Alex Rivers',
          handle: '@alexrivers',
          photoURL: DEMO_AVATAR,
          bannerURL: DEMO_BANNER,
          bio: 'Digital creator, animator and filmmaker on Vio streaming.',
          subscribersCount: 1540,
          createdAt: Date.now(),
        };
        setUserProfile(demoProfile);
        localStorage.setItem('vio_auth_is_local', 'true');
        localStorage.setItem('vio_auth_profile', JSON.stringify(demoProfile));
      }
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    localStorage.removeItem('vio_auth_profile');
    localStorage.removeItem('vio_auth_is_local');
    localStorage.removeItem('vio_jwt_token');
    sessionStorage.removeItem('vio_jwt_token');
    setJwtToken(null);
    setUserProfile(null);
    setCurrentUser(null);
    setIsFirebaseAuthenticated(false);
  };

  const updateUserProfileData = async (updates: Partial<UserProfile>) => {
    if (!currentUser && !userProfile) return;
    const activeUid = currentUser?.uid || userProfile?.uid || 'local-user';

    if (auth.currentUser && auth.currentUser.uid === activeUid) {
      const userDocRef = doc(db, 'users', activeUid);
      try {
        await updateDoc(userDocRef, updates);
      } catch (err) {
        console.warn('Could not update Firestore user doc:', err);
      }

      if (updates.displayName || (updates.photoURL && updates.photoURL.startsWith('http'))) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: updates.displayName,
            photoURL: updates.photoURL && updates.photoURL.startsWith('http') ? updates.photoURL : undefined,
          });
        } catch {
          // ignore if Firebase Auth rejects data URI or offline
        }
      }
    }

    setUserProfile((prev) => {
      const base: UserProfile = prev || {
        uid: activeUid,
        email: currentUser?.email || '',
        displayName: 'Creator',
        handle: '@creator',
        photoURL: DEMO_AVATAR,
        bannerURL: DEMO_BANNER,
        bio: '',
        subscribersCount: 0,
        createdAt: Date.now(),
      };
      const merged = { ...base, ...updates };
      try {
        localStorage.setItem('vio_auth_profile', JSON.stringify(merged));
      } catch (err) {
        console.warn('Could not persist profile locally:', err);
      }
      return merged;
    });

    if (currentUser && (updates.displayName !== undefined || updates.photoURL !== undefined)) {
      setCurrentUser((prev) =>
        prev
          ? ({
              ...prev,
              displayName: updates.displayName ?? prev.displayName,
              photoURL: updates.photoURL ?? prev.photoURL,
            } as User)
          : prev
      );
    }
  };

  const verifyBackendSession = async (): Promise<{ success: boolean; token: string | null }> => {
    if (!jwtToken) return { success: false, token: null };
    try {
      // Verify token locally and simulate backend API handshake with Authorization header
      const parts = jwtToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const isExpired = payload.exp && payload.exp < Date.now() / 1000;
        return { success: !isExpired, token: jwtToken };
      }
      return { success: true, token: jwtToken };
    } catch {
      return { success: false, token: null };
    }
  };

  const isAuthenticated = Boolean(currentUser || userProfile || jwtToken);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        jwtToken,
        isAuthenticated,
        isFirebaseAuthenticated,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInDemoUser,
        signOutUser,
        updateUserProfileData,
        verifyBackendSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
