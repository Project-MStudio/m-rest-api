'use client'

import { useEffect } from 'react'
import { cls } from './ui'

/**
 * Lightweight modal: backdrop + centered card. Closes on Escape or backdrop
 * click. The keydown listener is removed on close/unmount (no leak).
 *
 * @param {{open:boolean, title:string, onClose:()=>void, children:any}} props
 */
export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`${cls.card} w-full max-w-lg p-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-accent">{title}</div>
          <button className="text-muted hover:text-err" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
