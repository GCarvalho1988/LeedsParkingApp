// tests/Review.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, vi } from 'vitest'
import Review from '../src/pages/Review'

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          then: vi.fn(cb => cb({ data: [] })),
        })),
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
        not: vi.fn(() => ({
          then: vi.fn(cb => cb({ data: [], count: 0 })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}))

describe('Review', () => {
  it('renders without crashing', () => {
    render(<Review />)
  })
})
