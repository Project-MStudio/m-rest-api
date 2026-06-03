'use client'

import { cls } from './ui'

/**
 * Top-level tab switcher.
 * @param {{tabs:string[], active:string, onChange:(t:string)=>void}} props
 */
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={active === t ? cls.btnActive : cls.btn}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
