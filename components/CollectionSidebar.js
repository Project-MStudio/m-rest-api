'use client'

import { cls } from './ui'

/**
 * Show just the path of a URL (drop the domain) so list items stay readable,
 * also dropping a leading "/api" segment, e.g.
 *   http://domain.vn/api/v1/decode -> /v1/decode
 * Falls back to the raw string if it is not a full URL.
 */
function shortPath(rawUrl) {
  try {
    const u = new URL(rawUrl)
    const p = (u.pathname + u.search).replace(/^\/api(?=\/)/, '')
    return p || '/'
  } catch {
    return rawUrl
  }
}

/**
 * Sidebar: sign-in/out + sync state, collection tree, export/import.
 *
 * @param {{
 *   collections: Array<{name,requests}>,
 *   onLoad: (req)=>void,
 *   onRemoveRequest: (col,id)=>void,
 *   onRemoveCollection: (col)=>void,
 *   onExport: ()=>void,
 *   onImport: (file:File)=>void,
 *   onCopyCurl: (req)=>void,
 *   firebaseConfigured: boolean,
 *   user: object|null,
 *   onSignIn: ()=>void,
 *   onSignOut: ()=>void,
 * }} props
 */
export default function CollectionSidebar({
  collections,
  onLoad,
  onRemoveRequest,
  onRemoveCollection,
  onExport,
  onImport,
  onCopyCurl,
  firebaseConfigured,
  user,
  onSignIn,
  onSignOut,
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="text-lg font-semibold text-accent">mRestApi</div>

      {/* Sync state */}
      <div className={`${cls.card} p-2 text-xs`}>
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-accent">Synced as {user.email}</span>
            <button className={cls.btn} onClick={onSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted">Local only</span>
            {firebaseConfigured && (
              <button className={cls.btn} onClick={onSignIn}>
                Sign in
              </button>
            )}
          </div>
        )}
      </div>

      {/* Export / Import */}
      <div className="flex gap-1.5">
        <button className={cls.btn} onClick={onExport}>
          Export
        </button>
        <label className={`${cls.btn} cursor-pointer`}>
          Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = '' // allow re-importing the same file
            }}
          />
        </label>
      </div>

      {/* Collections */}
      <div className="flex-1 overflow-auto">
        {collections.length === 0 && (
          <div className="text-sm text-muted">No collections yet. Save a request.</div>
        )}
        {collections.map((col) => (
          <div key={col.name} className="mb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{col.name}</div>
              <button
                className="text-xs text-muted hover:text-err"
                onClick={() => onRemoveCollection(col.name)}
                title="Remove collection"
              >
                ✕
              </button>
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {col.requests.map((req) => (
                <div
                  key={req.id}
                  className="group flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-fill"
                >
                  <button
                    className="flex-1 truncate text-left"
                    onClick={() => onLoad(req)}
                    title={`${req.method} ${req.url}`}
                  >
                    {/* Show a custom name if set, else just the path. */}
                    <span className="text-accent">{req.method}</span>{' '}
                    {req.name && req.name !== req.url ? req.name : shortPath(req.url)}
                  </button>
                  <button
                    className="text-muted hover:text-accent"
                    onClick={() => onCopyCurl(req)}
                    title="Copy as cURL"
                  >
                    curl
                  </button>
                  <button
                    className="text-muted hover:text-err"
                    onClick={() => onRemoveRequest(col.name, req.id)}
                    title="Remove request"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
