/**
 * CORS inspection route for the diagnostic. Given a target url + method + the
 * browser origin + the request's header names, we send an OPTIONS preflight
 * (mimicking what the browser does) and also a plain request, then report the
 * target's Access-Control-* response headers back to the client.
 *
 * The browser hides these values from a failed fetch for security; the server
 * can read them freely. lib/http/cors.js turns this raw data into a verdict.
 */

export const runtime = 'nodejs'

export async function POST(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return Response.json({ reachable: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { url, method = 'GET', origin = '', headers = [] } = payload
  if (!url) return Response.json({ reachable: false, error: 'Missing url' }, { status: 400 })

  try {
    // Send a preflight OPTIONS exactly as the browser would for a non-simple request.
    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': headers.join(', '),
      },
    })

    // Some servers only set CORS headers on the actual response, not OPTIONS.
    // Do a lightweight GET with Origin as a fallback source of the headers.
    let actual = null
    try {
      actual = await fetch(url, { method: 'GET', headers: { Origin: origin } })
    } catch {
      actual = null
    }

    const pick = (name) =>
      preflight.headers.get(name) || (actual && actual.headers.get(name)) || ''

    return Response.json({
      reachable: true,
      allowOrigin: pick('access-control-allow-origin'),
      allowMethods: pick('access-control-allow-methods'),
      allowHeaders: pick('access-control-allow-headers'),
      allowCredentials: pick('access-control-allow-credentials'),
    })
  } catch (e) {
    // If the server itself can't reach the host, it is not a CORS problem.
    return Response.json({ reachable: false, error: e.message || 'unreachable' })
  }
}
