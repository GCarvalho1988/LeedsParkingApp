import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('../src/lib/ons', () => ({
  fetchCpiRates: vi.fn().mockResolvedValue({ '2025': 2.6 }),
  cpiAdjust: vi.fn((amount) => amount),
}))

import YearVsYear from '../src/pages/YearVsYear'
import { supabase } from '../src/lib/supabase'

beforeEach(() => { vi.clearAllMocks() })

const rpcData = [
  { period: '2024-01', category: 'Groceries', total: 100 },
  { period: '2024-10', category: 'Groceries', total: 200 },
  { period: '2025-01', category: 'Groceries', total: 130 },
  { period: '2025-10', category: 'Groceries', total: 150 },
]

describe('YearVsYear', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    render(<YearVsYear />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders basis year selector and monthly table', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Oct')).toBeInTheDocument()
  })

  it('includes 2024 as a selectable basis year', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    const options = screen.getAllByRole('option').map(o => o.textContent)
    expect(options).toContain('2024')
  })

  it('shows CPI toggle checkbox', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByLabelText(/inflation/i)).toBeInTheDocument())
  })
})
