'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadLogs, saveLogs, clearLogs } from '@lib/storage/logs'

/** Hard cap so the in-memory log list cannot grow unbounded (RAM hygiene). */
const MAX_LOGS = 200

/**
 * Hook owning a capped, newest-first log list that is persisted to localStorage
 * per channel (e.g. 'workspace', 'fcm') so logs survive a reload.
 *
 * @param {string} channel storage namespace for this log list
 * @returns {{logs, addLog, clear}}
 */
export default function useLogs(channel = 'default') {
  const [logs, setLogs] = useState([])
  // Monotonic id counter (no Date/Math.random); seeded past loaded ids on load.
  const seqRef = useRef(0)
  // Gate persistence until the initial load finished, so we never overwrite the
  // stored logs with the empty initial state during hydration.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = loadLogs(channel)
    if (saved.length) {
      // Continue the id sequence past the highest loaded id to avoid collisions.
      const maxN = saved.reduce((m, e) => {
        const n = parseInt(String(e.id).replace(/\D/g, ''), 10)
        return Number.isFinite(n) && n > m ? n : m
      }, 0)
      seqRef.current = maxN
      setLogs(saved)
    }
    setHydrated(true)
  }, [channel])

  useEffect(() => {
    if (!hydrated) return
    saveLogs(channel, logs)
  }, [channel, logs, hydrated])

  const addLog = useCallback((entry) => {
    seqRef.current += 1
    const withId = { id: `log-${seqRef.current}`, ...entry }
    // Prepend (newest on top) and drop the oldest beyond the cap.
    setLogs((prev) => [withId, ...prev].slice(0, MAX_LOGS))
  }, [])

  const clear = useCallback(() => {
    setLogs([])
    clearLogs(channel)
  }, [channel])

  return { logs, addLog, clear }
}

/** Build a timestamp string from the runtime clock (called at log time only). */
export function nowStamp() {
  return new Date().toLocaleTimeString()
}
