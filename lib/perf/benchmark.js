/**
 * Benchmark: run the current request N times sequentially and report stats.
 * Bounded (N <= 50) and abortable so it can never become a runaway loop.
 */

import { runRequest } from '@lib/http/client'

const MAX_N = 50

/** Percentile of a sorted numeric array (linear interpolation). */
function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * @param {'browser'|'server'} mode
 * @param {object} req
 * @param {number} n  1..50
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]            abort the whole run
 * @param {(done:number,total:number)=>void} [opts.onProgress]
 * @returns {Promise<object>} stats
 */
export async function runBenchmark(mode, req, n, opts = {}) {
  const count = Math.max(1, Math.min(MAX_N, Math.floor(n) || 1))
  const times = []
  const sizes = []
  let ok = 0

  for (let i = 0; i < count; i++) {
    if (opts.signal?.aborted) break // honor cancel between iterations
    try {
      const r = await runRequest(mode, req, opts.signal)
      times.push(r.totalMs)
      sizes.push(r.size || 0)
      if (r.ok) ok++
    } catch (e) {
      if (e.name === 'AbortError') break
      // Count a failed attempt with no time so success rate stays honest.
    }
    opts.onProgress?.(i + 1, count)
  }

  const sorted = [...times].sort((a, b) => a - b)
  const runs = times.length
  const sum = times.reduce((a, b) => a + b, 0)
  const sizeSum = sizes.reduce((a, b) => a + b, 0)

  return {
    requested: count,
    runs,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    avg: runs ? sum / runs : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    successRate: count ? ok / count : 0,
    avgSize: runs ? sizeSum / runs : 0,
    samples: sorted, // for the distribution bars
  }
}
