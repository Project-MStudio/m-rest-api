'use client'

import { memo, useState } from 'react'
import { StatusPill, cls } from './ui'

/** Pretty-print JSON, fall back to raw text. */
function pretty(text) {
  if (typeof text !== 'string') return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function Block({ title, children }) {
  if (!children) return null
  return (
    <div className="mt-2">
      <div className={cls.label}>{title}</div>
      <pre className="mt-1 max-h-[40vh] overflow-auto rounded bg-bg p-2 text-xs font-mono whitespace-pre-wrap break-words">
        {children}
      </pre>
    </div>
  )
}

/**
 * One collapsible log card. Collapsed by default; the body is only
 * pretty-printed when expanded (lazy) so a long list stays cheap.
 * Wrapped in React.memo because the log list can grow to 200 entries.
 *
 * @param {{entry:object}} props
 */
function LogEntry({ entry }) {
  const [open, setOpen] = useState(false)
  const failed = entry.failed

  return (
    <div className={cls.card}>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-muted">{open ? '▼' : '▶'}</span>
        <span className="rounded border border-line px-1.5 py-0.5 text-xs">
          {entry.mode}
        </span>
        <span className="font-mono text-xs text-accent">{entry.method}</span>
        {failed ? (
          <span className="text-xs text-err">FAILED</span>
        ) : (
          <StatusPill status={entry.status} statusText={entry.statusText} />
        )}
        <span className="flex-1 truncate font-mono text-xs text-muted">{entry.url}</span>
        <span className="text-xs text-muted">{Math.round(entry.totalMs)}ms</span>
      </button>

      {open && (
        <div className="border-t border-line px-3 pb-3 pt-1">
          <div className="text-xs text-muted">{entry.timestamp}</div>
          {entry.verdict && (
            <div className="mt-2 rounded bg-bg p-2 text-xs text-err">{entry.verdict}</div>
          )}
          {!failed && (
            <div className="mt-1 text-xs text-muted">
              {entry.size} bytes · {Math.round(entry.totalMs)} ms
            </div>
          )}
          <Block title="Request headers">{pretty(JSON.stringify(entry.sentHeaders))}</Block>
          <Block title="Request body">{entry.sentBody ? pretty(entry.sentBody) : ''}</Block>
          <Block title="Response headers">
            {entry.responseHeaders ? pretty(JSON.stringify(entry.responseHeaders)) : ''}
          </Block>
          <Block title="Response body">{pretty(entry.responseBody)}</Block>
          {entry.error && <Block title="Error">{entry.error}</Block>}
        </div>
      )}
    </div>
  )
}

export default memo(LogEntry)
