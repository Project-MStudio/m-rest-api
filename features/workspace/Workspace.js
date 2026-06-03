'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import RequestBar from '@components/RequestBar'
import KeyValueEditor from '@components/KeyValueEditor'
import PathVarsEditor from '@components/PathVarsEditor'
import BodyEditor from '@components/BodyEditor'
import ResponseView from '@components/ResponseView'
import LogList from '@components/LogList'
import BenchmarkPanel from '@components/BenchmarkPanel'
import { SectionLabel, cls } from '@components/ui'
import {
  runRequest,
  extractPathVars,
  detectPathVars,
  requestSignature,
} from '@lib/http/client'
import { diagnoseCors } from '@lib/http/cors'
import { toCurl } from '@lib/http/curl'
import * as storage from '@lib/storage'
import useLogs, { nowStamp } from './useLogs'
import SaveDialog from './SaveDialog'
import CurlImportDialog from './CurlImportDialog'

const emptyRow = () => ({ key: '', value: '', enabled: true })

/** Collection used for auto-saved requests when none exists yet. */
const DEFAULT_COLLECTION = 'Default'

/** Stable id for a saved request, without Date/Math.random. */
let _reqSeq = 0
function newRequestId() {
  _reqSeq += 1
  return `req-${_reqSeq}-${nowStamp()}`
}

/**
 * General HTTP client screen + its state.
 * @param {{toLoad:object|null, onConsumed:()=>void, onSaved:()=>void}} props
 */
