// src/lib/ons.js
const ONS_URL = 'https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data'

/**
 * Fetches CPIH 12-month annual rates from ONS API.
 * Returns { "2023": 6.7, "2024": 2.6, ... }
 */
export async function fetchCpiRates() {
  const res = await fetch(ONS_URL)
  if (!res.ok) throw new Error(`ONS API failed: ${res.status}`)
  const json = await res.json()
  const rates = {}
  json.annual?.forEach(({ date, value }) => {
    rates[date] = parseFloat(value)
  })
  return rates
}

/**
 * Adjusts `amount` from `fromYear` to `toYear` using CPI rates.
 * Compounds annual rates. Returns amount unchanged if fromYear >= toYear.
 */
export function cpiAdjust(amount, fromYear, toYear, rates) {
  if (fromYear >= toYear) return amount
  let factor = 1
  for (let y = fromYear + 1; y <= toYear; y++) {
    factor *= 1 + (rates[String(y)] ?? 0) / 100
  }
  return amount * factor
}
