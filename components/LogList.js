'use client'

import LogEntry from './LogEntry'
import { cls } from './ui'

/**
 * Scrollable list of log entries (newest first; capped upstream at 200).
 * @param {{entries:object[], onClear:()=>void}} props
 */
export default function LogList({ entries, onClear }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={cls.label}>Logs ({entries.length})</div>
        <button className={cls.btn} onClick={onClear} disabled={!entries.length}>
          Clear logs
        </button>
      </div>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-auto">
        {entries.length === 0 && (
          <div className="text-sm text-muted">No logs yet.</div>
        )}
        {entries.map((e) => (
          <LogEntry key={e.id} entry={e} />
        ))}
      </div>
    </div>
  )
}
