import { useSelector } from 'react-redux'
import type { RootState } from '../store'

/** Returns the real error when verbose mode is on, friendly fallback otherwise. */
export function useErrorMsg() {
  const verbose = useSelector((s: RootState) => s.devSettings.verboseErrors)
  return (err: unknown, fallback = 'Action failed') => {
    if (verbose) {
      return err instanceof Error ? err.message : String(err)
    }
    return fallback
  }
}
