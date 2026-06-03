'use client'

import { useState, useRef, useEffect } from 'react'
import { runBenchmark } from '@lib/perf/benchmark'
import { cls } from './ui'

/**
 * Benchmark UI: run the current request N times (1–50), sequential & abortable,
 * then show min/avg/p50/p95/max, success rate, avg size, and a Tailwind bar
 * distribution (no chart library).
 *
 * @param {{mode:'browser'|'server', buildReq:()=>object}} props
 */
export default function BenchmarkPanel({ mode, buildReq }) {
  const [n, setN] = useState(10)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState(null)
  const abortRef = useRef(null)

  // Abort any in-flight benchmark if the panel unmounts (no runaway loop).
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const start = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setProgress(0)
    setStats(null)
    // Benchmarks default to Server mode (stable, no CORS); honor explicit mode otherwise.
    const result = await runBenchmark('server', buildReq(), n, {
      signal: controller.signal,
      onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
    })
    setStats(result)
    setRunning(false)
  }

  const stop = () => abortRef.current?.abort()

  const maxSample = stats ? Math.max(...stats.samples, 1) : 1

  return (
    <div className={`${cls.card} flex flex-col gap-2 p-3`}>
      <div className="flex items-center gap-2">
        <span className={cls.label}>Benchmark (server mode)</span>
        <input
          type="number"
          min={1}
          max={50}
          value={n}
          onChange={(e) => setN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          className={`${cls.input} w-20`}
          disabled={running}
        />
        {running ? (
          <button className={cls.btn} onClick={stop}>
            Stop ({progress}%)
          </button>
        ) : (
          <button className={cls.btnActive} onClick={start}>
            Run
          </button>
        )}
      </div>

      {stats && (
        <div className="flex flex-col gap-2 text-xs">
          <div className="grid grid-cols-3 gap-1 font-mono text-muted">
            <span>min {Math.round(stats.min)}ms</span>
            <span>avg {Math.round(stats.avg)}ms</span>
            <span>max {Math.round(stats.max)}ms</span>
            <span>p50 {Math.round(stats.p50)}ms</span>
            <span>p95 {Math.round(stats.p95)}ms</span>
            <span>n {stats.runs}/{stats.requested}</span>
            <span>ok {Math.round(stats.successRate * 100)}%</span>
            <span>size {Math.round(stats.avgSize)}B</span>
          </div>
          <div className="flex items-end gap-0.5 h-16">
            {stats.samples.map((s, i) => (
              <div
                key={i}
                className="flex-1 bg-fill border-t border-accent/50"
                style={{ height: `${(s / maxSample) * 100}%` }}
                title={`${Math.round(s)}ms`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
