/**
 * Authentication, One-Time Permanent Login ID & Google Workspace OAuth Token Service
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure Firebase Auth persists across browser restarts
setPersistence(auth, browserLocalPersistence).catch(() => {});

const provider = new GoogleAuthProvider();
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];

SCOPES.forEach((scope) => {
  provider.addScope(scope);
});

const PERMANENT_USER_STORAGE_KEY = 'SAMAD_PERMANENT_LOGIN_USER_V1';
const PERMANENT_LOGOUT_FLAG_KEY = 'SAMAD_EXPLICIT_LOGOUT_V1';
const CACHED_TOKEN_SESSION_KEY = 'SAMAD_OAUTH_ACCESS_TOKEN_V1';

export interface PermanentUserProfile {
  uid: string;
  loginId: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isPermanent: boolean;
  isGoogleLinked?: boolean;
  createdAt: string;
}

const DEFAULT_PERMANENT_PROFILE: PermanentUserProfile = {
  uid: 'permanent-samad-dealer-01',
  loginId: 'SAMAD-786',
  displayName: 'মেসার্স আব্দুস সামাদ মোল্লাহ্',
  email: 'mssamadmollah@gmail.com',
  photoURL: null,
  isPermanent: true,
  isGoogleLinked: false,
  createdAt: new Date().toISOString(),
};

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return sessionStorage.getItem(CACHED_TOKEN_SESSION_KEY);
  } catch {
    return null;
  }
})();

function saveCachedToken(token: string | null) {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(CACHED_TOKEN_SESSION_KEY, token);
    } else {
      sessionStorage.removeItem(CACHED_TOKEN_SESSION_KEY);
    }
  } catch {}
}

export function getSavedPermanentProfile(): PermanentUserProfile | null {
  try {
    const raw = localStorage.getItem(PERMANENT_USER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as PermanentUserProfile;
    }
  } catch {}
  return null;
}

export function savePermanentProfile(profile: PermanentUserProfile): void {
  try {
    localStorage.setItem(PERMANENT_USER_STORAGE_KEY, JSON.stringify(profile));
    localStorage.removeItem(PERMANENT_LOGOUT_FLAG_KEY);
  } catch {}
}

export function profileToUserObject(profile: PermanentUserProfile): User {
  return {
    uid: profile.uid,
    displayName: `${profile.displayName} (${profile.loginId})`,
    email: profile.email,
    photoURL: profile.photoURL,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'permanent-token',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => profile,
    phoneNumber: null,
    providerId: 'permanent-id',
  } as unknown as User;
}

/**
 * One-Time Permanent ID Login:
 * Logs in the dealer permanently across all future reloads and offline sessions.
 */
export function loginWithPermanentId(params?: {
  loginId?: string;
  displayName?: string;
  email?: string;
}): User {
  const existing = getSavedPermanentProfile() || DEFAULT_PERMANENT_PROFILE;
  const updated: PermanentUserProfile = {
    ...existing,
    loginId: params?.loginId?.trim() || existing.loginId || 'SAMAD-786',
    displayName:
      params?.displayName?.trim() ||
      existing.displayName ||
      'মেসার্স আব্দুস সামাদ মোল্লাহ্',
    email: params?.email?.trim() || existing.email || 'mssamadmollah@gmail.com',
    isPermanent: true,
  };
  savePermanentProfile(updated);
  return profileToUserObject(updated);
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // 1. Immediately check or initialize One-Time Permanent Login ID so user never gets logged out on reload
  const isExplicitlyLoggedOut = (() => {
    try {
      return localStorage.getItem(PERMANENT_LOGOUT_FLAG_KEY) === 'true';
    } catch {
      return false;
    }
  })();

  let savedProfile = getSavedPermanentProfile();
  if (!savedProfile && !isExplicitlyLoggedOut) {
    // Auto-provision one-time permanent login ID on first run
    savedProfile = DEFAULT_PERMANENT_PROFILE;
    savePermanentProfile(savedProfile);
  }

  if (savedProfile && !isExplicitlyLoggedOut) {
    const permanentUser = profileToUserObject(savedProfile);
    if (onAuthSuccess) {
      onAuthSuccess(permanentUser, cachedAccessToken || 'permanent-local-session');
    }
  }

  // 2. Also listen to Firebase Auth state changes
  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (firebaseUser) {
      const existing = getSavedPermanentProfile() || DEFAULT_PERMANENT_PROFILE;
      const mergedProfile: PermanentUserProfile = {
        uid: firebaseUser.uid,
        loginId: existing.loginId || 'SAMAD-786',
        displayName:
          firebaseUser.displayName ||
          existing.displayName ||
          'মেসার্স আব্দুস সামাদ মোল্লাহ্',
        email: firebaseUser.email || existing.email || 'mssamadmollah@gmail.com',
        photoURL: firebaseUser.photoURL || existing.photoURL,
        isPermanent: true,
        isGoogleLinked: Boolean(cachedAccessToken),
        createdAt: existing.createdAt || new Date().toISOString(),
      };
      savePermanentProfile(mergedProfile);
      if (onAuthSuccess) {
        onAuthSuccess(
          profileToUserObject(mergedProfile),
          cachedAccessToken || 'permanent-local-session'
        );
      }
    } else {
      // If no Firebase user, keep the saved Permanent Login ID active unless explicitly logged out
      const currentSaved = getSavedPermanentProfile();
      const loggedOut = (() => {
        try {
          return localStorage.getItem(PERMANENT_LOGOUT_FLAG_KEY) === 'true';
        } catch {
          return false;
        }
      })();

      if (currentSaved && !loggedOut) {
        if (onAuthSuccess) {
          onAuthSuccess(
            profileToUserObject(currentSaved),
            cachedAccessToken || 'permanent-local-session'
          );
        }
      } else if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || 'google-session-token';
    saveCachedToken(credential?.accessToken || null);

    const existing = getSavedPermanentProfile() || DEFAULT_PERMANENT_PROFILE;
    const mergedProfile: PermanentUserProfile = {
      uid: result.user.uid,
      loginId: existing.loginId || 'SAMAD-786',
      displayName:
        result.user.displayName ||
        existing.displayName ||
        'মেসার্স আব্দুস সামাদ মোল্লাহ্',
      email: result.user.email || existing.email || 'mssamadmollah@gmail.com',
      photoURL: result.user.photoURL,
      isPermanent: true,
      isGoogleLinked: Boolean(credential?.accessToken),
      createdAt: existing.createdAt || new Date().toISOString(),
    };
    savePermanentProfile(mergedProfile);

    return { user: profileToUserObject(mergedProfile), accessToken: token };
  } catch (error: any) {
    if (
      error.code !== 'auth/popup-closed-by-user' &&
      error.code !== 'auth/cancelled-popup-request'
    ) {
      console.error('Sign in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    localStorage.setItem(PERMANENT_LOGOUT_FLAG_KEY, 'true');
  } catch {}
  saveCachedToken(null);
  try {
    await signOut(auth);
  } catch {}
};
