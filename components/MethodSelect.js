'use client'

import { cls } from './ui'

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/**
 * HTTP method dropdown.
 * @param {{value:string, onChange:(m:string)=>void}} props
 */
export default function MethodSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${cls.input} w-28 font-mono`}
      aria-label="HTTP method"
    >
      {METHODS.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  )
}
