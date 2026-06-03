/**
 * Shared Tailwind class strings + tiny primitives, so repeated utility groups
 * live in one place (not duplicated, not turned into bespoke CSS).
 */

export const cls = {
  input:
    'w-full rounded-md bg-panel border border-line px-2 py-1.5 text-sm text-gray-200 outline-none focus:shadow-glow placeholder:text-muted',
  label: 'text-xs uppercase tracking-wide text-muted',
  btn:
    'rounded-md border border-line px-3 py-1.5 text-sm text-gray-200 hover:bg-fill transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
  btnActive: 'rounded-md border border-accent/60 bg-fill px-3 py-1.5 text-sm text-accent',
  card: 'rounded-lg border border-line bg-panel',
}

/** Small section heading. */
export function SectionLabel({ children }) {
  return <div className={cls.label}>{children}</div>
}

/** A status pill colored green for 2xx and red otherwise. */
export function StatusPill({ status, statusText }) {
  const ok = status >= 200 && status < 300
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
        ok ? 'text-ok' : 'text-err'
      }`}
    >
      {status} {statusText}
    </span>
  )
}
