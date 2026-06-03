'use client'

import { useState } from 'react'
import { cls } from './ui'

/**
 * Request body editor with three modes: None / JSON / Raw.
 * In JSON mode a "Format" button pretty-prints and an inline parse error shows.
 *
 * @param {{
 *   bodyType: 'none'|'json'|'raw',
 *   body: string,
 *   onTypeChange: (t)=>void,
 *   onBodyChange: (s)=>void,
 * }} props
 */
export default function BodyEditor({ bodyType, body, onTypeChange, onBodyChange }) {
  const [error, setError] = useState('')

  const format = () => {
    try {
      onBodyChange(JSON.stringify(JSON.parse(body), null, 2))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {['none', 'json', 'raw'].map((t) => (
          <button
            key={t}
            className={bodyType === t ? cls.btnActive : cls.btn}
            onClick={() => onTypeChange(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
        {bodyType === 'json' && (
          <button className={cls.btn} onClick={format}>
            Format
          </button>
        )}
      </div>

      {bodyType !== 'none' && (
        <textarea
          className={`${cls.input} h-40 font-mono resize-y`}
          placeholder={bodyType === 'json' ? '{ "key": "value" }' : 'raw body'}
          value={body}
          onChange={(e) => {
            onBodyChange(e.target.value)
            if (error) setError('')
          }}
          spellCheck={false}
        />
      )}
      {error && <div className="text-xs text-err">JSON error: {error}</div>}
    </div>
  )
}
