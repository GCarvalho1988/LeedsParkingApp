// src/pages/Review.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Only these 4 categories are shown in Review
const REVIEW_CATEGORIES = [
  'Clothing & shoes',
  'General Merchandise',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
]

// Categories that are already resolved — pre-populate tagged list on load
const ALREADY_TAGGED = ['Dulce Personal Purchases', 'Dulce Work Expenses']

const SORT_ORDER = [
  'Clothing & shoes',
  'General Merchandise',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
]

function sortTransactions(txs) {
  const result = []
  for (const cat of SORT_ORDER) {
    result.push(...txs.filter(t => t.category === cat).sort((a, b) => b.date.localeCompare(a.date)))
  }
  // Any category not in SORT_ORDER (shouldn't happen, but safe)
  const rest = txs
    .filter(t => !SORT_ORDER.includes(t.category))
    .sort((a, b) => a.category.localeCompare(b.category) || b.date.localeCompare(a.date))
  return [...result, ...rest]
}

export default function Review() {
  const [periods, setPeriods]         = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [pending, setPending]         = useState([])
  const [tagged, setTagged]           = useState([]) // { tx, tag: 'personal' | 'work' }
  const [claim, setClaim]             = useState(null)
  const [loading, setLoading]         = useState(true)

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

  useEffect(() => {
    if (!period) return
    setLoading(true)
    setPending([])
    setTagged([])
    setClaim(null)

    Promise.all([
      supabase
        .from('expense_claims')
        .select('*')
        .eq('period', period)
        .then(({ data, error }) => {
          if (error) console.error('expense_claims query failed:', error.message)
          return data?.[0] ?? null
        }),
      supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .gte('date', `${period}-01`)
        .lt('date', nextPeriodBoundary(period))
        .filter('category', 'in', `(${REVIEW_CATEGORIES.map(c => `"${c}"`).join(',')})`)
        .then(({ data, error }) => {
          if (error) { console.error('transactions query failed:', error.message); return [] }
          return data ?? []
        }),
    ]).then(([existingClaim, txs]) => {
      setClaim(existingClaim)

      const preTagged = txs
        .filter(t => ALREADY_TAGGED.includes(t.category))
        .map(t => ({
          tx: t,
          tag: t.category === 'Dulce Personal Purchases' ? 'personal' : 'work',
        }))

      const pendingTxs = txs.filter(t => !ALREADY_TAGGED.includes(t.category))

      setPending(sortTransactions(pendingTxs))
      setTagged(preTagged)
      setLoading(false)
    })
  }, [period])

  function dismiss(tx) {
    setPending(prev => prev.filter(t => t.id !== tx.id))
  }

  async function tagPersonal(tx) {
    const { error } = await supabase
      .from('transactions')
      .update({ category: 'Dulce Personal Purchases' })
      .eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx: { ...tx, category: 'Dulce Personal Purchases' }, tag: 'personal' }])
    }
  }

  async function tagWork(tx) {
    const { error } = await supabase
      .from('transactions')
      .update({ category: 'Dulce Work Expenses' })
      .eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx: { ...tx, category: 'Dulce Work Expenses' }, tag: 'work' }])
    }
  }

  const totalPersonal = tagged
    .filter(t => t.tag === 'personal')
    .reduce((s, t) => s + Number(t.tx.amount), 0)
  const totalWork = tagged
    .filter(t => t.tag === 'work')
    .reduce((s, t) => s + Number(t.tx.amount), 0)

  async function markPersonalActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .upsert(
        { period, total_personal: totalPersonal, total_work: claim?.total_work ?? totalWork, personal_actioned_at: new Date().toISOString() },
        { onConflict: 'period' }
      )
    if (!error) setClaim(prev => ({
      ...(prev ?? { period, total_personal: totalPersonal, total_work: totalWork }),
      personal_actioned_at: new Date().toISOString(),
    }))
  }

  async function markWorkActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .upsert(
        { period, total_personal: claim?.total_personal ?? totalPersonal, total_work: totalWork, work_actioned_at: new Date().toISOString() },
        { onConflict: 'period' }
      )
    if (!error) setClaim(prev => ({
      ...(prev ?? { period, total_personal: totalPersonal, total_work: totalWork }),
      work_actioned_at: new Date().toISOString(),
    }))
  }

  if (periodIndex === null) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet.</div>

  return (
    <div className="space-y-6">
      {/* Period selector */}
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

      {/* Transaction list */}
      <div className="border border-[#66473B] rounded">
        {loading ? (
          <div className="px-5 py-8 text-[#B6A596] text-sm">Loading…</div>
        ) : pending.length === 0 && tagged.length === 0 ? (
          <div className="px-5 py-8 text-[#B6A596] text-sm">Nothing to review this period.</div>
        ) : (
          <>
            {/* Already-tagged items */}
            {tagged.map(({ tx, tag }) => (
              <div
                key={`tagged-${tx.id}`}
                className="px-5 py-3 flex items-center gap-4 border-b border-[#35211A] bg-white/[0.03]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                  <p className="text-xs text-[#66473B] mt-0.5">{tx.date} · <span className="text-[#B6A596]">{tx.category}</span></p>
                </div>
                <p className="text-sm font-medium text-[#EBDCC4] shrink-0">{formatGBP(tx.amount)}</p>
                <span
                  className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded shrink-0 ${
                    tag === 'personal' ? 'bg-[#DC9F85] text-[#181818]' : 'border border-[#DC9F85] text-[#DC9F85]'
                  }`}
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  {tag === 'personal' ? 'Personal' : 'Work'}
                </span>
              </div>
            ))}
            {/* Pending items */}
            {pending.map((tx, idx) => (
              <div
                key={tx.id}
                className={`px-5 py-3 flex items-center gap-4 border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                  <p className="text-xs text-[#66473B] mt-0.5">{tx.date} · <span className="text-[#B6A596]">{tx.category}</span></p>
                </div>
                <p className="text-sm font-medium text-[#EBDCC4] shrink-0">{formatGBP(tx.amount)}</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => tagPersonal(tx)}
                    className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >Personal</button>
                  <button
                    onClick={() => tagWork(tx)}
                    className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded border border-[#DC9F85] text-[#DC9F85] hover:bg-[#DC9F85]/10 transition-colors"
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >Work</button>
                  <button
                    onClick={() => dismiss(tx)}
                    className="text-xs font-medium px-3 py-1.5 rounded border border-[#66473B] text-[#B6A596] hover:border-[#B6A596] transition-colors"
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >Dismiss</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Summary table */}
      {(totalPersonal > 0 || totalWork > 0) && (
        <div className="border border-[#66473B] rounded p-5">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Transfers this period
          </h2>
          <table className="w-full">
            <tbody>
              {totalPersonal > 0 && (
                <tr className="border-b border-[#35211A] last:border-0">
                  <td className="py-2 text-xs text-[#B6A596]">Personal transfer</td>
                  <td className="py-2 text-xs text-right font-medium text-[#EBDCC4] tabular-nums">{formatGBP(totalPersonal)}</td>
                  <td className="py-2 text-right pl-4">
                    {claim?.personal_actioned_at ? (
                      <span className="text-xs text-[#66473B] uppercase tracking-widest">✓ Done</span>
                    ) : (
                      <button
                        onClick={markPersonalActioned}
                        className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                      >Mark done</button>
                    )}
                  </td>
                </tr>
              )}
              {totalWork > 0 && (
                <tr className="border-b border-[#35211A] last:border-0">
                  <td className="py-2 text-xs text-[#B6A596]">Work claim</td>
                  <td className="py-2 text-xs text-right font-medium text-[#EBDCC4] tabular-nums">{formatGBP(totalWork)}</td>
                  <td className="py-2 text-right pl-4">
                    {claim?.work_actioned_at ? (
                      <span className="text-xs text-[#66473B] uppercase tracking-widest">✓ Done</span>
                    ) : (
                      <button
                        onClick={markWorkActioned}
                        className="text-xs font-medium uppercase tracking-widest px-3 py-1 rounded border border-[#DC9F85] text-[#DC9F85] hover:bg-[#DC9F85]/10 transition-colors"
                        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                      >Mark done</button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
