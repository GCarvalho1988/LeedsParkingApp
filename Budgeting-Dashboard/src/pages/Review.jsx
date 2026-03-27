// src/pages/Review.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BILLS_CATEGORIES, TRANSIENT_CATEGORIES } from '../lib/categories'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sortTransactions(txs) {
  const clothing = txs.filter(t => t.category === 'Clothing & shoes')
    .sort((a, b) => b.date.localeCompare(a.date))
  const rest = txs.filter(t => t.category !== 'Clothing & shoes')
    .sort((a, b) => a.category.localeCompare(b.category) || b.date.localeCompare(a.date))
  return [...clothing, ...rest]
}

export default function Review() {
  const [periods, setPeriods] = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  // Load available periods
  useEffect(() => {
    supabase
      .from('uploads')
      .select('period')
      .order('period', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('uploads query failed:', error.message); return }
        const ps = data?.map(r => r.period) ?? []
        setPeriods(ps)
        setPeriodIndex(ps.length - 1)
      })
  }, [])

  const period = periodIndex !== null ? periods[periodIndex] : null

  // Load unreviewed transactions for selected period
  useEffect(() => {
    if (!period) return
    setLoading(true)

    const billsArr = [...BILLS_CATEGORIES]
    const transientArr = [...TRANSIENT_CATEGORIES]
    const excluded = [...billsArr, ...transientArr]

    supabase
      .from('transactions')
      .select('id, date, description, amount, category')
      .gte('date', `${period}-01`)
      .lt('date', nextPeriodBoundary(period))
      .not('category', 'in', `(${excluded.map(c => `"${c}"`).join(',')})`)
      .then(({ data, error }) => {
        if (error) { console.error('transactions query failed:', error.message); setLoading(false); return }
        setTransactions(sortTransactions(data ?? []))
        setLoading(false)
      })
  }, [period])

  async function tag(txId, newCategory) {
    const { error } = await supabase
      .from('transactions')
      .update({ category: newCategory })
      .eq('id', txId)
    if (!error) {
      setTransactions(prev => prev.filter(t => t.id !== txId))
    }
  }

  if (periodIndex === null) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet.</div>

  return (
    <div className="space-y-6">
      {/* Period picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPeriodIndex(i => Math.max(0, i - 1))}
            disabled={periodIndex === 0}
            className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
          >
            ‹
          </button>
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
          >
            ›
          </button>
        </div>
        {!loading && (
          <span className="text-xs text-[#B6A596]">
            <span className="text-[#EBDCC4] font-semibold">{transactions.length}</span> to review
          </span>
        )}
      </div>

      {/* Transaction list */}
      <div className="border border-[#66473B] rounded">
        {loading ? (
          <div className="px-5 py-8 text-[#B6A596] text-sm">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="px-5 py-8 text-[#B6A596] text-sm">All done — nothing left to review.</div>
        ) : (
          transactions.map((tx, idx) => (
            <div
              key={tx.id}
              className={`px-5 py-3 flex items-center gap-4 border-b border-[#35211A] last:border-0 ${
                idx % 2 === 1 ? 'bg-white/[0.02]' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                <p className="text-xs text-[#66473B] mt-0.5">
                  {tx.date} · <span className="text-[#B6A596]">{tx.category}</span>
                </p>
              </div>
              <p className="text-sm font-medium text-[#EBDCC4] shrink-0">{formatGBP(tx.amount)}</p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => tag(tx.id, 'Dulce Personal Purchases')}
                  className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  Personal
                </button>
                <button
                  onClick={() => tag(tx.id, 'Dulce Work Expenses')}
                  className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded border border-[#DC9F85] text-[#DC9F85] hover:bg-[#DC9F85]/10 transition-colors"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  Work
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
