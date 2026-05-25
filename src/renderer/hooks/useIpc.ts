import { useState, useCallback } from 'react'

interface IpcState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useIpc<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>
) {
  const [state, setState] = useState<IpcState<T>>({ data: null, loading: false, error: null })

  const execute = useCallback(
    async (...args: Args) => {
      setState({ data: null, loading: true, error: null })
      try {
        const result = await fn(...args)
        setState({ data: result, loading: false, error: null })
        return result
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        setState({ data: null, loading: false, error })
        return null
      }
    },
    [fn]
  )

  return { ...state, execute }
}
