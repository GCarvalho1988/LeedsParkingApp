import { describe, it, expect, vi } from 'vitest'

// Extracted logic: build the Supabase update call
function buildCategoryUpdate(supabase, txId, newCategory) {
  return supabase.from('transactions').update({ category: newCategory }).eq('id', txId)
}

describe('buildCategoryUpdate', () => {
  it('calls update with the correct category and id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const supabase = { from }

    await buildCategoryUpdate(supabase, 'abc-123', 'Groceries')

    expect(from).toHaveBeenCalledWith('transactions')
    expect(update).toHaveBeenCalledWith({ category: 'Groceries' })
    expect(eq).toHaveBeenCalledWith('id', 'abc-123')
  })

  it('does not send extra fields', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const supabase = { from }

    await buildCategoryUpdate(supabase, 'xyz-999', 'Eating out')

    expect(update).toHaveBeenCalledWith({ category: 'Eating out' })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ date: expect.anything() }))
  })
})
