import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function YearVsYear() {
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(null)
  const [prevYear, setPrevYear] = useState(null)
  const [rows, setRows] = useState([])
  const [catRows, setCatRows] = useState([])
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase.from('transactions').select('date, amount, category')

      const byYearMonth = {}
      const byCatYear = {}
      tx?.forEach(t => {
        const [y, m] = t.date.split('-')
        const yr = Number(y), mo = Number(m)
        const amt = Number(t.amount)
        if (!byYearMonth[yr]) byYearMonth[yr] = {}
        byYearMonth[yr][mo] = (byYearMonth[yr][mo] || 0) + amt
        const key = `${t.category}|${yr}`
        byCatYear[key] = (byCatYear[key] || 0) + amt
      })

      const years = Object.keys(byYearMonth).map(Number).sort()
      const cy = years[years.length - 1]
      const py = cy - 1
      setCurrentYear(cy)
      setPrevYear(py)

      const monthRows = MONTHS.map((label, i) => {
        const mo = i + 1
        const cur = byYearMonth[cy]?.[mo] ?? null
        const prev = byYearMonth[py]?.[mo] ?? null
        const delta = cur !== null && prev !== null ? Math.round(((cur - prev) / prev) * 100) : null
        return { label, cur, prev, delta }
      })
      setRows(monthRows)

      const completedMonths = monthRows.filter(r => r.cur !== null)
      if (completedMonths.length > 0) {
        const avg = completedMonths.reduce((s, r) => s + r.cur, 0) / completedMonths.length
        setForecast(Math.round(avg * 12))
      }

      const categories = [...new Set(tx?.map(t => t.category))].sort()
      setCatRows(categories.map(cat => {
        const cur = byCatYear[`${cat}|${cy}`] ?? 0
        const prev = byCatYear[`${cat}|${py}`] ?? 0
        const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
        return { cat, cur, prev, delta }
      }).sort((a, b) => b.cur - a.cur))

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-gray-400 py-8">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Monthly: {prevYear} vs {currentYear}</h2>
          {forecast && <span className="text-sm text-gray-500">{currentYear} forecast: <strong className="text-gray-900">{formatGBP(forecast)}</strong></span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2 text-gray-500 font-medium">Month</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{prevYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{currentYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.label}>
                  <td className="px-5 py-2.5 text-gray-900">{r.label}</td>
                  <td className="px-5 py-2.5 text-right text-gray-500">{r.prev !== null ? formatGBP(r.prev) : '—'}</td>
                  <td className="px-5 py-2.5 text-right text-gray-900 font-medium">{r.cur !== null ? formatGBP(r.cur) : '—'}</td>
                  <td className={`px-5 py-2.5 text-right font-medium ${r.delta === null ? 'text-gray-300' : r.delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {r.delta !== null ? `${r.delta > 0 ? '+' : ''}${r.delta}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">By Category: {prevYear} vs {currentYear}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2 text-gray-500 font-medium">Category</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{prevYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{currentYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {catRows.map(r => (
                <tr key={r.cat}>
                  <td className="px-5 py-2.5 text-gray-900">{r.cat}</td>
                  <td className="px-5 py-2.5 text-right text-gray-500">{formatGBP(r.prev)}</td>
                  <td className="px-5 py-2.5 text-right text-gray-900 font-medium">{formatGBP(r.cur)}</td>
                  <td className={`px-5 py-2.5 text-right font-medium ${r.delta === null ? 'text-gray-300' : r.delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {r.delta !== null ? `${r.delta > 0 ? '+' : ''}${r.delta}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
