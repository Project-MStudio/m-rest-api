/**
 * Decode-response parsing for the FCM tab.
 *
 * IMPORTANT: the decode endpoint
 *   GET https://opta-api.uniscore.vn/api/v1/decode/{code}
 * returns a PLAIN ID STRING (e.g. "nkb1x23ofvua33u"), NOT JSON. But to be
 * defensive we also accept a JSON object that wraps the id. extractMatchId()
 * handles both shapes.
 */

/**
 * @param {string} raw  the raw response body text from the decode call
 * @returns {string} the match id, or '' if nothing usable was found
 */
export function extractMatchId(raw) {
  if (raw == null) return ''
  const text = String(raw).trim()
  if (!text) return ''

  // Try JSON first; many shapes are possible if the API ever changes.
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string') return parsed.trim()
    if (parsed && typeof parsed === 'object') {
      // Common id field names, checked in order.
      const candidate =
        parsed.matchId || parsed.id || parsed.data?.matchId || parsed.data?.id
      if (typeof candidate === 'string') return candidate.trim()
    }
  } catch {
    // Not JSON — this is the EXPECTED case: the body is the bare id string.
    // Strip any accidental surrounding quotes.
    return text.replace(/^"(.*)"$/, '$1')
  }

  return ''
}

/** The decode host is fixed (third-party), independent of the send version. */
export const DECODE_URL = 'https://opta-api.uniscore.vn/api/v1/decode/'

/** The proxy must send this User-Agent; the browser cannot set it client-side. */
export const DECODE_USER_AGENT = 'insomnia/11.0.2'
