/**
 * Optional Firebase auth + app init, feature-flagged by env presence.
 *
 * The whole cloud-sync feature is gated on NEXT_PUBLIC_FIREBASE_* being set.
 * If they are absent, isFirebaseConfigured() is false, the login button is
 * hidden, and the app runs local-only with NO Firebase code paths touched.
 * We import firebase lazily so the SDK is not pulled in when unconfigured.
 */

/** Read public Firebase config from env. All keys must be present to enable. */
function readConfig() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  }
  return cfg
}

/** @returns {boolean} true only when the minimum Firebase env vars exist. */
export function isFirebaseConfigured() {
  const c = readConfig()
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId)
}

let _app = null
let _auth = null
let _db = null

/** Lazily initialize Firebase app/auth/firestore. Returns null if unconfigured. */
async function ensureFirebase() {
  if (!isFirebaseConfigured()) return null
  if (_app) return { app: _app, auth: _auth, db: _db }
  // Dynamic import: keep firebase out of the bundle path when not used.
  const { initializeApp, getApps } = await import('firebase/app')
  const { getAuth } = await import('firebase/auth')
  const { getFirestore } = await import('firebase/firestore')
  const cfg = readConfig()
  _app = getApps().length ? getApps()[0] : initializeApp(cfg)
  _auth = getAuth(_app)
  _db = getFirestore(_app)
  return { app: _app, auth: _auth, db: _db }
}

/** Get the firestore handle (or null). */
export async function getDb() {
  const fb = await ensureFirebase()
  return fb?.db || null
}

/** Sign in with Google popup. Returns the user or throws. */
export async function signIn() {
  const fb = await ensureFirebase()
  if (!fb) throw new Error('Firebase not configured')
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
  const result = await signInWithPopup(fb.auth, new GoogleAuthProvider())
  return result.user
}

/** Sign the current user out. */
export async function signOutUser() {
  const fb = await ensureFirebase()
  if (!fb) return
  const { signOut } = await import('firebase/auth')
  await signOut(fb.auth)
}

/**
 * Subscribe to auth state. Returns an unsubscribe function (or a no-op when
 * unconfigured) so the caller can clean up in a useEffect.
 * @param {(user:object|null)=>void} cb
 * @returns {Promise<() => void>}
 */
export async function onAuth(cb) {
  const fb = await ensureFirebase()
  if (!fb) {
    cb(null)
    return () => {}
  }
  const { onAuthStateChanged } = await import('firebase/auth')
  return onAuthStateChanged(fb.auth, cb)
}
