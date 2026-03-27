import { describe, it, expect, vi } from 'vitest'

// Mock supabase so the Overview module can be imported without network calls
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { nextPeriodBoundary, computeRollingAverage } from '../src/pages/Overview.jsx'

describe('nextPeriodBoundary', () => {
  it('returns first day of next month for February', () => {
    expect(nextPeriodBoundary('2026-02')).toBe('2026-03-01')
  })

  it('rolls over to January of next year in December', () => {
    expect(nextPeriodBoundary('2025-12')).toBe('2026-01-01')
  })

  it('handles standard mid-year month', () => {
    expect(nextPeriodBoundary('2025-06')).toBe('2025-07-01')
  })
})

describe('computeRollingAverage', () => {
  it('returns correct avg for first month (window of 1)', () => {
    const data = [{ period: '2024-01', trueSpend: 1200 }]
    const result = computeRollingAverage(data, 6)
    expect(result[0].avg).toBe(1200)
  })

  it('averages available months when fewer than window exist', () => {
    const data = [
      { period: '2024-01', trueSpend: 1000 },
      { period: '2024-02', trueSpend: 2000 },
    ]
    const result = computeRollingAverage(data, 6)
    expect(result[0].avg).toBe(1000)
    expect(result[1].avg).toBe(1500) // (1000 + 2000) / 2
  })

  it('uses exactly 6 months when 6+ are available', () => {
    const data = Array.from({ length: 8 }, (_, i) => ({
      period: `2024-${String(i + 1).padStart(2, '0')}`,
      trueSpend: 1000,
    }))
    const result = computeRollingAverage(data, 6)
    // All values are 1000, so average is always 1000
    expect(result[7].avg).toBe(1000)
  })

  it('returns empty array for empty input', () => {
    expect(computeRollingAverage([], 6)).toEqual([])
  })
})
