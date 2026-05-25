import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AutoDismissAlert from '../../renderer/components/AutoDismissAlert'

describe('AutoDismissAlert', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the message', () => {
    render(<AutoDismissAlert variant="success" msg="Saved!" onDismiss={vi.fn()} />)
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('auto-dismisses success after 2500ms', () => {
    const onDismiss = vi.fn()
    render(<AutoDismissAlert variant="success" msg="Saved!" onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2500) })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does not auto-dismiss before 2500ms', () => {
    const onDismiss = vi.fn()
    render(<AutoDismissAlert variant="success" msg="Saved!" onDismiss={onDismiss} />)
    act(() => { vi.advanceTimersByTime(2499) })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('does not auto-dismiss danger variant', () => {
    const onDismiss = vi.fn()
    render(<AutoDismissAlert variant="danger" msg="Error!" onDismiss={onDismiss} />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('respects a custom delay override', () => {
    const onDismiss = vi.fn()
    render(<AutoDismissAlert variant="danger" msg="Warn!" onDismiss={onDismiss} delay={1000} />)
    act(() => { vi.advanceTimersByTime(999) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when the close button is clicked', async () => {
    vi.useRealTimers()
    const onDismiss = vi.fn()
    render(<AutoDismissAlert variant="success" msg="Done!" onDismiss={onDismiss} />)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    await userEvent.click(closeBtn)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
