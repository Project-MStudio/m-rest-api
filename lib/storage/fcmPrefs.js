/**
 * Persist FCM screen preferences (domain) across reloads and tab switches.
 */

const DOMAIN_KEY = 'mrestapi.fcm.domain'

/** @returns {string} last saved FCM domain, or '' if none. */
export function loadFcmDomain() {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(DOMAIN_KEY) || ''
  } catch {
    return ''
  }
}

/** Save or clear the FCM domain. */
export function saveFcmDomain(domain) {
  if (typeof window === 'undefined') return
  try {
    if (domain) localStorage.setItem(DOMAIN_KEY, domain)
    else localStorage.removeItem(DOMAIN_KEY)
  } catch {}
}
