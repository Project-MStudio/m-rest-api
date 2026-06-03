'use client'

import { cls } from './ui'

/**
 * Segmented v1/v2/v3 selector for the FCM send path.
 * @param {{value:string, onChange:(v:string)=>void}} props
 */
export default function VersionSelector({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {['v1', 'v2', 'v3'].map((v) => (
        <button
          key={v}
          className={value === v ? cls.btnActive : cls.btn}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
