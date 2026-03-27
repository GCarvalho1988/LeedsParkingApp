import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  const makeChain = () => {
    const chain = {}
    const methods = ['select', 'eq', 'order', 'limit', 'not']
    methods.forEach(m => { chain[m] = vi.fn(() => chain) })
    chain.then = vi.fn(cb => Promise.resolve(cb({ data: [] })))
    return chain
  }
  const txChain  = makeChain()
  const incChain = makeChain()
  const supabase = {
    rpc: vi.fn(),
    from: vi.fn(table => table === 'income' ? incChain : txChain),
    _txChain: txChain,
    _incChain: incChain,
  }
  return { supabase }
})

import Categories from '../src/pages/Categories'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  ;[supabase._txChain, supabase._incChain].forEach(chain => {
    const methods = ['select', 'eq', 'order', 'limit', 'not']
    methods.forEach(m => { if (chain[m].mockReset) { chain[m].mockReset(); chain[m].mockReturnValue(chain) } })
    chain.then.mockReset()
    chain.then.mockImplementation(cb => Promise.resolve(cb({ data: [] })))
  })
  supabase.from.mockImplementation(table => table === 'income' ? supabase._incChain : supabase._txChain)
})

describe('Categories', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    supabase._incChain.then.mockReturnValue(new Promise(() => {}))
    render(<Categories />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders a select dropdown with categories from both tables', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ category: 'Groceries' }, { category: 'Dining' }],
      error: null,
    })
    supabase._incChain.then.mockImplementation(cb =>
      Promise.resolve(cb({ data: [{ category: 'Salary' }] }))
    )
    render(<Categories />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    const options = screen.getAllByRole('option')
    const texts = options.map(o => o.textContent)
    expect(texts).toContain('Dining')
    expect(texts).toContain('Groceries')
    expect(texts).toContain('Salary')
  })
})
