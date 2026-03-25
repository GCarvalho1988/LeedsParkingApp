import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLOURS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#14b8a6','#f97316']

export default function CategoryBarChart({ data }) {
  // data: [{ category: 'Groceries', amount: 843 }, ...]
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
        <XAxis type="number" tickFormatter={v => `£${v}`} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={80} />
        <Tooltip formatter={v => [`£${v.toFixed(2)}`, 'Spend']} />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLOURS[i % COLOURS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
