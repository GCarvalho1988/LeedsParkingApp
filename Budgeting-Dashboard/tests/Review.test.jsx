import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Review from '../src/pages/Review'

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const mockFrom = vi.fn()
const mockRpc  = vi.fn().mockResolvedValue({ data: [] })
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args), rpc: (...args) => mockRpc(...args) },
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
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    then:   vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
  }
  return { ...base, ...overrides }
}

// Set up mocks for a period. txs is the full list returned by the transactions query.
function setupPeriodMocks({ txs = [], flags = [] } = {}) {
  mockFrom.mockImplementation(table => {
    if (table === 'uploads') {
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
    }
    if (table === 'expense_claims') {
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
    }
    if (table === 'flags') {
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: flags, error: null }))) })
    }
    return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: txs, error: null }))) })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockFrom.mockReturnValue(makeChain())
  mockRpc.mockResolvedValue({ data: [] })
})

describe('Review', () => {
  it('renders without crashing in empty state', () => {
    render(<Review />)
  })

  it('defaults to Gui mode', async () => {
    setupPeriodMocks({ txs: [] })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/nothing to review/i)).toBeInTheDocument())
    const guiBtn = screen.getByRole('button', { name: /^gui$/i })
    expect(guiBtn.className).toContain('bg-[#DC9F85]')
  })

  it('restores mode from localStorage', async () => {
    localStorage.setItem('reviewMode', 'dulce')
    setupPeriodMocks({ txs: [] })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/nothing to review/i)).toBeInTheDocument())
    const dulceBtn = screen.getByRole('button', { name: /^dulce$/i })
    expect(dulceBtn.className).toContain('bg-[#DC9F85]')
  })

  it('shows Personal, Work, Dismiss and comment icon on pending rows', async () => {
    setupPeriodMocks({
      txs: [{ id: '1', date: '2025-03-05', description: 'COSTA', amount: 6.40, category: 'Eating out' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('COSTA')).toBeInTheDocument())
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
    expect(screen.getByTitle('Add a comment')).toBeInTheDocument()
  })

  it('shows "To review" section header with count', async () => {
    setupPeriodMocks({
      txs: [{ id: '1', date: '2025-03-05', description: 'WAITROSE', amount: 84.20, category: 'Groceries' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/to review/i)).toBeInTheDocument())
    expect(screen.getByText(/1 remaining/i)).toBeInTheDocument()
  })

  it('shows "Tagged this period" for Gui-tagged transactions in Gui mode', async () => {
    setupPeriodMocks({
      txs: [{ id: '2', date: '2025-03-10', description: 'WATERSTONES', amount: 18, category: 'Gui Personal Purchases' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('WATERSTONES')).toBeInTheDocument())
    expect(screen.getByText(/tagged this period/i)).toBeInTheDocument()
  })

  it('does not show Dismiss on tagged rows', async () => {
    setupPeriodMocks({
      txs: [{ id: '2', date: '2025-03-10', description: 'WATERSTONES', amount: 18, category: 'Gui Personal Purchases' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('WATERSTONES')).toBeInTheDocument())
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument()
  })

  it('clicking Dismiss removes the row', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads')        return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'flags')          return { ...makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) }), insert: vi.fn().mockResolvedValue({ error: null }) }
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ id: '1', date: '2025-03-05', description: 'AMAZON', amount: 22.99, category: 'General merchandise' }], error: null }))) })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('AMAZON')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Dismiss'))
    await waitFor(() => expect(screen.queryByText('AMAZON')).not.toBeInTheDocument())
  })

  it('dismissed transactions are excluded from pending on load', async () => {
    setupPeriodMocks({
      txs: [{ id: '1', date: '2025-03-05', description: 'ALREADY DISMISSED', amount: 20, category: 'General merchandise' }],
      flags: [{ id: 'f1', transaction_id: '1', type: 'dismiss', comment: null }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/nothing to review/i)).toBeInTheDocument())
    expect(screen.queryByText('ALREADY DISMISSED')).not.toBeInTheDocument()
  })

  it('clicking Personal in Gui mode tags to Gui Personal Purchases and moves to tagged', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads')        return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'flags')          return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'transactions')   return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({ data: [{ id: '1', date: '2025-03-05', description: 'ZARA', amount: 45, category: 'Clothing & shoes' }], error: null }))),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      return makeChain()
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('ZARA')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Personal'))
    await waitFor(() => expect(screen.getByText(/tagged this period/i)).toBeInTheDocument())
    expect(screen.getByText(/personal ▾/i)).toBeInTheDocument()
  })

  it('clicking Personal in Dulce mode tags to Dulce Personal Purchases', async () => {
    localStorage.setItem('reviewMode', 'dulce')
    mockFrom.mockImplementation(table => {
      if (table === 'uploads')        return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'flags')          return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'transactions')   return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({ data: [{ id: '1', date: '2025-03-05', description: 'H&M', amount: 30, category: 'Clothing & shoes' }], error: null }))),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      return makeChain()
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('H&M')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Personal'))
    await waitFor(() => expect(screen.getByText(/tagged this period/i)).toBeInTheDocument())
    expect(screen.getByText(/personal ▾/i)).toBeInTheDocument()
  })

  it('Gui-tagged transactions do not appear in pending', async () => {
    setupPeriodMocks({
      txs: [
        { id: '1', date: '2025-03-05', description: 'PENDING ITEM', amount: 20, category: 'Groceries' },
        { id: '2', date: '2025-03-10', description: 'GUI BOOK', amount: 18, category: 'Gui Personal Purchases' },
      ],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('PENDING ITEM')).toBeInTheDocument())
    expect(screen.getByText(/1 remaining/i)).toBeInTheDocument()
  })

  it('switching from Gui to Dulce mode shows Dulce tagged items', async () => {
    setupPeriodMocks({
      txs: [
        { id: '1', date: '2025-03-05', description: 'DULCE DRESS', amount: 60, category: 'Dulce Personal Purchases' },
        { id: '2', date: '2025-03-08', description: 'GUI GADGET',  amount: 40, category: 'Gui Personal Purchases' },
      ],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('GUI GADGET')).toBeInTheDocument())
    expect(screen.queryByText('DULCE DRESS')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^dulce$/i }))
    await waitFor(() => expect(screen.getByText('DULCE DRESS')).toBeInTheDocument())
    expect(screen.queryByText('GUI GADGET')).not.toBeInTheDocument()
  })

  it('a Groceries transaction appears in pending (discretionary expansion)', async () => {
    setupPeriodMocks({
      txs: [{ id: '1', date: '2025-03-05', description: 'WAITROSE', amount: 84, category: 'Groceries' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('WAITROSE')).toBeInTheDocument())
    expect(screen.getByText(/1 remaining/i)).toBeInTheDocument()
  })

  it('shows summary table for tagged transactions', async () => {
    localStorage.setItem('reviewMode', 'dulce')
    setupPeriodMocks({
      txs: [{ id: '2', date: '2025-03-10', description: 'H&M', amount: 80, category: 'Dulce Personal Purchases' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/transfers this period/i)).toBeInTheDocument())
    expect(screen.getByText(/mark done/i)).toBeInTheDocument()
  })

  it('clicking category chip on pending row opens the category select', async () => {
    setupPeriodMocks({
      txs: [{ id: '1', date: '2025-03-05', description: 'ASOS ORDER', amount: 55, category: 'Clothing & shoes' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('ASOS ORDER')).toBeInTheDocument())
    const chip = screen.getByRole('button', { name: /clothing/i })
    await userEvent.click(chip)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('clicking the tag button on a Gui-tagged row opens the retag dropdown', async () => {
    setupPeriodMocks({
      txs: [{ id: '2', date: '2025-03-10', description: 'WATERSTONES', amount: 18, category: 'Gui Personal Purchases' }],
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('WATERSTONES')).toBeInTheDocument())
    await userEvent.click(screen.getByText(/personal ▾/i))
    expect(screen.getByRole('button', { name: /^work$/i })).toBeInTheDocument()
  })
})
