/**
 * CORS diagnostic. When a Browser-mode fetch fails it throws an opaque
 * "TypeError: Failed to fetch" with no detail (the browser hides the cause for
 * security). We ask our /api/cors-check route what the target actually returns
 * for Access-Control-* headers, compare it against the request's origin / method
 * / headers, and produce a plain-English verdict naming the exact missing header
 * and the fix line the backend must add.
 */

import { headersToObject, buildUrl } from './client'

/**
 * Ask the server route to inspect the target's CORS headers, then build a verdict.
 * @param {object} req {method,url,params,headers}
 * @param {string} origin window.location.origin
 * @returns {Promise<string>} A2-level verdict text.
 */
export async function diagnoseCors(req, origin) {
  const fullUrl = buildUrl(req.url, req.params, req.pathVars)
  const sent = headersToObject(req.headers)

  let info
  try {
    const res = await fetch('/api/cors-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: fullUrl,
        method: req.method,
        origin,
        headers: Object.keys(sent),
      }),
    })
    info = await res.json()
  } catch {
    return 'Could not run CORS check (cors-check route unreachable).'
  }

  return buildVerdict(info, req.method, origin, Object.keys(sent))
}

/**
 * Turn the inspected CORS headers into a single, actionable verdict.
 * @param {object} info {reachable, allowOrigin, allowMethods, allowHeaders, allowCredentials}
 * @param {string} method
 * @param {string} origin
 * @param {string[]} requestHeaderNames
 * @returns {string}
 */
export function buildVerdict(info, method, origin, requestHeaderNames) {
  // If the proxy itself could not reach the host, it is not a CORS problem.
  if (!info || info.reachable === false) {
    return 'Not CORS: server proxy also failed -> host down or wrong URL.'
  }

  const allowOrigin = info.allowOrigin || ''
  // 1) Missing Access-Control-Allow-Origin entirely.
  if (!allowOrigin) {
    return `CORS blocked: no Access-Control-Allow-Origin. Backend must add: Access-Control-Allow-Origin: ${origin}`
  }
  // 2) Present but does not match our origin (and is not the wildcard).
  if (allowOrigin !== '*' && allowOrigin !== origin) {
    return `CORS blocked: Access-Control-Allow-Origin is "${allowOrigin}", not your origin. Backend must add: Access-Control-Allow-Origin: ${origin}`
  }

  // 3) Method not allowed.
  const allowMethods = (info.allowMethods || '').toUpperCase()
  if (allowMethods && !allowMethods.includes(method.toUpperCase())) {
    return `CORS blocked: method ${method} not in Access-Control-Allow-Methods (${info.allowMethods}).`
  }

  // 4) A custom request header not allowed.
  const allowHeaders = (info.allowHeaders || '').toLowerCase()
  const simple = ['accept', 'accept-language', 'content-language', 'content-type']
  for (const name of requestHeaderNames) {
    const lower = name.toLowerCase()
    if (simple.includes(lower)) continue // simple headers never need allow-listing
    if (allowHeaders !== '*' && !allowHeaders.split(/[,\s]+/).includes(lower)) {
      return `CORS blocked: header ${lower} not in Access-Control-Allow-Headers. Backend must add: Access-Control-Allow-Headers: ${name}`
    }
  }

  // 5) Credentials + wildcard origin is an invalid combination the browser rejects.
  if (info.allowCredentials === 'true' && allowOrigin === '*') {
    return 'CORS blocked: Access-Control-Allow-Credentials is true but Allow-Origin is "*". Backend must echo the exact origin instead of "*".'
  }

  // Reached here: headers look fine to us, so the failure was likely network/mixed-content.
  return 'Browser fetch failed but CORS headers look correct. Check mixed content (http vs https) or a network/TLS error.'
}
