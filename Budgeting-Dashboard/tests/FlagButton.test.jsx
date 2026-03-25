import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/lib/supabase', () => {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }
  return { supabase: { from: vi.fn().mockReturnValue(chain), _chain: chain } }
})

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

import FlagButton from '../src/components/FlagButton'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._chain)
  supabase._chain.insert.mockReturnThis()
  supabase._chain.select.mockReturnThis()
})

describe('FlagButton', () => {
  it('renders unflagged by default', () => {
    render(<FlagButton transactionId="tx-1" />)
    const btn = screen.getByTitle('Flag transaction')
    expect(btn).toBeInTheDocument()
  })

  it('shows flag count in title when flags exist', () => {
    render(<FlagButton transactionId="tx-1" existingFlags={[{ id: 'f1', comment: 'check this' }]} />)
    expect(screen.getByTitle('1 flag(s)')).toBeInTheDocument()
  })

  it('opens comment panel when clicked', async () => {
    render(<FlagButton transactionId="tx-1" />)
    await userEvent.click(screen.getByTitle('Flag transaction'))
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
  })

  it('submits flag and closes panel', async () => {
    supabase._chain.single.mockResolvedValue({
      data: { id: 'f2', comment: 'suspicious', user_id: 'user-1' },
    })
    render(<FlagButton transactionId="tx-1" />)
    await userEvent.click(screen.getByTitle('Flag transaction'))
    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), 'suspicious')
    await userEvent.click(screen.getByText('Save'))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument()
    )
  })
})
