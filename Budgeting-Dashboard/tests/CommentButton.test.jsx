import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/lib/supabase', () => {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  }
  return { supabase: { from: vi.fn().mockReturnValue(chain), _chain: chain } }
})

vi.mock('../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import CommentButton from '../src/components/CommentButton'
import { supabase } from '../src/lib/supabase'
import { useAuth } from '../src/context/AuthContext'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._chain)
  supabase._chain.insert.mockReturnThis()
  supabase._chain.select.mockReturnThis()
  supabase._chain.delete.mockReturnThis()
  supabase._chain.eq.mockResolvedValue({ error: null })
  useAuth.mockReturnValue({ user: { id: 'user-1' }, role: 'member' })
})

describe('CommentButton', () => {
  it('renders as an icon button with title when no comments', () => {
    render(<CommentButton transactionId="tx-1" />)
    expect(screen.getByTitle('Add a comment')).toBeInTheDocument()
  })

  it('shows comment count in title when comments exist', () => {
    render(<CommentButton transactionId="tx-1" existingFlags={[{ id: 'f1', comment: 'check this', user_id: 'user-2', profiles: { display_name: 'Dulce' } }]} />)
    expect(screen.getByTitle('1 comment(s)')).toBeInTheDocument()
  })

  it('opens comment panel when clicked', async () => {
    render(<CommentButton transactionId="tx-1" />)
    await userEvent.click(screen.getByTitle('Add a comment'))
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
  })

  it('inserts with type comment when saving', async () => {
    supabase._chain.single.mockResolvedValue({
      data: { id: 'f2', comment: 'suspicious', user_id: 'user-1', type: 'comment', profiles: { display_name: 'Gui' } },
    })
    render(<CommentButton transactionId="tx-1" />)
    await userEvent.click(screen.getByTitle('Add a comment'))
    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), 'suspicious')
    await userEvent.click(screen.getByText('Save'))
    expect(supabase._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'comment', comment: 'suspicious' })
    )
  })

  it('submits comment and closes panel', async () => {
    supabase._chain.single.mockResolvedValue({
      data: { id: 'f2', comment: 'suspicious', user_id: 'user-1', type: 'comment', profiles: { display_name: 'Gui' } },
    })
    render(<CommentButton transactionId="tx-1" />)
    await userEvent.click(screen.getByTitle('Add a comment'))
    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), 'suspicious')
    await userEvent.click(screen.getByText('Save'))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument()
    )
  })

  it('shows comment author name from profiles.display_name', async () => {
    render(
      <CommentButton
        transactionId="tx-1"
        existingFlags={[{
          id: 'f1',
          comment: 'check this',
          user_id: 'user-2',
          profiles: { display_name: 'Dulce' },
        }]}
      />
    )
    await userEvent.click(screen.getByTitle('1 comment(s)'))
    expect(screen.getByText('Dulce')).toBeInTheDocument()
  })

  it('shows delete button on own comment', async () => {
    render(
      <CommentButton
        transactionId="tx-1"
        existingFlags={[{
          id: 'f1',
          comment: 'mine',
          user_id: 'user-1',
          profiles: { display_name: 'Gui' },
        }]}
      />
    )
    await userEvent.click(screen.getByTitle('1 comment(s)'))
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument()
  })

  it('hides delete button on another user comment when not admin', async () => {
    render(
      <CommentButton
        transactionId="tx-1"
        existingFlags={[{
          id: 'f1',
          comment: 'not mine',
          user_id: 'user-2',
          profiles: { display_name: 'Dulce' },
        }]}
      />
    )
    await userEvent.click(screen.getByTitle('1 comment(s)'))
    expect(screen.queryByRole('button', { name: /delete comment/i })).not.toBeInTheDocument()
  })

  it('shows delete button for admin on any comment', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, role: 'admin' })
    render(
      <CommentButton
        transactionId="tx-1"
        existingFlags={[{
          id: 'f1',
          comment: 'not mine',
          user_id: 'user-2',
          profiles: { display_name: 'Dulce' },
        }]}
      />
    )
    await userEvent.click(screen.getByTitle('1 comment(s)'))
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument()
  })

  it('deletes comment and removes it from the list', async () => {
    render(
      <CommentButton
        transactionId="tx-1"
        existingFlags={[{
          id: 'f1',
          comment: 'mine',
          user_id: 'user-1',
          profiles: { display_name: 'Gui' },
        }]}
      />
    )
    await userEvent.click(screen.getByTitle('1 comment(s)'))
    await userEvent.click(screen.getByRole('button', { name: /delete comment/i }))
    await waitFor(() => expect(screen.queryByText('mine')).not.toBeInTheDocument())
    expect(supabase._chain.delete).toHaveBeenCalled()
    expect(supabase._chain.eq).toHaveBeenCalledWith('id', 'f1')
  })
})
