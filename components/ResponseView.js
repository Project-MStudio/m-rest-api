'use client'

import { StatusPill, cls } from './ui'

/** Pretty-print JSON, fall back to raw text. */
function pretty(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

/**
 * Summary view of the most recent response (full detail lives in the log).
 * @param {{result:object|null, verdict:string}} props
 */
export default function ResponseView({ result, verdict }) {
  if (verdict && !result) {
    return (
      <div className={`${cls.card} p-3 text-sm text-err`}>
        <div className="font-semibold mb-1">Request failed</div>
        <div>{verdict}</div>
      </div>
    )
  }
  if (!result) {
    return <div className="text-sm text-muted">No response yet. Send a request.</div>
  }

  const t = result.timing
  return (
    <div className={`${cls.card} p-3 flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusPill status={result.status} statusText={result.statusText} />
        <span className="text-muted">{Math.round(result.totalMs)} ms</span>
        <span className="text-muted">{result.size} bytes</span>
        <span className="text-muted">[{result.mode}]</span>
      </div>

      {t ? (
        <div className="text-xs text-muted font-mono">
          DNS {Math.round(t.dns)}ms · TCP {Math.round(t.tcp)}ms · TTFB{' '}
          {Math.round(t.ttfb)}ms · DL {Math.round(t.download)}ms
        </div>
      ) : (
        <div className="text-xs text-muted">
          Timing breakdown not exposed by server (no Timing-Allow-Origin).
        </div>
      )}

      {verdict && <div className="text-xs text-err">{verdict}</div>}

      <pre className="max-h-[40vh] overflow-auto rounded bg-bg p-2 text-xs font-mono whitespace-pre-wrap break-words">
        {pretty(result.responseBody)}
      </pre>
    </div>
  )
}
