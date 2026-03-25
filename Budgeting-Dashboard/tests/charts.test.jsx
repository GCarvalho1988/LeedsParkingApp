import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryBarChart from '../src/components/CategoryBarChart'
import MonthlyTrendChart from '../src/components/MonthlyTrendChart'

// Recharts uses ResizeObserver internally — stub it for jsdom
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const categoryData = [
  { category: 'Groceries', amount: 843 },
  { category: 'Transport', amount: 312 },
]

const trendData = [
  { month: 'Oct 24', amount: 2847 },
  { month: 'Nov 24', amount: 3102 },
]

describe('CategoryBarChart', () => {
  it('renders without crashing with valid data', () => {
    const { container } = render(<CategoryBarChart data={categoryData} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders without crashing with empty data', () => {
    const { container } = render(<CategoryBarChart data={[]} />)
    expect(container.firstChild).toBeTruthy()
  })
})

describe('MonthlyTrendChart', () => {
  it('renders without crashing with valid data', () => {
    const { container } = render(<MonthlyTrendChart data={trendData} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders without crashing with empty data', () => {
    const { container } = render(<MonthlyTrendChart data={[]} />)
    expect(container.firstChild).toBeTruthy()
  })
})
