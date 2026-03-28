import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchCpiRates, cpiAdjust } from '../src/lib/ons'

describe('cpiAdjust', () => {
  it('returns amount unchanged when fromYear >= toYear', () => {
    expect(cpiAdjust(1000, 2025, 2024, { '2025': 3.0 })).toBe(1000)
    expect(cpiAdjust(1000, 2025, 2025, {})).toBe(1000)
  })

  it('adjusts one year forward using CPI rate', () => {
    const result = cpiAdjust(1000, 2024, 2025, { '2025': 2.6 })
    expect(result).toBeCloseTo(1026, 0)
  })

  it('compounds across two years', () => {
    const result = cpiAdjust(1000, 2023, 2025, { '2024': 6.7, '2025': 2.6 })
    expect(result).toBeCloseTo(1094.42, 0)
  })

  it('treats missing year as 0% inflation', () => {
    const result = cpiAdjust(1000, 2024, 2025, {})
    expect(result).toBe(1000)
  })
})

describe('fetchCpiRates', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns a map of year → rate from ONS annual array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        annual: [
          { date: '2023', value: '6.7' },
          { date: '2024', value: '2.6' },
        ],
      }),
    })
    const rates = await fetchCpiRates()
    expect(rates).toEqual({ '2023': 6.7, '2024': 2.6 })
    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/ons-cpi')
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchCpiRates()).rejects.toThrow('ONS API failed: 500')
  })
})
