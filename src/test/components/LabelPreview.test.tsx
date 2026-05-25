import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import LabelPreview from '../../renderer/components/LabelPreview'

describe('LabelPreview', () => {
  it('renders the template name', () => {
    render(<LabelPreview template="IX" durationHrs={4} />)
    expect(screen.getByText('IX')).toBeInTheDocument()
  })

  it('shows Internal Use for IX template', () => {
    render(<LabelPreview template="IX" durationHrs={4} />)
    expect(screen.getByText('Internal Use')).toBeInTheDocument()
  })

  it('shows Opened / Expiry for OX template', () => {
    render(<LabelPreview template="OX" durationHrs={24} />)
    expect(screen.getByText('Opened / Expiry')).toBeInTheDocument()
  })

  it('shows Use First for UX template', () => {
    render(<LabelPreview template="UX" durationHrs={72} />)
    expect(screen.getByText('Use First')).toBeInTheDocument()
  })

  it('shows USE BY label for IX', () => {
    render(<LabelPreview template="IX" durationHrs={8} />)
    expect(screen.getByText('USE BY')).toBeInTheDocument()
  })

  it('shows EXPIRES label for OX', () => {
    render(<LabelPreview template="OX" durationHrs={8} />)
    expect(screen.getByText('EXPIRES')).toBeInTheDocument()
  })

  it('shows USE FIRST BY label for UX', () => {
    render(<LabelPreview template="UX" durationHrs={8} />)
    expect(screen.getByText('USE FIRST BY')).toBeInTheDocument()
  })

  it('renders correct expiry date for 4h', () => {
    const expiry = dayjs().add(4, 'hour').format('MM/DD/YYYY')
    render(<LabelPreview template="IX" durationHrs={4} />)
    expect(screen.getByText(expiry)).toBeInTheDocument()
  })

  it('renders correct expiry date for 1 day (24h)', () => {
    const expiry = dayjs().add(24, 'hour').format('MM/DD/YYYY')
    render(<LabelPreview template="IX" durationHrs={24} />)
    expect(screen.getByText(expiry)).toBeInTheDocument()
  })

  it('shows hour-based duration text for <24h', () => {
    render(<LabelPreview template="IX" durationHrs={8} />)
    expect(screen.getByText(/8h from prep/)).toBeInTheDocument()
  })

  it('shows day-based duration text for >=24h', () => {
    render(<LabelPreview template="IX" durationHrs={48} />)
    expect(screen.getByText(/2 days from prep/)).toBeInTheDocument()
  })

  it('uses "opening" for OX in duration text', () => {
    render(<LabelPreview template="OX" durationHrs={24} />)
    expect(screen.getByText(/from opening/)).toBeInTheDocument()
  })

  it('shows singular "day" for exactly 1 day', () => {
    render(<LabelPreview template="IX" durationHrs={24} />)
    expect(screen.getByText(/1 day from/)).toBeInTheDocument()
  })
})
