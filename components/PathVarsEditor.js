'use client'

import { cls } from './ui'

/**
 * Editor for path variables detected in the URL (the ":name" tokens). Keys come
 * from the URL; only the values are editable — so you change an id in the path
 * without touching the long URL.
 *
 * @param {{
 *   names: string[],
 *   values: Record<string,string>,
 *   onChange: (name:string, value:string)=>void,
 * }} props
 */
export default function PathVarsEditor({ names, values, onChange }) {
  if (!names.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      {names.map((name) => (
        <div key={name} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate font-mono text-xs text-accent">
            :{name}
          </span>
          <input
            className={`${cls.input} font-mono`}
            placeholder={`value for :${name}`}
            value={values[name] || ''}
            onChange={(e) => onChange(name, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}
