import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import FlagButton from '../components/FlagButton'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ month: '', category: '', minAmount: '', maxAmount: '' })
  const [categories, setCategories] = useState([])
  const [months, setMonths] = useState([])

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .order('date', { ascending: false })

      const { data: flagData } = await supabase
        .from('flags')
        .select('id, transaction_id, comment, created_at')

      const flagMap = {}
      flagData?.forEach(f => {
        if (!flagMap[f.transaction_id]) flagMap[f.transaction_id] = []
        flagMap[f.transaction_id].push(f)
      })

      setTransactions(tx || [])
      setFlags(flagMap)
      setCategories([...new Set(tx?.map(t => t.category))].sort())
      setMonths([...new Set(tx?.map(t => t.date.slice(0, 7)))].sort().reverse())
      setLoading(false)
    }
    load()
  }, [])

  const filtered = transactions.filter(tx => {
    if (filters.month && !tx.date.startsWith(filters.month)) return false
    if (filters.category && tx.category !== filters.category) return false
    if (filters.minAmount !== '' && Number(tx.amount) < filters.minAmount) return false
    if (filters.maxAmount !== '' && Number(tx.amount) > filters.maxAmount) return false
    return true
  })

  if (loading) return <div className="text-gray-400 py-8">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.month}
          onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min £"
            onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value ? Number(e.target.value) : '' }))}
            className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Max £"
            onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value ? Number(e.target.value) : '' }))}
            className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-sm text-gray-400 self-center">{filtered.length} transactions</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Description</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Category</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(tx => (
                <tr key={tx.id} className={flags[tx.id]?.length ? 'bg-amber-50/30' : ''}>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{tx.date}</td>
                  <td className="px-5 py-3 text-gray-900">{tx.description}</td>
                  <td className="px-5 py-3 text-gray-500">{tx.category}</td>
                  <td className="px-5 py-3 text-right text-gray-900 font-medium">{formatGBP(tx.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <FlagButton transactionId={tx.id} existingFlags={flags[tx.id] || []} />
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
