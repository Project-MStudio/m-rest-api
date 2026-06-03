'use client'

import { useEffect, useState } from 'react'
import Modal from '@components/Modal'
import { cls } from '@components/ui'
import * as storage from '@lib/storage'

/**
 * Save-to-collection dialog. Replaces the old double window.prompt flow with a
 * proper form: pick or type a collection (existing names autocomplete) and a
 * request name.
 *
 * @param {{
 *   open:boolean, defaultName:string,
 *   onClose:()=>void, onSave:(collection:string, name:string)=>void,
 * }} props
 */
export default function SaveDialog({ open, defaultName, onClose, onSave }) {
  const [collection, setCollection] = useState('')
  const [name, setName] = useState('')
  const [existing, setExisting] = useState([])

  // Load current collection names each time the dialog opens.
  useEffect(() => {
    if (!open) return
    const cols = storage.list()
    setExisting(cols.map((c) => c.name))
    setCollection(cols[0]?.name || 'My Collection')
    setName(defaultName || 'Request')
  }, [open, defaultName])

  const canSave = collection.trim() && name.trim()
  const submit = () => {
    if (canSave) onSave(collection.trim(), name.trim())
  }

  return (
    <Modal open={open} title="Save request" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <div className={cls.label}>Collection</div>
          <input
            className={`${cls.input} mt-1`}
            list="mra-collection-names"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            placeholder="Collection name"
          />
          <datalist id="mra-collection-names">
            {existing.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <div className={cls.label}>Request name</div>
          <input
            className={`${cls.input} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Request name"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button className={cls.btn} onClick={onClose}>
            Cancel
          </button>
          <button className={cls.btnActive} onClick={submit} disabled={!canSave}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
