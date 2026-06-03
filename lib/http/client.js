/**
 * HTTP client core. Two honest execution paths:
 *  - runBrowser: a real client-side fetch() from the page origin, so CORS /
 *    preflight / mixed-content behave EXACTLY like a real React app would.
 *  - runServer:  the request is forwarded by our Next.js route handler, so there
 *    is no CORS (like Postman) and we can set headers the browser forbids
 *    (e.g. User-Agent).
 *
 * Both return the same normalized shape so the UI/log code never branches on mode.
 */

/** Max bytes of a response body we keep in memory (cap Chrome RAM). */
export const MAX_BODY_BYTES = 256 * 1024

// Path-variable pattern: a ":" followed by a NAME (must start with a letter or
// underscore). This deliberately ignores a port like ":7981" since that starts
// with a digit, and protocol "://" since ":" is followed by "/".
const PATH_VAR_RE = /:([A-Za-z_]\w*)/g

/**
 * Replace ":name" path variables in a URL with their values (URL-encoded).
 * An unfilled variable is left as-is so it stays visible.
 * @param {string} url
 * @param {Record<string,string>|null} pathVars
 * @returns {string}
 */
export function applyPathVars(url, pathVars) {
  if (!pathVars) return url
  return url.replace(PATH_VAR_RE, (match, name) => {
    const v = pathVars[name]
    return v != null && v !== '' ? encodeURIComponent(v) : match
  })
}

/**
 * Extract the distinct path-variable names from a URL template (e.g. ":id").
 * @param {string} url
 * @returns {string[]}
 */
export function extractPathVars(url) {
  const names = []
  const re = new RegExp(PATH_VAR_RE) // fresh instance so lastIndex is local
  let m
  while ((m = re.exec(url || ''))) {
    if (!names.includes(m[1])) names.push(m[1])
  }
  return names
}

/**
 * Heuristic: does a path segment look like a dynamic id (so it should become a
 * path variable)? Matches UUIDs, numeric ids, long opaque tokens, and
 * medium-length tokens that mix letters AND digits. Plain words like "decode",
 * "fcm", "best-lineup", or a version like "v1" are NOT treated as ids.
 * @param {string} seg
 * @returns {boolean}
 */
function isIdLike(seg) {
  if (!seg || seg.startsWith(':')) return false // empty or already a variable
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return true // UUID
  if (/^\d+$/.test(seg)) return true // numeric id
  if (/^[A-Za-z0-9_]+$/.test(seg) && seg.length >= 12) return true // long opaque token
  // medium token that mixes letters and digits (e.g. "abc123def")
  if (/^[A-Za-z0-9_]+$/.test(seg) && seg.length >= 8 && /[A-Za-z]/.test(seg) && /\d/.test(seg)) {
    return true
  }
  return false
}

/**
 * Recognize a concrete URL that bakes ids into its path and turn those segments
 * into ":name" path variables, returning the templated URL plus the extracted
 * values. So pasting ".../decode/qlg0d47vnvxb82a" yields ".../decode/:id" with
 * { id: "qlg0d47vnvxb82a" }. Returns null when nothing id-like is found.
 * @param {string} rawUrl
 * @returns {{url:string, pathVars:Record<string,string>}|null}
 */
export function detectPathVars(rawUrl) {
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    return null // not a full URL (e.g. still being typed)
  }
  const existing = new Set(extractPathVars(rawUrl))
  const pathVars = {}
  let changed = false

  // Pick a unique variable name (id, id2, id3, ...) avoiding collisions.
  const freshName = () => {
    let n = 1
    let name = 'id'
    while (existing.has(name) || name in pathVars) {
      n += 1
      name = `id${n}`
    }
    return name
  }

  const newSegments = u.pathname.split('/').map((seg) => {
    if (!isIdLike(seg)) return seg
    const name = freshName()
    pathVars[name] = safeDecodeSegment(seg)
    existing.add(name)
    changed = true
    return `:${name}`
  })

  if (!changed) return null
  // Rebuild without u.toString() so the ":" in ":id" is preserved verbatim.
  return { url: `${u.origin}${newSegments.join('/')}${u.search}`, pathVars }
}

