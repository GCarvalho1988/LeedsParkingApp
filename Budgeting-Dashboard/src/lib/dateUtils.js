// src/lib/dateUtils.js

// Returns ISO date string for first day of month after period (YYYY-MM)
export function nextPeriodBoundary(period) {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function formatPeriodLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
