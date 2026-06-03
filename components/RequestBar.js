'use client'

import MethodSelect from './MethodSelect'
import { cls } from './ui'

/**
 * Top request bar: method + URL + mode toggle + Send.
 *
 * @param {{
 *   method:string, url:string, mode:'browser'|'server', busy:boolean,
 *   onMethod:(m)=>void, onUrl:(u)=>void, onMode:(m)=>void,
 *   onSend:()=>void, onCancel:()=>void,
 * }} props
 */
export default function RequestBar({
  method,
  url,
  mode,
  busy,
  onMethod,
  onUrl,
  onMode,
  onSend,
  onCancel,
  onUrlPaste,
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <MethodSelect value={method} onChange={onMethod} />
        <input
          className={`${cls.input} font-mono`}
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          onPaste={(e) => onUrlPaste?.(e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) onSend()
          }}
        />
        {busy ? (
          <button className={cls.btn} onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button className={cls.btnActive} onClick={onSend} disabled={!url}>
            Send
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className={cls.label}>Mode</span>
        <button
          className={mode === 'browser' ? cls.btnActive : cls.btn}
          onClick={() => onMode('browser')}
          title="Real client-side fetch from the page origin (real CORS)."
        >
          Browser
        </button>
        <button
          className={mode === 'server' ? cls.btnActive : cls.btn}
          onClick={() => onMode('server')}
          title="Proxied through the server (no CORS; can set User-Agent)."
        >
          Server proxy
        </button>
      </div>
    </div>
  )
}
