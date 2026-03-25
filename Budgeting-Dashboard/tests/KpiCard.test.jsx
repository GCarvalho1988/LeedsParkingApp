import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KpiCard from '../src/components/KpiCard'

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Total Spend" value="£2,847" />)
    expect(screen.getByText('Total Spend')).toBeInTheDocument()
    expect(screen.getByText('£2,847')).toBeInTheDocument()
  })

  it('shows upward arrow and red colour for positive delta (overspend)', () => {
    render(<KpiCard label="Spend" value="£100" delta={12} deltaLabel="vs last month" />)
    const delta = screen.getByText(/12%/)
    expect(delta.textContent).toContain('↑')
    expect(delta.className).toContain('red')
  })

  it('shows downward arrow and green colour for negative delta (underspend)', () => {
    render(<KpiCard label="Spend" value="£100" delta={-8} deltaLabel="vs last month" />)
    const delta = screen.getByText(/8%/)
    expect(delta.textContent).toContain('↓')
    expect(delta.className).toContain('green')
  })

  it('omits delta section when delta is not provided', () => {
    render(<KpiCard label="Spend" value="£100" />)
    expect(screen.queryByText(/↑|↓/)).not.toBeInTheDocument()
  })
})
