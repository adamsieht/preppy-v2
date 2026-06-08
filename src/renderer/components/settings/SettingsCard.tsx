interface Props {
  title?:     string
  desc?:      React.ReactNode
  right?:     React.ReactNode
  children?:  React.ReactNode
  className?: string
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  card:     'bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col gap-3',
  head:     'flex items-start justify-between gap-3',
  title:    'text-white font-bold text-base',
  desc:     'text-[#8b949e] text-sm leading-relaxed',
}
// ───────────────────────────────────────────────────────────────────────────

/**
 * Standard settings card — a titled, bordered panel used across every settings
 * tab so new sections stay visually consistent. Pass `right` for a header-aligned
 * action (e.g. a scan/refresh button).
 */
export default function SettingsCard({ title, desc, right, children, className }: Props) {
  return (
    <div className={`${classes.card}${className ? ` ${className}` : ''}`}>
      {(title || right) && (
        <div className={classes.head}>
          {title && <div className={classes.title}>{title}</div>}
          {right}
        </div>
      )}
      {desc && <div className={classes.desc}>{desc}</div>}
      {children}
    </div>
  )
}
