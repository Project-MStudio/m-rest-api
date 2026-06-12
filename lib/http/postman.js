/**
 * Convert a Postman v2.1 collection JSON into the builder's store map so its
 * requests can be imported and run like any other saved request.
 *
 * Postman template variables ({{access_token}}, ...) are kept as literal text;
 * the import is offline and resolves nothing.
 */

import { splitUrl, guessBodyType } from './curl'

/** Rebuild a URL string from a Postman url object when there is no raw form. */
function rebuildUrl(url) {
  const protocol = url.protocol ? `${url.protocol}://` : ''
  const host = Array.isArray(url.host) ? url.host.join('.') : url.host || ''
  const path = Array.isArray(url.path) ? url.path.join('/') : url.path || ''
  return `${protocol}${host}${path ? `/${path}` : ''}`
}

/** Postman url -> {url, params}, reusing curl's query splitter. */
function convertUrl(url) {
  if (!url) return { url: '', params: [] }
  const raw = typeof url === 'string' ? url : url.raw || rebuildUrl(url)
  const { base, params } = splitUrl(raw)
  return { url: base, params }
}

/** Postman header[] -> [{key, value, enabled}]. */
function convertHeaders(header) {
  return (header || []).map((h) => ({
    key: h.key,
    value: h.value ?? '',
    enabled: !h.disabled,
  }))
}

/** Join enabled key=value pairs into a urlencoded-style body string. */
function joinPairs(pairs) {
  return (pairs || [])
    .filter((p) => !p.disabled)
    .map((p) => `${p.key}=${p.value ?? ''}`)
    .join('&')
}

/** Postman body -> {body, bodyType} per the request method and body mode. */
function convertBody(method, body) {
  if (['GET', 'HEAD'].includes(method) || !body || !body.mode || body.mode === 'none') {
    return { body: '', bodyType: 'none' }
  }
  if (body.mode === 'raw') {
    const raw = body.raw || ''
    return { body: raw, bodyType: guessBodyType(raw) }
  }
  if (body.mode === 'urlencoded') {
    return { body: joinPairs(body.urlencoded), bodyType: 'raw' }
  }
  if (body.mode === 'formdata') {
    // Only text fields survive; file parts can't be carried offline.
    const text = (body.formdata || []).filter((p) => p.type !== 'file')
    return { body: joinPairs(text), bodyType: 'raw' }
  }
  return { body: '', bodyType: 'none' }
}

/**
 * Walk Postman item[] depth-first, collecting leaf requests with their
 * folder-prefixed names (e.g. "Auth / Get Access Token").
 */
function walk(items, prefix, out) {
  for (const item of items || []) {
    const name = prefix ? `${prefix} / ${item.name}` : item.name
    if (Array.isArray(item.item)) {
      walk(item.item, name, out)
    } else if (item.request) {
      out.push({ name, request: item.request })
    }
  }
}

/** Convert one leaf request into the builder's request shape. */
function toRequest(leaf, i) {
  const r = leaf.request
  const method = (r.method || 'GET').toUpperCase()
  const { url, params } = convertUrl(r.url)
  const { body, bodyType } = convertBody(method, r.body)
  return {
    id: `pm-${i}`,
    name: leaf.name,
    method,
    url,
    params,
    headers: convertHeaders(r.header),
    body,
    bodyType,
    mode: 'browser',
  }
}

/**
 * Convert a parsed Postman v2.1 collection into a store map keyed by name.
 * @param {object} json the parsed collection JSON
 * @returns {object} { [collectionName]: { name, requests:[...] } }
 */
export function fromPostmanCollection(json) {
  const name = (json && json.info && json.info.name) || 'Imported'
  const leaves = []
  walk(json && json.item, '', leaves)
  const requests = leaves.map((leaf, i) => toRequest(leaf, i))
  return { [name]: { name, requests } }
}
