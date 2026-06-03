/**
 * Firebase Firestore backend for collections. Used ONLY when the user is
 * logged in AND Firebase is configured. Everything here is best-effort: a
 * cloud failure must never break the local-first experience.
 *
 * Doc layout: collection "users/{uid}" with a single doc "collections" whose
 * "map" field holds the same store shape as the local backend.
 */

import { getDb } from '@lib/fcm/auth'

/**
 * Pull the user's collection map from Firestore.
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
export async function pull(uid) {
  const db = await getDb()
  if (!db || !uid) return null
  const { doc, getDoc } = await import('firebase/firestore')
  const ref = doc(db, 'users', uid, 'data', 'collections')
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data().map || {} : {}
}

/**
 * Push the full collection map up to Firestore (overwrite).
 * @param {string} uid
 * @param {object} map
 */
export async function push(uid, map) {
  const db = await getDb()
  if (!db || !uid) return
  const { doc, setDoc } = await import('firebase/firestore')
  const ref = doc(db, 'users', uid, 'data', 'collections')
  await setDoc(ref, { map: map || {} })
}
