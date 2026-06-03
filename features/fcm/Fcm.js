'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import VersionSelector from '@components/VersionSelector'
import LogList from '@components/LogList'
import { SectionLabel, cls } from '@components/ui'
import { runServer } from '@lib/http/client'
import { EVENT_TYPES } from '@lib/fcm/eventTypes'
import { extractMatchId, DECODE_URL, DECODE_USER_AGENT } from './decode'
import useLogs, { nowStamp } from '@features/workspace/useLogs'

/** The sample FCM body, pre-filled into the editable textarea. */
const SAMPLE_BODY = JSON.stringify(
  {
    sport: 'football',
    type: 25,
    data: {
      matchId: 'l7oqdehg601dr51',
      playerId: '2y8m4zhzd27ql07',
      playerName: 'Haaland',
      playerRating: 8.21,
      homeTeam: { id: '9dn1m1ghdlpmoep', name: 'Bournemouth AFC', shortName: 'Bournemouth' },
      awayTeam: { id: 'p4jwq2ghd57m0ve', name: 'Manchester City', shortName: 'Man City' },
      competition: { id: '', name: '', shortName: '' },
      homeScore: { regular: 1, halftime: 0, ot: 0, penalty: 0, corner: 0, card: 0, redCard: 0, yellowCard: 0, shotsOnTarget: 0 },
      awayScore: { regular: 1, halftime: 0, ot: 0, penalty: 0, corner: 0, card: 0, redCard: 0, yellowCard: 0, shotsOnTarget: 0 },
    },
  },
  null,
  2
)

/**
 * FCM preset screen built on the same HTTP engine. Decode flow + 22 send buttons.
 */
export default function Fcm() {
  const [domain, setDomain] = useState('')
  const [matchCode, setMatchCode] = useState('')
  const [version, setVersion] = useState('v1')
  const [matchId, setMatchId] = useState('')
  const [decoding, setDecoding] = useState(false)
  const [bodyText, setBodyText] = useState(SAMPLE_BODY)

  const { logs, addLog, clear } = useLogs('fcm')
  const decodeAbortRef = useRef(null)

  const sendPath = `/api/${version}/fcm/send`

  // Decode through the proxy with the required User-Agent (browser can't set it).
  const decode = useCallback(
    async (code) => {
      decodeAbortRef.current?.abort()
      const controller = new AbortController()
      decodeAbortRef.current = controller
      setDecoding(true)
      const req = {
        method: 'GET',
        url: `${DECODE_URL}${code}`,
        params: [],
        headers: [{ key: 'User-Agent', value: DECODE_USER_AGENT, enabled: true }],
        body: '',
      }
      try {
        const res = await runServer(req, controller.signal)
        // The decode body is a PLAIN ID STRING, not JSON — handle both shapes.
        const id = extractMatchId(res.responseBody)
        setMatchId(id)
        addLog({
          timestamp: nowStamp(),
          mode: 'server',
          method: 'GET',
          url: req.url,
          status: res.status,
          statusText: res.statusText,
          totalMs: res.totalMs,
          size: res.size,
          sentHeaders: { 'User-Agent': DECODE_USER_AGENT },
          responseHeaders: res.responseHeaders,
          responseBody: res.responseBody,
        })
      } catch (e) {
        if (e.name === 'AbortError') return
        addLog({
          timestamp: nowStamp(),
          failed: true,
          mode: 'server',
          method: 'GET',
          url: req.url,
          totalMs: 0,
          error: e.message,
          verdict: `Decode failed: ${e.message}`,
        })
      } finally {
        setDecoding(false)
      }
    },
    [addLog]
  )

  // Debounce decode 500ms on match-code change; clear the timer on change/unmount.
  useEffect(() => {
    const code = matchCode.trim()
    if (!code) {
      setMatchId('')
      return
    }
    const timer = setTimeout(() => decode(code), 500)
    return () => clearTimeout(timer)
  }, [matchCode, decode])

  // Abort any in-flight decode on unmount.
  useEffect(() => {
    return () => decodeAbortRef.current?.abort()
  }, [])

  // POST an FCM event: inject the clicked type + decoded matchId into the body.
  const sendEvent = async (type) => {
    if (!domain) {
      window.alert('Enter a domain first.')
      return
    }
    let payload
    try {
      payload = JSON.parse(bodyText)
    } catch (e) {
      window.alert(`Body is not valid JSON: ${e.message}`)
      return
    }
    payload.type = type
    payload.data = { ...payload.data, matchId: matchId || payload.data?.matchId }
    const finalBody = JSON.stringify(payload)

    const url = `${domain.replace(/\/$/, '')}${sendPath}`
    const req = {
      method: 'POST',
      url,
      params: [],
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      body: finalBody,
    }
    try {
      const res = await runServer(req)
      addLog({
        timestamp: nowStamp(),
        mode: 'server',
        method: 'POST',
        url,
        status: res.status,
        statusText: res.statusText,
        totalMs: res.totalMs,
        size: res.size,
        sentHeaders: { 'Content-Type': 'application/json' },
        sentBody: finalBody,
        responseHeaders: res.responseHeaders,
        responseBody: res.responseBody,
      })
    } catch (e) {
      addLog({
        timestamp: nowStamp(),
        failed: true,
        mode: 'server',
        method: 'POST',
        url,
        totalMs: 0,
        sentBody: finalBody,
        error: e.message,
        verdict: `Send failed: ${e.message}`,
      })
    }
  }

  return (
    <div className="flex h-full gap-3">
      {/* Left column: controls */}
      <div
        className="flex flex-col gap-3 overflow-auto pr-1"
        style={{ width: 'clamp(380px, 38%, 520px)' }}
      >
        <div>
          <SectionLabel>Domain</SectionLabel>
          <input
            className={`${cls.input} mt-1 font-mono`}
            placeholder="http://103.109.101.226:7981"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </div>

        <div>
          <SectionLabel>API version (send only)</SectionLabel>
          <div className="mt-1 flex items-center gap-3">
            <VersionSelector value={version} onChange={setVersion} />
            <span className="font-mono text-xs text-muted">{sendPath}</span>
          </div>
        </div>

        <div>
          <SectionLabel>Match code</SectionLabel>
          <input
            className={`${cls.input} mt-1 font-mono`}
            placeholder="enter code to decode"
            value={matchCode}
            onChange={(e) => setMatchCode(e.target.value)}
          />
        </div>

        <div>
          <SectionLabel>Decoded matchId {decoding && '(decoding…)'}</SectionLabel>
          <input
            className={`${cls.input} mt-1 font-mono`}
            value={matchId}
            readOnly
            placeholder="—"
          />
        </div>

        <div>
          <SectionLabel>FCM body (editable)</SectionLabel>
          <textarea
            className={`${cls.input} mt-1 h-48 font-mono resize-y`}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div>
          <SectionLabel>Events (click to send)</SectionLabel>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {EVENT_TYPES.map((ev) => (
              <button
                key={ev.type}
                className={`${cls.btn} text-left text-xs`}
                onClick={() => sendEvent(ev.type)}
              >
                <span className="text-accent">{ev.type}</span> · {ev.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right column: logs */}
      <div className="flex flex-1 flex-col gap-3 overflow-auto pl-1">
        <LogList entries={logs} onClear={clear} />
      </div>
    </div>
  )
}
