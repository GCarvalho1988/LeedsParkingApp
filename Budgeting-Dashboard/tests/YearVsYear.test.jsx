import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../src/lib/supabase', () => {
  return { supabase: { rpc: vi.fn() } }
})

import YearVsYear from '../src/pages/YearVsYear'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('YearVsYear', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    render(<YearVsYear />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders monthly comparison table after load', async () => {
    const rpcData = [
      { period: '2024-10', category: 'Groceries', total: 100 },
      { period: '2025-10', category: 'Groceries', total: 120 },
    ]
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByText('Jan')).toBeInTheDocument())
    expect(screen.getByText('Oct')).toBeInTheDocument()
  })
})
