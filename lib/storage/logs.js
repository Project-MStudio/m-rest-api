/**
 * Persist the log list to localStorage so it survives a page reload.
 *
 * Logs can be heavy (response bodies up to ~256 KB each, up to 200 entries),
 * which would blow the ~5 MB localStorage quota. So for storage we keep fewer
 * entries and truncate bodies, and on a quota error we drop the oldest entries
 * and retry. Each tab uses its own channel key so they do not clobber.
 */

const PREFIX = 'mrestapi.logs.'
/** Max entries kept in localStorage (in-memory cap is higher). */
const MAX_PERSIST = 100
/** Max bytes of each body kept in localStorage. */
const BODY_CAP = 10 * 1024

/** Truncate a string body for storage, flagging when cut. */
function capBody(s) {
  if (typeof s !== 'string') return s
  return s.length > BODY_CAP ? `${s.slice(0, BODY_CAP)}\n[stored copy truncated]` : s
}

/** A lighter copy of a log entry for storage (big bodies trimmed). */
function trimForStore(e) {
  return { ...e, responseBody: capBody(e.responseBody), sentBody: capBody(e.sentBody) }
}

/**
 * Load persisted logs for a channel.
 * @param {string} channel
 * @returns {object[]}
 */
export function loadLogs(channel) {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PREFIX + channel)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Persist logs for a channel. Shrinks on quota errors instead of throwing.
 * @param {string} channel
 * @param {object[]} logs newest-first
 */
export function saveLogs(channel, logs) {
  if (typeof window === 'undefined') return
  let slice = logs.slice(0, MAX_PERSIST).map(trimForStore)
  while (slice.length) {
    try {
      localStorage.setItem(PREFIX + channel, JSON.stringify(slice))
      return
    } catch {
      // Quota exceeded: drop the oldest quarter and retry.
      slice = slice.slice(0, Math.floor(slice.length * 0.75))
    }
  }
  try {
    localStorage.removeItem(PREFIX + channel)
  } catch {}
}

/** Clear persisted logs for a channel. */
export function clearLogs(channel) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PREFIX + channel)
  } catch {}
}
