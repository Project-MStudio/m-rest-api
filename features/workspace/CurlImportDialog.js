'use client'

import { useEffect, useState } from 'react'
import Modal from '@components/Modal'
import { cls } from '@components/ui'
import { fromCurl } from '@lib/http/curl'

/**
 * Paste a cURL command and load it into the builder.
 *
 * @param {{open:boolean, onClose:()=>void, onImport:(req)=>void}} props
 */
export default function CurlImportDialog({ open, onClose, onImport }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  // Reset the field whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setText('')
      setError('')
    }
  }, [open])

  const submit = () => {
    try {
      const req = fromCurl(text)
      if (!req.url) {
        setError('No URL found in the cURL command.')
        return
      }
      onImport(req)
    } catch (e) {
      setError(e.message || 'Could not parse cURL.')
    }
  }

  return (
    <Modal open={open} title="Import from cURL" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <textarea
          className={`${cls.input} h-44 font-mono resize-y`}
          placeholder={`curl 'https://api.example.com/users?page=2' \\\n  -H 'Authorization: Bearer ...' \\\n  -d '{"name":"Sam"}'`}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError('')
          }}
          spellCheck={false}
        />
        {error && <div className="text-xs text-err">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className={cls.btn} onClick={onClose}>
            Cancel
          </button>
          <button className={cls.btnActive} onClick={submit} disabled={!text.trim()}>
            Import
          </button>
        </div>
      </div>
    </Modal>
  )
}