/** decodeURIComponent that never throws, for storing the human-readable value. */
function safeDecodeSegment(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Build the final URL: substitute path variables, then append enabled
 * query-param rows.
 * @param {string} url
 * @param {Array<{key:string,value:string,enabled:boolean}>} params
 * @param {Record<string,string>|null} [pathVars]
 * @returns {string}
 */
export function buildUrl(url, params = [], pathVars = null) {
  const resolved = applyPathVars(url, pathVars)
  const enabled = (params || []).filter((p) => p.enabled && p.key)
  if (!enabled.length) return resolved
  // Append params manually so we don't choke on not-yet-valid URLs while typing.
  const qs = enabled
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value ?? '')}`)
    .join('&')
  return resolved.includes('?') ? `${resolved}&${qs}` : `${resolved}?${qs}`
}

/**
 * A stable identity for a request that IGNORES path-variable values, so the
 * same endpoint template (e.g. /decode/:id) maps to one saved entry even as you
 * change the id. Used for auto-save dedup.
 * @param {object} req {method,url,params,body}
 * @returns {string}
 */
export function requestSignature(req) {
  const url = buildUrl(req.url, req.params) // no pathVars -> keeps ":id" literal
  return `${req.method} ${url} ${req.body || ''}`
}

/**
 * Turn enabled header rows into a plain object.
 * @param {Array<{key:string,value:string,enabled:boolean}>} headers
 * @returns {Record<string,string>}
 */
export function headersToObject(headers = []) {
  const out = {}
  for (const h of headers) {
    if (h.enabled && h.key) out[h.key] = h.value ?? ''
  }
  return out
}

/** Truncate a string to MAX_BODY_BYTES and flag it, to avoid retaining huge payloads. */
function capBody(text) {
  if (typeof text !== 'string') return { body: '', truncated: false }
  // Byte length, not char length, so multibyte content is measured honestly.
  const bytes = new TextEncoder().encode(text).length
  if (bytes <= MAX_BODY_BYTES) return { body: text, truncated: false, size: bytes }
  const kept = text.slice(0, MAX_BODY_BYTES)
  return {
    body: `${kept}\n\n[truncated, ${Math.round(bytes / 1024)} KB total]`,
    truncated: true,
    size: bytes,
  }
}

/** Collect Headers into a plain object for logging. */
function responseHeaders(res) {
  const out = {}
  res.headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

/**
 * Resource Timing breakdown — only available when the target sends
 * Timing-Allow-Origin. Otherwise the browser hides the phases for privacy.
 * @param {string} fullUrl
 * @returns {object|null}
 */
function timingBreakdown(fullUrl) {
  try {
    const entries = performance.getEntriesByName(fullUrl)
    const e = entries[entries.length - 1]
    if (!e) return null
    // If these are all zero the server did not send Timing-Allow-Origin.
    if (!e.domainLookupEnd && !e.connectEnd && !e.responseStart) return null
    return {
      dns: e.domainLookupEnd - e.domainLookupStart,
      tcp: e.connectEnd - e.connectStart,
      ttfb: e.responseStart - e.requestStart,
      download: e.responseEnd - e.responseStart,
    }
  } catch {
    return null
  }
}

/**
 * Run a request from the browser (real CORS).
 * @param {object} req {method,url,params,headers,body}
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>} normalized result
 */
export async function runBrowser(req, signal) {
  const fullUrl = buildUrl(req.url, req.params, req.pathVars)
  const sentHeaders = headersToObject(req.headers)
  const hasBody = req.body && !['GET', 'HEAD'].includes(req.method)

  // Clear old timing entries so we read only this request's measurement.
  try {
    performance.clearResourceTimings()
  } catch {}

  const start = performance.now()
  const res = await fetch(fullUrl, {
    method: req.method,
    headers: sentHeaders,
    body: hasBody ? req.body : undefined,
    signal,
  })
  const text = await res.text()
  const total = performance.now() - start
  const { body, truncated, size } = capBody(text)

  return {
    ok: res.ok,
    mode: 'browser',
    method: req.method,
    url: fullUrl,
    status: res.status,
    statusText: res.statusText,
    totalMs: total,
    size: size ?? new TextEncoder().encode(text).length,
    truncated,
    sentHeaders,
    sentBody: hasBody ? req.body : '',
    responseHeaders: responseHeaders(res),
    responseBody: body,
    timing: timingBreakdown(fullUrl),
  }
}

/**
 * Run a request through our server proxy (no CORS; can set forbidden headers).
 * @param {object} req {method,url,params,headers,body}
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>} normalized result
 */
export async function runServer(req, signal) {
  const fullUrl = buildUrl(req.url, req.params, req.pathVars)
  const sentHeaders = headersToObject(req.headers)
  const hasBody = req.body && !['GET', 'HEAD'].includes(req.method)

  const start = performance.now()
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: req.method,
      url: fullUrl,
      headers: sentHeaders,
      body: hasBody ? req.body : undefined,
    }),
    signal,
  })
  const total = performance.now() - start
  const payload = await res.json()

  if (payload.error) {
    // Proxy could not reach the target (host down / wrong URL).
    const e = new Error(payload.error)
    e.proxyFailed = true
    throw e
  }

  const { body, truncated, size } = capBody(payload.body ?? '')
  return {
    ok: payload.status >= 200 && payload.status < 300,
    mode: 'server',
    method: req.method,
    url: fullUrl,
    status: payload.status,
    statusText: payload.statusText || '',
    // Prefer the server-measured time; fall back to round-trip if missing.
    totalMs: payload.serverMs ?? total,
    size: size ?? 0,
    truncated,
    sentHeaders,
    sentBody: hasBody ? req.body : '',
    responseHeaders: payload.headers || {},
    responseBody: body,
    timing: null, // breakdown is browser-only (Resource Timing API)
  }
}

/**
 * Dispatch by mode. Always uses an AbortSignal so callers can cancel.
 * @param {'browser'|'server'} mode
 * @param {object} req
 * @param {AbortSignal} [signal]
 */
export function runRequest(mode, req, signal) {
  return mode === 'server' ? runServer(req, signal) : runBrowser(req, signal)
}
