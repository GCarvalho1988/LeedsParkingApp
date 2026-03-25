import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  return { supabase: { from: vi.fn().mockReturnValue(chain), _chain: chain } }
})

import Categories from '../src/pages/Categories'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._chain)
})

describe('Categories', () => {
  it('shows loading state initially', () => {
    supabase._chain.then.mockReturnValue(new Promise(() => {}))
    render(<Categories />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders category pills after load', async () => {
    const catData = [{ category: 'Groceries' }, { category: 'Transport' }, { category: 'Groceries' }]
    // First call: .then(cb) for category list — invoke callback directly
    supabase._chain.then.mockImplementationOnce(cb => Promise.resolve(cb({ data: catData })))
    // Second useEffect awaits the chain; return empty transactions so no slice errors
    supabase._chain.then.mockImplementation(cb => Promise.resolve(cb({ data: [] })))
    supabase._chain.order.mockReturnThis()
    render(<Categories />)
    await waitFor(() => expect(screen.getByText('Groceries')).toBeInTheDocument())
    expect(screen.getByText('Transport')).toBeInTheDocument()
  })
})
