/**
 * Server proxy route. Forwards a request server-side so there is NO browser CORS
 * (like Postman), and — crucially — it can set headers the browser forbids,
 * notably User-Agent. This is why the FCM decode call must go through here:
 * the browser silently drops a client-set User-Agent, the server does not.
 */

export const runtime = 'nodejs'

// Hop-by-hop / unsafe headers we must not forward verbatim from the client.
const SKIP = new Set(['host', 'content-length', 'connection'])

export async function POST(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON in proxy request' }, { status: 400 })
  }

  const { method = 'GET', url, headers = {}, body } = payload
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 })

  // Rebuild the outgoing headers, forwarding everything (incl. User-Agent).
  const outHeaders = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!SKIP.has(k.toLowerCase())) outHeaders[k] = v
  }

  const hasBody = body != null && !['GET', 'HEAD'].includes(method.toUpperCase())

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method,
      headers: outHeaders,
      body: hasBody ? body : undefined,
      redirect: 'follow',
    })
    const text = await res.text()
    const serverMs = Date.now() - start

    // Flatten response headers for logging.
    const respHeaders = {}
    res.headers.forEach((value, key) => {
      respHeaders[key] = value
    })

    return Response.json({
      status: res.status,
      statusText: res.statusText,
      headers: respHeaders,
      body: text,
      serverMs,
    })
  } catch (e) {
    // Host down / DNS failure / wrong URL — report so the CORS diagnostic can
    // tell "not CORS, the host is just unreachable" apart from a real CORS block.
    return Response.json({ error: e.message || 'Proxy request failed' }, { status: 502 })
  }
}
