'use client'

import { cls } from './ui'

/**
 * Editable list of key/value rows with an enable toggle (used for both query
 * params and headers). Rows are controlled by the parent.
 *
 * @param {{
 *   rows: Array<{key:string,value:string,enabled:boolean}>,
 *   onChange: (rows)=>void,
 *   keyPlaceholder?: string,
 *   valuePlaceholder?: string,
 * }} props
 */
export default function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
}) {
  const update = (i, patch) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    onChange(next)
  }
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))
  const add = () => onChange([...rows, { key: '', value: '', enabled: true }])

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => update(i, { enabled: e.target.checked })}
            className="accent-accent"
            aria-label="enable row"
          />
          <input
            className={`${cls.input} font-mono`}
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => update(i, { key: e.target.value })}
          />
          <input
            className={`${cls.input} font-mono`}
            placeholder={valuePlaceholder}
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button className={cls.btn} onClick={() => remove(i)} aria-label="remove row">
            ✕
          </button>
        </div>
      ))}
      <button className={`${cls.btn} self-start`} onClick={add}>
        + Add row
      </button>
    </div>
  )
}
