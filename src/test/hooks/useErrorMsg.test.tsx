import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import devSettingsReducer, { setVerboseErrors } from '../../renderer/store/slices/devSettings.slice'
import { useErrorMsg } from '../../renderer/hooks/useErrorMsg'

function makeStore(_verboseErrors = false) {
  return configureStore({ reducer: { devSettings: devSettingsReducer } })
}

function TestComponent({ err, fallback }: { err: unknown; fallback?: string }) {
  const errorMsg = useErrorMsg()
  return <div>{errorMsg(err, fallback)}</div>
}

describe('useErrorMsg', () => {
  it('returns fallback when verboseErrors is false', () => {
    const store = makeStore(false)
    render(
      <Provider store={store}>
        <TestComponent err={new Error('real error')} fallback="Something went wrong" />
      </Provider>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('returns the real error message when verboseErrors is true', () => {
    const store = makeStore()
    store.dispatch(setVerboseErrors(true))
    render(
      <Provider store={store}>
        <TestComponent err={new Error('real error')} fallback="Something went wrong" />
      </Provider>
    )
    expect(screen.getByText('real error')).toBeInTheDocument()
  })

  it('returns default fallback "Action failed" when none provided', () => {
    const store = makeStore(false)
    render(
      <Provider store={store}>
        <TestComponent err={new Error('oops')} />
      </Provider>
    )
    expect(screen.getByText('Action failed')).toBeInTheDocument()
  })

  it('stringifies non-Error objects in verbose mode', () => {
    const store = makeStore()
    store.dispatch(setVerboseErrors(true))
    render(
      <Provider store={store}>
        <TestComponent err="raw string error" fallback="Fallback" />
      </Provider>
    )
    expect(screen.getByText('raw string error')).toBeInTheDocument()
  })
})
