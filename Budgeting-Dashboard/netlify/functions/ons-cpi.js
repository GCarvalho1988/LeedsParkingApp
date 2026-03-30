// netlify/functions/ons-cpi.js
const ONS_API_URL = 'https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data'

// Hardcoded CPIH monthly 12-month rates — used when ONS API is unreachable.
// Source: ONS CPIH timeseries L522. Update when new months are published.
// 2024 values are final. 2025 values are provisional until ONS publishes the official figures.
const FALLBACK = {
  months: [
    { date: '2024 JAN', value: '4.2' },
    { date: '2024 FEB', value: '3.8' },
    { date: '2024 MAR', value: '3.8' },
    { date: '2024 APR', value: '3.0' },
    { date: '2024 MAY', value: '2.8' },
    { date: '2024 JUN', value: '2.8' },
    { date: '2024 JUL', value: '3.1' },
    { date: '2024 AUG', value: '3.3' },
    { date: '2024 SEP', value: '2.6' },
    { date: '2024 OCT', value: '3.2' },
    { date: '2024 NOV', value: '3.5' },
    { date: '2024 DEC', value: '3.0' },
    { date: '2025 JAN', value: '3.0' },
    { date: '2025 FEB', value: '3.1' },
    { date: '2025 MAR', value: '3.4' },
    { date: '2025 APR', value: '3.4' },
    { date: '2025 MAY', value: '3.5' },
    { date: '2025 JUN', value: '3.5' },
    { date: '2025 JUL', value: '3.3' },
    { date: '2025 AUG', value: '3.1' },
  ],
}

export const handler = async () => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(ONS_API_URL, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`ONS returned ${res.status}`)
    const data = await res.json()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      body: JSON.stringify(data),
    }
  } catch {
    // ONS unreachable (geo-block, timeout, network) — serve hardcoded fallback
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify(FALLBACK),
    }
  }
}
