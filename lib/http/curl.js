/**
 * Convert between the builder's request shape and a cURL command string.
 *  - toCurl(req):  request -> copy-pasteable cURL.
 *  - fromCurl(text): paste a cURL command -> request shape for the builder.
 */

import { buildUrl, headersToObject } from './client'

/** Single-quote a value for a POSIX shell, escaping embedded quotes. */
function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

/**
 * @param {object} req {method,url,params,headers,body}
 * @returns {string} a multi-line cURL command
 */
export function toCurl(req) {
  // Resolve path variables so the copied command is the real, runnable request.
  const url = buildUrl(req.url, req.params, req.pathVars)
  const parts = [`curl -X ${req.method} ${shellQuote(url)}`]

  const headers = headersToObject(req.headers)
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`-H ${shellQuote(`${k}: ${v}`)}`)
  }

  if (req.body && !['GET', 'HEAD'].includes(req.method)) {
    parts.push(`--data ${shellQuote(req.body)}`)
  }

  // Join with backslash-newline so it stays readable when pasted.
  return parts.join(' \\\n  ')
}

/**
 * Tokenize a shell-ish command, honoring single quotes (literal), double quotes
 * (with backslash escapes), backslash escapes, and backslash-newline line
 * continuations. Good enough for the cURL commands tools generate.
 * @param {string} input
 * @returns {string[]}
 */
function tokenize(input) {
  const tokens = []
  const s = input
  let i = 0
  while (i < s.length) {
    // Skip whitespace and line continuations between tokens.
    if (/\s/.test(s[i])) {
      i++
      continue
    }
    if (s[i] === '\\' && (s[i + 1] === '\n' || s[i + 1] === '\r')) {
      i += 2
      continue
    }

    let token = ''
    while (i < s.length && !/\s/.test(s[i])) {
      const ch = s[i]
      if (ch === '\\') {
        // Line continuation inside a token, or an escaped char.
        if (s[i + 1] === '\n' || s[i + 1] === '\r') {
          i += 2
          continue
        }
        token += s[i + 1] ?? ''
        i += 2
        continue
      }
      if (ch === "'") {
        // Single quotes: everything literal until the next single quote.
        i++
        while (i < s.length && s[i] !== "'") {
          token += s[i]
          i++
        }
        i++ // skip closing quote
        continue
      }
      if (ch === '"') {
        // Double quotes: allow backslash escapes.
        i++
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\') {
            token += s[i + 1] ?? ''
            i += 2
            continue
          }
          token += s[i]
          i++
        }
        i++ // skip closing quote
        continue
      }
      token += ch
      i++
    }
    tokens.push(token)
  }
  return tokens
}

/** Split a URL into its base and query-param rows. */
function splitUrl(raw) {
  const q = raw.indexOf('?')
  if (q === -1) return { base: raw, params: [] }
  const base = raw.slice(0, q)
  const params = raw
    .slice(q + 1)
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=')
      const key = eq === -1 ? pair : pair.slice(0, eq)
      const value = eq === -1 ? '' : pair.slice(eq + 1)
      return { key: safeDecode(key), value: safeDecode(value), enabled: true }
    })
  return { base, params }
}

/** decodeURIComponent that never throws on malformed input. */
function safeDecode(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Guess the body editor mode from the body content. */
function guessBodyType(body) {
  const t = body.trim()
  return t.startsWith('{') || t.startsWith('[') ? 'json' : 'raw'
}

const DATA_FLAGS = new Set([
  '-d',
  '--data',
  '--data-raw',
  '--data-binary',
  '--data-ascii',
  '--data-urlencode',
])

// Boolean flags (no value) we can safely ignore when parsing.
const SKIP_FLAGS = new Set([
  '--compressed',
  '-L',
  '--location',
  '-s',
  '--silent',
  '-S',
  '-k',
  '--insecure',
  '-i',
  '--include',
  '-v',
  '--verbose',
  '-g',
  '--globoff',
  '-#',
])

/**
 * Parse a cURL command into the builder's request shape.
 * @param {string} text
 * @returns {{method,url,params,headers,body,bodyType,mode}}
 */
export function fromCurl(text) {
  const tokens = tokenize(text || '')
  if (tokens[0] && tokens[0].toLowerCase() === 'curl') tokens.shift()

  let method = ''
  let url = ''
  let body = ''
  const headers = []

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    if (t === '-X' || t === '--request') {
      method = (tokens[++i] || '').toUpperCase()
      continue
    }
    if (t === '-H' || t === '--header') {
      const h = tokens[++i] || ''
      const idx = h.indexOf(':')
      if (idx > -1) {
        headers.push({
          key: h.slice(0, idx).trim(),
          value: h.slice(idx + 1).trim(),
          enabled: true,
        })
      }
      continue
    }
    if (DATA_FLAGS.has(t)) {
      // Concatenate multiple --data flags with & like curl does.
      const chunk = tokens[++i] || ''
      body = body ? `${body}&${chunk}` : chunk
      continue
    }
    if (t === '--url') {
      url = tokens[++i] || ''
      continue
    }
    if (t === '-u' || t === '--user') {
      // Basic auth -> Authorization header.
      const cred = tokens[++i] || ''
      headers.push({
        key: 'Authorization',
        value: `Basic ${typeof btoa === 'function' ? btoa(cred) : cred}`,
        enabled: true,
      })
      continue
    }
    if (SKIP_FLAGS.has(t)) continue
    if (t.startsWith('-')) {
      // Unknown flag: if the next token looks like its value, consume it too.
      if (tokens[i + 1] && !tokens[i + 1].startsWith('-')) i++
      continue
    }
    // A bare token is the URL.
    if (!url) url = t
  }

  // curl defaults to POST when a body is present and no method was given.
  if (!method) method = body ? 'POST' : 'GET'

  const { base, params } = splitUrl(url)
  return {
    method,
    url: base,
    params,
    headers,
    body,
    bodyType: body ? guessBodyType(body) : 'none',
    mode: 'browser',
  }
}
