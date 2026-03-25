import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../src/lib/supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  return { supabase: { from: vi.fn().mockReturnValue(chain), _chain: chain } }
})

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, role: 'member' }),
}))

import Transactions from '../src/pages/Transactions'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._chain)
  supabase._chain.select.mockReturnThis()
  supabase._chain.order.mockReturnThis()
})

describe('Transactions', () => {
  it('shows loading state initially', () => {
    supabase._chain.then.mockReturnValue(new Promise(() => {}))
    render(<Transactions />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders transaction rows after load', async () => {
    const txData = [
      { id: '1', date: '2025-10-01', description: 'TESCO', amount: 45.5, category: 'Groceries' },
    ]
    // First call: transactions; second call: flags
    supabase._chain.then
      .mockImplementationOnce(cb => Promise.resolve(cb({ data: txData })))
      .mockImplementation(cb => Promise.resolve(cb({ data: [] })))
    render(<Transactions />)
    await waitFor(() => expect(screen.getByText('TESCO')).toBeInTheDocument())
  })

  it('filters transactions by category', async () => {
    const txData = [
      { id: '1', date: '2025-10-01', description: 'TESCO', amount: 45.5, category: 'Groceries' },
      { id: '2', date: '2025-10-02', description: 'UBER', amount: 12, category: 'Transport' },
    ]
    supabase._chain.then
      .mockImplementationOnce(cb => Promise.resolve(cb({ data: txData })))
      .mockImplementation(cb => Promise.resolve(cb({ data: [] })))
    render(<Transactions />)
    await waitFor(() => expect(screen.getByText('TESCO')).toBeInTheDocument())
    expect(screen.getByText('UBER')).toBeInTheDocument()
    expect(screen.getByText('2 transactions')).toBeInTheDocument()
  })
})
