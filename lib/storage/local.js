/**
 * localStorage backend for collections. This is the default, always-available
 * store. The app is 100% functional offline through this module alone.
 *
 * Shape: { [collectionName]: { name, requests: [{ id, name, method, url,
 *          params, headers, body, mode }] } }
 */

const KEY = 'mrestapi.collections.v1'

/** Read the whole store object. Returns {} on any parse error. */
function readAll() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

/** Persist the whole store object. */
function writeAll(obj) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(obj))
}

/** @returns {Array<{name,requests}>} all collections as a list. */
export function list() {
  return Object.values(readAll())
}

/** @returns {object} the raw store keyed by collection name. */
export function getMap() {
  return readAll()
}

/**
 * Save a request into a collection (creates the collection if missing).
 * @param {string} collectionName
 * @param {object} request
 */
export function save(collectionName, request) {
  const all = readAll()
  const col = all[collectionName] || { name: collectionName, requests: [] }
  // Most-recent-first: drop any existing entry with this id, then put it at the
  // front, and float this collection to the top of the list too.
  col.requests = col.requests.filter((r) => r.id !== request.id)
  col.requests.unshift(request)
  const { [collectionName]: _omit, ...rest } = all
  writeAll({ [collectionName]: col, ...rest })
  return col
}

/**
 * Move an existing request to the front of its collection (and float the
 * collection to the top) — used when a saved request is re-sent.
 */
export function touch(collectionName, requestId) {
  const all = readAll()
  const col = all[collectionName]
  if (!col) return
  const idx = col.requests.findIndex((r) => r.id === requestId)
  if (idx === -1) return
  if (idx > 0) {
    const [item] = col.requests.splice(idx, 1)
    col.requests.unshift(item)
  }
  const { [collectionName]: _omit, ...rest } = all
  writeAll({ [collectionName]: col, ...rest })
}

/** Remove a single request from a collection. */
export function removeRequest(collectionName, requestId) {
  const all = readAll()
  const col = all[collectionName]
  if (!col) return
  col.requests = col.requests.filter((r) => r.id !== requestId)
  all[collectionName] = col
  writeAll(all)
}

/** Remove an entire collection. */
export function removeCollection(collectionName) {
  const all = readAll()
  delete all[collectionName]
  writeAll(all)
}

/** Replace the entire store (used by import and by cloud merge). */
export function replaceAll(map) {
  writeAll(map || {})
}

/**
 * Merge another store map into local (union of requests by id).
 * @param {object} incoming
 * @returns {object} merged map
 */
export function mergeInto(incoming) {
  const all = readAll()
  for (const [name, col] of Object.entries(incoming || {})) {
    const existing = all[name] || { name, requests: [] }
    const byId = new Map(existing.requests.map((r) => [r.id, r]))
    for (const r of col.requests || []) byId.set(r.id, r)
    all[name] = { name, requests: [...byId.values()] }
  }
  writeAll(all)
  return all
}
