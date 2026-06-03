/**
 * Single collections API. Routes between the local and cloud backends:
 *   - Local is the source of truth and is always written.
 *   - Cloud is mirrored ONLY when Firebase is configured AND a user is logged in.
 *
 * Call setUser(user) on auth change. On login we merge cloud into local, then
 * push the merged result back up so both sides converge.
 */

import * as local from './local'
import * as cloud from './cloud'
import { isFirebaseConfigured } from '@lib/fcm/auth'

let _uid = null

/** True only when we should mirror to cloud. */
function cloudEnabled() {
  return isFirebaseConfigured() && Boolean(_uid)
}

/** Fire-and-forget cloud push so local stays snappy; never throws to caller. */
function syncUp() {
  if (!cloudEnabled()) return
  cloud.push(_uid, local.getMap()).catch((e) => {
    // Cloud is best-effort; log quietly without breaking local writes.
    if (process.env.NODE_ENV !== 'production') console.warn('cloud push failed', e)
  })
}

/**
 * Set the current user. On login (uid present) merge cloud -> local, then push.
 * @param {object|null} user
 */
export async function setUser(user) {
  _uid = user?.uid || null
  if (!cloudEnabled()) return
  try {
    const remote = await cloud.pull(_uid)
    if (remote) local.mergeInto(remote)
    await cloud.push(_uid, local.getMap())
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('cloud merge failed', e)
  }
}

/** @returns {Array} all collections. */
export function list() {
  return local.list()
}

/** Save a request into a collection, then mirror up. */
export function save(collectionName, request) {
  const col = local.save(collectionName, request)
  syncUp()
  return col
}

/** Move a saved request to the front of its collection, then mirror up. */
export function touch(collectionName, requestId) {
  local.touch(collectionName, requestId)
  syncUp()
}

/** Remove a single request, then mirror up. */
export function removeRequest(collectionName, requestId) {
  local.removeRequest(collectionName, requestId)
  syncUp()
}

/** Remove a whole collection, then mirror up. */
export function removeCollection(collectionName) {
  local.removeCollection(collectionName)
  syncUp()
}

/** Import a store map (merge), then mirror up. */
export function importMap(map) {
  local.mergeInto(map)
  syncUp()
}

/** @returns {object} raw store map (for export). */
export function exportMap() {
  return local.getMap()
}