export default function Workspace({ toLoad, onConsumed, onSaved }) {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [params, setParams] = useState([emptyRow()])
  const [pathVars, setPathVars] = useState({})
  const [headers, setHeaders] = useState([emptyRow()])
  const [bodyType, setBodyType] = useState('none')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState('browser')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [verdict, setVerdict] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [showCurl, setShowCurl] = useState(false)

  const { logs, addLog, clear } = useLogs('workspace')
  const abortRef = useRef(null)

  // Path-variable names detected in the URL (e.g. ":id"); drives the editor.
  const pathVarNames = useMemo(() => extractPathVars(url), [url])

  // Apply a request object (from a collection or a cURL import) into the builder.
  const applyRequest = useCallback((req) => {
    setMethod(req.method || 'GET')
    setUrl(req.url || '')
    setParams(req.params?.length ? req.params : [emptyRow()])
    setPathVars(req.pathVars || {})
    setHeaders(req.headers?.length ? req.headers : [emptyRow()])
    setBody(req.body || '')
    setBodyType(req.bodyType || (req.body ? 'json' : 'none'))
    if (req.mode) setMode(req.mode)
  }, [])

  // Build the canonical request object used by send, save, curl, benchmark.
  const buildReq = useCallback(
    () => ({
      method,
      url,
      params,
      pathVars,
      headers,
      body: bodyType === 'none' ? '' : body,
      mode,
    }),
    [method, url, params, pathVars, headers, bodyType, body, mode]
  )

  // Load a request from a collection into the builder when the parent asks.
  useEffect(() => {
    if (!toLoad) return
    applyRequest(toLoad)
    onConsumed()
  }, [toLoad, applyRequest, onConsumed])

  // Abort any in-flight request on unmount (cancel + cleanup, no leak).
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // On send, save the request to a collection if its cURL is not already saved.
  // Dedup is by cURL string (ignores mode + empty rows). New requests go to the
  // first existing collection, or a created "Default" collection when none exist.
  const autoSave = useCallback(
    (req) => {
      if (!req.url) return
      // Identity ignores path-variable VALUES, so /decode/:id is ONE entry even
      // as you change the id.
      const sig = requestSignature(req)
      const map = storage.exportMap()
      // Already saved? Update it (latest path-var values) and move to the front.
      for (const col of Object.values(map)) {
        const existing = (col.requests || []).find((r) => requestSignature(r) === sig)
        if (existing) {
          storage.save(col.name, { ...req, id: existing.id, name: existing.name })
          onSaved()
          return
        }
      }
      // New request: add to the first existing collection, or "Default".
      const names = Object.keys(map)
      const target = names.length ? names[0] : DEFAULT_COLLECTION
      storage.save(target, { id: newRequestId(), name: req.url, ...req })
      onSaved()
    },
    [onSaved]
  )

  const send = useCallback(async () => {
    // Cancel the previous in-flight request before starting a new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setBusy(true)
    setVerdict('')
    const req = buildReq()
    autoSave(req) // remember this request in the sidebar
    try {
      const res = await runRequest(mode, req, controller.signal)
      setResult(res)
      addLog({
        timestamp: nowStamp(),
        mode: res.mode,
        method: res.method,
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        totalMs: res.totalMs,
        size: res.size,
        sentHeaders: res.sentHeaders,
        sentBody: res.sentBody,
        responseHeaders: res.responseHeaders,
        responseBody: res.responseBody,
      })
    } catch (e) {
      if (e.name === 'AbortError') {
        setBusy(false)
        return
      }
      // Browser-mode "Failed to fetch" is opaque -> run the CORS diagnostic.
      let v = e.message || 'Request failed'
      if (mode === 'browser') {
        v = await diagnoseCors(req, window.location.origin)
      } else if (e.proxyFailed) {
        v = `Proxy could not reach the host: ${e.message}`
      }
      setVerdict(v)
      setResult(null)
      addLog({
        timestamp: nowStamp(),
        failed: true,
        mode,
        method: req.method,
        url: req.url,
        totalMs: 0,
        sentHeaders: Object.fromEntries(
          req.headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value])
        ),
        sentBody: req.body,
        verdict: v,
        error: e.message,
      })
    } finally {
      setBusy(false)
    }
  }, [mode, buildReq, addLog, autoSave])

  const cancel = () => abortRef.current?.abort()

  // Reset the builder to a blank request.
  const newRequest = () => {
    setMethod('GET')
    setUrl('')
    setParams([emptyRow()])
    setPathVars({})
    setHeaders([emptyRow()])
    setBody('')
    setBodyType('none')
    setResult(null)
    setVerdict('')
  }

  // Apply detected path variables: replace id-like path segments with :name.
  const applyDetected = (rawUrl) => {
    const detected = detectPathVars(rawUrl)
    if (!detected) return false
    setUrl(detected.url)
    setPathVars((prev) => ({ ...prev, ...detected.pathVars }))
    return true
  }

  // Auto-detect when a full URL is pasted, so a real URL with an id baked into
  // the path becomes a :variable immediately (no manual typing of ":id").
  const handleUrlPaste = (e) => {
    const text = (e.clipboardData?.getData('text') || '').trim()
    if (!/^https?:\/\//i.test(text)) return // only whole-URL pastes
    const detected = detectPathVars(text)
    if (!detected) return // nothing id-like -> let the normal paste happen
    e.preventDefault()
    setUrl(detected.url)
    setPathVars((prev) => ({ ...prev, ...detected.pathVars }))
  }

  // Manual trigger for a URL that was typed (not pasted).
  const detectIds = () => applyDetected(url)

  // Copy the current request as a cURL command.
  const copyCurl = async () => {
    const text = toCurl(buildReq())
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt('Copy cURL:', text)
    }
  }

  // Persist from the Save dialog.
  const doSave = (collectionName, name) => {
    storage.save(collectionName, { id: newRequestId(), name, ...buildReq() })
    setShowSave(false)
    onSaved()
  }

  return (
    <div className="flex h-full gap-3">
      {/* Left column: controls */}
      <div
        className="flex flex-col gap-3 overflow-auto pr-1"
        style={{ width: 'clamp(380px, 38%, 520px)' }}
      >
        <RequestBar
          method={method}
          url={url}
          mode={mode}
          busy={busy}
          onMethod={setMethod}
          onUrl={setUrl}
          onMode={setMode}
          onSend={send}
          onCancel={cancel}
          onUrlPaste={handleUrlPaste}
        />

        {/* Hint so the path-variable feature is discoverable. */}
        <div className="text-xs text-muted">
          Tip: paste a real URL (e.g. <span className="font-mono">/decode/abc123</span>) and
          the id becomes a <span className="font-mono text-accent">:variable</span>{' '}
          automatically — or type <span className="font-mono text-accent">:name</span> yourself.
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button className={cls.btn} onClick={newRequest}>
            New
          </button>
          <button className={cls.btn} onClick={detectIds} disabled={!url}>
            Detect IDs
          </button>
          <button className={cls.btn} onClick={() => setShowCurl(true)}>
            Import cURL
          </button>
          <button className={cls.btn} onClick={copyCurl} disabled={!url}>
            Copy cURL
          </button>
          <button className={cls.btn} onClick={() => setShowSave(true)} disabled={!url}>
            Save
          </button>
        </div>

        {pathVarNames.length > 0 && (
          <div>
            <SectionLabel>Path variables</SectionLabel>
            <div className="mt-1">
              <PathVarsEditor
                names={pathVarNames}
                values={pathVars}
                onChange={(name, value) =>
                  setPathVars((prev) => ({ ...prev, [name]: value }))
                }
              />
            </div>
          </div>
        )}

        <div>
          <SectionLabel>Query params</SectionLabel>
          <div className="mt-1">
            <KeyValueEditor rows={params} onChange={setParams} />
          </div>
        </div>

        <div>
          <SectionLabel>Headers</SectionLabel>
          <div className="mt-1">
            <KeyValueEditor rows={headers} onChange={setHeaders} />
          </div>
        </div>

        <div>
          <SectionLabel>Body</SectionLabel>
          <div className="mt-1">
            <BodyEditor
              bodyType={bodyType}
              body={body}
              onTypeChange={setBodyType}
              onBodyChange={setBody}
            />
          </div>
        </div>

        <BenchmarkPanel mode={mode} buildReq={buildReq} />
      </div>

      {/* Right column: response + logs */}
      <div className="flex flex-1 flex-col gap-3 overflow-auto pl-1">
        <ResponseView result={result} verdict={verdict} />
        <LogList entries={logs} onClear={clear} />
      </div>

      <SaveDialog
        open={showSave}
        defaultName={url}
        onClose={() => setShowSave(false)}
        onSave={doSave}
      />
      <CurlImportDialog
        open={showCurl}
        onClose={() => setShowCurl(false)}
        onImport={(req) => {
          applyRequest(req)
          setShowCurl(false)
        }}
      />
    </div>
  )
}
