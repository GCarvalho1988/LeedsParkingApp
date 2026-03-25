import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../src/lib/supabase', () => {
  const chain = { select: vi.fn().mockReturnThis(), then: vi.fn() }
  return { supabase: { from: vi.fn().mockReturnValue(chain), _chain: chain } }
})

import YearVsYear from '../src/pages/YearVsYear'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._chain)
  supabase._chain.select.mockReturnThis()
})

describe('YearVsYear', () => {
  it('shows loading state initially', () => {
    supabase._chain.then.mockReturnValue(new Promise(() => {}))
    render(<YearVsYear />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders monthly comparison table after load', async () => {
    const txData = [
      { date: '2024-10-01', amount: 100, category: 'Groceries' },
      { date: '2025-10-01', amount: 120, category: 'Groceries' },
    ]
    supabase._chain.then.mockImplementation(cb => Promise.resolve(cb({ data: txData })))
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByText('Jan')).toBeInTheDocument())
    expect(screen.getByText('Oct')).toBeInTheDocument()
  })
})
