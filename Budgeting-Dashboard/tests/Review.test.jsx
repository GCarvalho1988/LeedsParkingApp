import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Review from '../src/pages/Review'

const mockFrom = vi.fn()
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

function makeChain(overrides = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    then:   vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
  }
  return { ...base, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue(makeChain())
})

describe('Review', () => {
  it('renders without crashing in empty state', () => {
    render(<Review />)
  })

  it('shows Dismiss, Personal and Work buttons per pending transaction', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))),
        })
      }
      if (table === 'expense_claims') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
        })
      }
      // transactions — return a Clothing & shoes item (pending)
      return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({
          data: [{ id: '1', date: '2025-03-05', description: 'Zara top', amount: 45, category: 'Clothing & shoes' }],
          error: null,
        }))),
      })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('Zara top')).toBeInTheDocument())
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
    expect(screen.queryByText(/tag all/i)).not.toBeInTheDocument()
  })

  it('shows summary table for pre-tagged Dulce Personal Purchases items', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))),
        })
      }
      if (table === 'expense_claims') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
        })
      }
      return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({
          data: [{ id: '2', date: '2025-03-10', description: 'Clothes', amount: 80, category: 'Dulce Personal Purchases' }],
          error: null,
        }))),
      })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/personal transfer/i)).toBeInTheDocument())
    expect(screen.getByText(/mark done/i)).toBeInTheDocument()
  })
})
