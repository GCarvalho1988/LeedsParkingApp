import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [selected, setSelected] = useState(null)
  const [monthData, setMonthData] = useState([])
  const [yoy, setYoy] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('transactions').select('category').then(({ data }) => {
      const cats = [...new Set(data?.map(t => t.category))].sort()
      setCategories(cats)
      if (cats.length) setSelected(cats[0])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    async function load() {
      const { data: txs } = await supabase
        .from('transactions')
        .select('date, amount, description')
        .eq('category', selected)
        .order('date', { ascending: false })

      setTransactions(txs || [])

      const monthMap = {}
      txs?.forEach(t => {
        const mo = t.date.slice(0, 7)
        monthMap[mo] = (monthMap[mo] || 0) + Number(t.amount)
      })
      const trend = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mo, amount]) => {
          const [y, m] = mo.split('-')
          const label = new Date(Number(y), Number(m) - 1)
            .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
          return { month: label, amount: Math.round(amount) }
        })

      const byYear = {}
      txs?.forEach(t => {
        const yr = t.date.slice(0, 4)
        byYear[yr] = (byYear[yr] || 0) + Number(t.amount)
      })
      const years = Object.keys(byYear).sort()
      const cy = years[years.length - 1]
      const py = String(Number(cy) - 1)
      const yoyDelta = byYear[py]
        ? Math.round(((byYear[cy] - byYear[py]) / byYear[py]) * 100)
        : null

      setYoy({ cy, py, cyTotal: byYear[cy] ?? 0, pyTotal: byYear[py] ?? 0, delta: yoyDelta })
      setMonthData(trend)
    }
    load()
  }, [selected])

  if (loading) return <div className="text-gray-400 py-8">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selected === cat
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {yoy && (
            <div className="flex gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{yoy.py} Total</p>
                <p className="text-xl font-bold text-gray-900">{formatGBP(yoy.pyTotal)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{yoy.cy} Total</p>
                <p className="text-xl font-bold text-gray-900">{formatGBP(yoy.cyTotal)}</p>
                {yoy.delta !== null && (
                  <p className={`text-sm ${yoy.delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {yoy.delta > 0 ? '↑' : '↓'} {Math.abs(yoy.delta)}% YoY
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{selected} — Monthly Spend</h2>
            <MonthlyTrendChart data={monthData} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Transactions in {selected}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => (
                <div key={tx.date + tx.description + tx.amount} className="px-5 py-3 flex justify-between text-sm">
                  <div>
                    <p className="text-gray-900">{tx.description}</p>
                    <p className="text-gray-400 text-xs">{tx.date}</p>
                  </div>
                  <p className="text-gray-900 font-medium">{formatGBP(tx.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
