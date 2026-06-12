'use client'

import { useCallback, useEffect, useState } from 'react'
import Tabs from '@components/Tabs'
import CollectionSidebar from '@components/CollectionSidebar'
import Workspace from '@features/workspace/Workspace'
import Fcm from '@features/fcm/Fcm'
import { toCurl } from '@lib/http/curl'
import { fromPostmanCollection } from '@lib/http/postman'
import * as storage from '@lib/storage'
import { isFirebaseConfigured, signIn, signOutUser, onAuth } from '@lib/fcm/auth'

const TABS = ['Workspace', 'FCM']

export default function Home() {
  const [tab, setTab] = useState('Workspace')
  const [collections, setCollections] = useState([])
  const [toLoad, setToLoad] = useState(null)
  const [user, setUser] = useState(null)

  const firebaseConfigured = isFirebaseConfigured()

  const refresh = useCallback(() => setCollections(storage.list()), [])

  // Load collections from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    refresh()
  }, [refresh])

  // Subscribe to Firebase auth (no-op unsubscribe when unconfigured); clean up.
  useEffect(() => {
    let unsub = () => {}
    let active = true
    onAuth(async (u) => {
      if (!active) return
      setUser(u)
      await storage.setUser(u) // merge cloud <-> local on login
      refresh()
    }).then((fn) => {
      if (active) unsub = fn
      else fn?.()
    })
    return () => {
      active = false
      unsub()
    }
  }, [refresh])

  const handleLoad = (req) => {
    setToLoad(req)
    setTab('Workspace')
  }

  const handleExport = () => {
    const map = storage.exportMap()
    const payload = { version: 1, collections: Object.values(map) }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'mrestapi-collections.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImport = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        // Detect a Postman v2.1 collection and route it through the converter;
        // otherwise accept our own export shape {version, collections:[...]}.
        const isPostman =
          parsed.info?.schema?.includes('collection') ||
          (parsed.info && Array.isArray(parsed.item))
        let map
        if (isPostman) {
          map = fromPostmanCollection(parsed)
        } else {
          map = {}
          for (const col of parsed.collections || []) map[col.name] = col
        }
        storage.importMap(map)
        refresh()
      } catch (e) {
        window.alert(`Import failed: ${e.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleCopyCurl = async (req) => {
    try {
      await navigator.clipboard.writeText(toCurl(req))
    } catch {
      window.prompt('Copy cURL:', toCurl(req))
    }
  }

  return (
    <div className="flex h-screen flex-col p-3">
      {/* Top bar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-accent">mRestApi</span>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
        <span className="text-xs text-muted">
          {user ? `Synced as ${user.email}` : 'Local only'}
        </span>
      </div>

      {/* Body: sidebar + active tab */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        <div className="w-60 shrink-0 overflow-hidden border-r border-line pr-3">
          <CollectionSidebar
            collections={collections}
            onLoad={handleLoad}
            onRemoveRequest={(c, id) => {
              storage.removeRequest(c, id)
              refresh()
            }}
            onRemoveCollection={(c) => {
              storage.removeCollection(c)
              refresh()
            }}
            onExport={handleExport}
            onImport={handleImport}
            onCopyCurl={handleCopyCurl}
            firebaseConfigured={firebaseConfigured}
            user={user}
            onSignIn={() => signIn().catch((e) => window.alert(e.message))}
            onSignOut={() => signOutUser()}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {tab === 'Workspace' ? (
            <Workspace
              toLoad={toLoad}
              onConsumed={() => setToLoad(null)}
              onSaved={refresh}
            />
          ) : (
            <Fcm />
          )}
        </div>
      </div>
    </div>
  )
}
