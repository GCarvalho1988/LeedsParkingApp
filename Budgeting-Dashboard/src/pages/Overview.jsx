import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import MonthlyTrendChart from '../components/MonthlyTrendChart'
import { bucketCategory } from '../lib/categories'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'
export { nextPeriodBoundary } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return <span className="text-[#35211A]">—</span>
  const max = Math.max(...values, 1)
  const w = 64, h = 20
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke="#DC9F85" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function Overview() {
  const [allCatData, setAllCatData]       = useState(null)
  const [salaryByPeriod, setSalaryByPeriod] = useState(null)
  const [periods, setPeriods]             = useState([])
  const [periodIndex, setPeriodIndex]     = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: catData, error: catErr }, salaryResult] = await Promise.all([
        supabase.rpc('get_monthly_category_totals'),
        supabase
          .from('income')
          .select('date, amount')
          .eq('category', 'Salary')
          .then(({ data, error }) => ({ data, error })),
      ])
      if (catErr) console.error('get_monthly_category_totals failed:', catErr.message)
      if (salaryResult.error) console.error('salary query failed:', salaryResult.error.message)

      const salaryMap = {}
      salaryResult.data?.forEach(r => {
        const p = r.date.slice(0, 7)
        salaryMap[p] = (salaryMap[p] || 0) + Number(r.amount)
      })

      const ps = [...new Set((catData ?? []).map(r => r.period))].sort()
      setAllCatData(catData ?? [])
      setSalaryByPeriod(salaryMap)
      setPeriods(ps)
      setPeriodIndex(ps.length > 0 ? ps.length - 1 : null)
    }
    load()
  }, [])

  const loading = allCatData === null || salaryByPeriod === null
  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet. Upload a CSV to get started.</div>

  const period     = periodIndex !== null ? periods[periodIndex] : null
  const prevPeriod = periodIndex > 0 ? periods[periodIndex - 1] : null

  const periodRows = allCatData.filter(r => r.period === period)
  const prevRows   = prevPeriod ? allCatData.filter(r => r.period === prevPeriod) : []

  function sumBucket(rows, bucket) {
    return rows.filter(r => bucketCategory(r.category) === bucket).reduce((s, r) => s + Number(r.total), 0)
  }

  const bills         = sumBucket(periodRows, 'bills')
  const discretionary = sumBucket(periodRows, 'discretionary')
  const income        = Number(salaryByPeriod[period] ?? 0)
  const cashflow      = income - bills - discretionary

  const prevBills         = sumBucket(prevRows, 'bills')
  const prevDiscretionary = sumBucket(prevRows, 'discretionary')
  const prevIncome        = Number(salaryByPeriod[prevPeriod] ?? 0)

  function pctDelta(cur, prev) {
    if (!prev) return undefined
    return Math.round(((cur - prev) / prev) * 100)
  }

  const discretionaryItems = periodRows
    .filter(r => bucketCategory(r.category) === 'discretionary')
    .map(r => {
      const thisMo   = Math.round(Number(r.total))
      const lastMoRow = prevRows.find(p => p.category === r.category)
      const lastMo   = lastMoRow ? Math.round(Number(lastMoRow.total)) : null
      const delta    = lastMo ? Math.round(((thisMo - lastMo) / lastMo) * 100) : null

      const last6 = periods.slice(-6).map(p => {
        const row = allCatData.find(d => d.period === p && d.category === r.category)
        return row ? Math.round(Number(row.total)) : 0
      })

      return { name: r.category, thisMo, lastMo, delta, last6 }
    })
    .sort((a, b) => b.thisMo - a.thisMo)

  const discretionaryTotal = discretionaryItems.reduce((s, i) => s + i.thisMo, 0)

  let cumulative = 0
  const cashflowTrend = periods.map(p => {
    const rows  = allCatData.filter(r => r.period === p)
    const spend = sumBucket(rows, 'bills') + sumBucket(rows, 'discretionary')
    const inc   = Number(salaryByPeriod[p] ?? 0)
    cumulative += inc - spend
    const [y, m] = p.split('-')
    const label  = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    return { month: label, amount: Math.round(cumulative) }
  })

  return (
    <div className="space-y-6">
      {/* Month picker */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPeriodIndex(i => Math.max(0, i - 1))}
          disabled={periodIndex === 0}
          className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
        >‹</button>
        <span
          className="text-[#EBDCC4] text-sm uppercase tracking-widest font-semibold"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          {formatPeriodLabel(period)}
        </span>
        <button
          onClick={() => setPeriodIndex(i => Math.min(periods.length - 1, i + 1))}
          disabled={periodIndex === periods.length - 1}
          className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
        >›</button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Bills & Fixed"
          value={formatGBP(bills)}
          delta={pctDelta(bills, prevBills)}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="Discretionary"
          value={formatGBP(discretionary)}
          delta={pctDelta(discretionary, prevDiscretionary)}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="Income"
          value={income > 0 ? formatGBP(income) : '—'}
          delta={pctDelta(income, prevIncome)}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="Cashflow"
          value={formatGBP(cashflow)}
          muted={cashflow < 0}
        />
      </div>

      {/* Discretionary Breakdown table */}
      {discretionaryItems.length > 0 && (
        <div className="border border-[#66473B] rounded p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2
              className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              Discretionary Breakdown
            </h2>
            <span className="text-sm font-bold text-[#EBDCC4]" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
              {formatGBP(discretionaryTotal)}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">Category</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">Last month</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">This month</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">Δ</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">6M</th>
              </tr>
            </thead>
            <tbody>
              {discretionaryItems.map(item => (
                <tr key={item.name} className="border-t border-[#35211A]">
                  <td className="py-2 text-xs text-[#EBDCC4]">{item.name}</td>
                  <td className="py-2 text-xs text-right text-[#B6A596] tabular-nums">
                    {item.lastMo !== null ? formatGBP(item.lastMo) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="py-2 text-xs text-right text-[#EBDCC4] font-medium tabular-nums">
                    {formatGBP(item.thisMo)}
                  </td>
                  <td className={`py-2 text-xs text-right font-medium tabular-nums ${
                    item.delta > 0 ? 'text-[#DC9F85]' : item.delta < 0 ? 'text-[#B6A596]' : 'text-[#66473B]'
                  }`}>
                    {item.delta !== null && item.delta !== 0
                      ? `${item.delta > 0 ? '+' : ''}${item.delta}%`
                      : <span className="text-[#35211A]">—</span>
                    }
                  </td>
                  <td className="py-2 text-right pl-3">
                    <Sparkline values={item.last6} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cumulative Cashflow chart */}
      <div className="border border-[#66473B] rounded p-5">
        <h2
          className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          Cumulative Cashflow
        </h2>
        <MonthlyTrendChart data={cashflowTrend} />
      </div>
    </div>
  )
}
