import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  screen:  'flex flex-col items-center justify-center h-screen',
  alert:   'w-full max-w-[600px] bg-[#f8d7da] border border-[#f5c2c7] text-[#842029] rounded p-4',
  heading: 'font-bold text-lg mb-2',
  pre:     'text-sm mb-3 whitespace-pre-wrap',
  btn:     'border border-[#842029] text-[#842029] bg-transparent rounded px-3 py-2 text-sm',
}
// ───────────────────────────────────────────────────────────────────────────

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={classes.screen}>
          <div className={classes.alert}>
            <h5 className={classes.heading}>Something went wrong</h5>
            <pre className={classes.pre}>{this.state.error.message}</pre>
            <button onClick={() => window.location.reload()} className={classes.btn}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
