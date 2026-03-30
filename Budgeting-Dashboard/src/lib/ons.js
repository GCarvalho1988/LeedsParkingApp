// src/lib/ons.js
const ONS_URL = '/.netlify/functions/ons-cpi'

const MONTH_ABBR = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

/**
 * Fetches CPIH monthly 12-month rates from ONS API.
 * Returns { "2026-01": 3.7, "2025-12": 3.5, ... }
 * The 12-month rate for a given period is the year-on-year inflation for that calendar month.
 */
export async function fetchCpiRates() {
  const res = await fetch(ONS_URL)
  if (!res.ok) throw new Error(`ONS API failed: ${res.status}`)
  const json = await res.json()
  const rates = {}
  json.months?.forEach(({ date, value }) => {
    // ONS date format: "2026 JAN"
    const [year, mon] = date.split(' ')
    const mm = MONTH_ABBR[mon]
    if (mm) rates[`${year}-${mm}`] = parseFloat(value)
  })
  return rates
}

/**
 * Adjusts `amount` from py-month prices to cy-month prices using the monthly 12-month CPIH rate.
 * cyPeriod: "YYYY-MM" string for the corresponding month in the current year (e.g. "2026-01").
 * The 12-month rate is already the year-on-year ratio — apply it directly.
 * Returns amount unchanged if the rate is unavailable (factor = 1).
 */
export function cpiAdjustMonth(amount, cyPeriod, rates) {
  return amount * (1 + (rates[cyPeriod] ?? 0) / 100)
}
