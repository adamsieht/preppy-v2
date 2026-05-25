import { useEffect } from 'react'
import { Alert } from 'react-bootstrap'

interface Props {
  variant: 'success' | 'danger' | 'warning' | 'info'
  msg: string
  onDismiss: () => void
  /** ms before auto-dismiss; success=2500 danger=0 (manual only) */
  delay?: number
}

export default function AutoDismissAlert({ variant, msg, onDismiss, delay }: Props) {
  const ms = delay ?? (variant === 'success' ? 2500 : 0)

  useEffect(() => {
    if (!ms) return
    const t = setTimeout(onDismiss, ms)
    return () => clearTimeout(t)
  }, [ms, onDismiss])

  return (
    <Alert
      variant={variant}
      dismissible
      onClose={onDismiss}
      style={{ fontSize: '1rem', margin: '0 0 12px' }}
    >
      {msg}
    </Alert>
  )
}
