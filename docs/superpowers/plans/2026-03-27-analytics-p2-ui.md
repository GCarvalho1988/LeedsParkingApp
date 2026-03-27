# Analytics Overhaul — Plan 2: Analytics UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Overview page with 4 KPI cards + discretionary treemap + rolling average trend. Fix Year vs Year to use the new category RPC and add 2026 month forecasts. Fix Categories to use the distinct-categories RPC.

**Architecture:** All changes are in `src/`. No backend changes — the RPCs from Plan 1 supply the data. Overview loads everything on mount; period navigation is purely client-side.

**Tech Stack:** React 18, Recharts (Treemap + LineChart), Tailwind CSS v4

**Dependency:** Requires Plan 1 to be complete (categories.js and migration 003 must exist).

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/components/KpiCard.jsx` | add `subLine` and `muted` props |
| Modify | `src/components/MonthlyTrendChart.jsx` | add optional `avg` line (dashed) |
| Create | `src/components/DiscretionaryTreemap.jsx` | Recharts Treemap for discretionary spend |
| Rewrite | `src/pages/Overview.jsx` | 4-card layout + treemap + rolling avg + nursery sub-line |
| Rewrite | `src/pages/YearVsYear.jsx` | use get_monthly_category_totals, exclude transient, add 2026 forecasts |
| Modify | `src/pages/Categories.jsx` | replace .limit(10000) with get_distinct_categories() RPC |
| Modify | `tests/overview-date.test.jsx` | add tests for computeRollingAverage |

---

### Task 1: Update KpiCard with subLine and muted props

**Files:**
- Modify: `src/components/KpiCard.jsx`
- Modify: `tests/KpiCard.test.jsx`

Current `KpiCard` only supports `label`, `value`, `delta`, `deltaLabel`. We need:
- `subLine` — small secondary text shown below the value (for nursery amount on Bills card)
- `muted` — renders the value in muted colour `#66473B` instead of `#EBDCC4` (for the Transfers/excluded card)

- [ ] **Step 1: Write failing tests**

Open `tests/KpiCard.test.jsx`. Add after the existing tests:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import KpiCard from '../src/components/KpiCard'

describe('KpiCard — subLine prop', () => {
  it('renders subLine text when provided', () => {
    render(<KpiCard label="Bills" value="£1,200" subLine="Nursery £550" />)
    expect(screen.getByText('Nursery £550')).toBeTruthy()
  })

  it('does not render subLine element when not provided', () => {
    render(<KpiCard label="Bills" value="£1,200" />)
    expect(screen.queryByTestId('kpi-subline')).toBeNull()
  })
})

describe('KpiCard — muted prop', () => {
  it('renders value in muted colour when muted=true', () => {
    render(<KpiCard label="Transfers" value="£300" muted />)
    const valueEl = screen.getByText('£300')
    expect(valueEl.className).toContain('66473B')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/KpiCard.test.jsx
```
Expected: FAIL — subLine/muted not rendered yet

- [ ] **Step 3: Update KpiCard.jsx**

```jsx
// src/components/KpiCard.jsx
export default function KpiCard({ label, value, delta, deltaLabel, subLine, muted }) {
  const positive = delta > 0
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded p-5">
      <p
        className="text-xs font-medium text-[#B6A596] uppercase tracking-widest"
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-2 ${muted ? 'text-[#66473B]' : 'text-[#EBDCC4]'}`}
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {value}
      </p>
      {subLine && (
        <p className="text-xs text-[#B6A596] mt-1" data-testid="kpi-subline">
          {subLine}
        </p>
      )}
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${positive ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)}% {deltaLabel}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- tests/KpiCard.test.jsx
```
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/KpiCard.jsx tests/KpiCard.test.jsx
git commit -m "feat: KpiCard supports subLine and muted props"
```

---

### Task 2: Update MonthlyTrendChart for rolling average line

**Files:**
- Modify: `src/components/MonthlyTrendChart.jsx`

The chart currently takes `data: [{month, amount}]`. With the rolling average, Overview will pass `avg` as an additional field on each data point. The chart should render a second dashed muted line when any data point has an `avg` value.

- [ ] **Step 1: Write failing test**

Open `tests/charts.test.jsx`. Append:

```jsx
describe('MonthlyTrendChart — avg line', () => {
  const dataWithAvg = [
    { month: 'Jan 24', amount: 1200, avg: 1100 },
    { month: 'Feb 24', amount: 1350, avg: 1150 },
  ]
  const dataWithoutAvg = [
    { month: 'Jan 24', amount: 1200 },
    { month: 'Feb 24', amount: 1350 },
  ]

  it('renders without crashing when avgData is absent', () => {
    render(<MonthlyTrendChart data={dataWithoutAvg} />)
  })

  it('renders without crashing when avg field is present in data', () => {
    render(<MonthlyTrendChart data={dataWithAvg} />)
  })
})
```

- [ ] **Step 2: Run to verify baseline passes (no crash)**

```bash
npm test -- tests/charts.test.jsx
```
Expected: existing tests pass; new tests also pass (no crash — just checking render)

- [ ] **Step 3: Update MonthlyTrendChart.jsx**

```jsx
// src/components/MonthlyTrendChart.jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded px-3 py-2 text-xs text-[#EBDCC4]">
      <p className="text-[#B6A596] mb-1">{label}</p>
      {payload.map(entry =>
        entry.value !== undefined ? (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.dataKey === 'avg' ? '6m avg: ' : ''}
            £{Number(entry.value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        ) : null
      )}
    </div>
  )
}

export default function MonthlyTrendChart({ data }) {
  const hasAvg = data?.some(d => d.avg !== undefined)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#35211A" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#B6A596' }}
          axisLine={{ stroke: '#35211A' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `£${v}`}
          tick={{ fontSize: 11, fill: '#B6A596' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<DarkTooltip />} />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#DC9F85"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#DC9F85', stroke: '#181818', strokeWidth: 2 }}
        />
        {hasAvg && (
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#66473B"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/charts.test.jsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MonthlyTrendChart.jsx tests/charts.test.jsx
git commit -m "feat: MonthlyTrendChart renders optional 6-month rolling average line"
```

---

### Task 3: Create DiscretionaryTreemap component

**Files:**
- Create: `src/components/DiscretionaryTreemap.jsx`

Recharts `Treemap` with custom cell colours from the earth palette. Expects `data: [{name: string, size: number}]`.

- [ ] **Step 1: Write failing test**

Create `tests/DiscretionaryTreemap.test.jsx`:

```jsx
// tests/DiscretionaryTreemap.test.jsx
import { render } from '@testing-library/react'
import { describe, it } from 'vitest'
import DiscretionaryTreemap from '../src/components/DiscretionaryTreemap'

const SAMPLE_DATA = [
  { name: 'Groceries', size: 450 },
  { name: 'Eating out', size: 230 },
  { name: 'Clothing & shoes', size: 180 },
]

describe('DiscretionaryTreemap', () => {
  it('renders without crashing with valid data', () => {
    render(<DiscretionaryTreemap data={SAMPLE_DATA} />)
  })

  it('renders without crashing with empty data', () => {
    render(<DiscretionaryTreemap data={[]} />)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/DiscretionaryTreemap.test.jsx
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement DiscretionaryTreemap.jsx**

```jsx
// src/components/DiscretionaryTreemap.jsx
import { Treemap, ResponsiveContainer } from 'recharts'

const PALETTE = [
  '#DC9F85', '#B6A596', '#9a8070',
  '#66473B', '#C4A882', '#8B7355',
  '#EBDCC4', '#A08060',
]

function Cell({ x, y, width, height, name, fill }) {
  const showLabel = width > 50 && height > 24
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#181818" strokeWidth={2} />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fontWeight={600}
          fill="#181818"
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      )}
    </g>
  )
}

export default function DiscretionaryTreemap({ data }) {
  const colored = data.map((item, i) => ({
    ...item,
    fill: PALETTE[i % PALETTE.length],
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <Treemap
        data={colored}
        dataKey="size"
        nameKey="name"
        content={Cell}
      />
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- tests/DiscretionaryTreemap.test.jsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DiscretionaryTreemap.jsx tests/DiscretionaryTreemap.test.jsx
git commit -m "feat: add DiscretionaryTreemap component with earth palette"
```

---

### Task 4: Rewrite Overview.jsx

**Files:**
- Rewrite: `src/pages/Overview.jsx`
- Modify: `tests/overview-date.test.jsx`

Key changes:
- Two RPC calls on mount: `get_monthly_category_totals()` + `get_monthly_income()`
- Derive periods from RPC data (no uploads query)
- 4 KPI cards: Bills & Fixed (with nursery sub-line) | Discretionary | Transfers | Income
- Nursery sub-line: per-period query for `description ILIKE 'Vasco Nursery%'`
- Discretionary treemap (categories sorted by total)
- Monthly trend: true spend (bills + discretionary) with rolling 6-month average
- Export `computeRollingAverage` for testing

- [ ] **Step 1: Write failing test for computeRollingAverage**

Open `tests/overview-date.test.jsx`. Append:

```jsx
import { computeRollingAverage } from '../src/pages/Overview.jsx'

describe('computeRollingAverage', () => {
  it('returns correct avg for first month (window of 1)', () => {
    const data = [{ period: '2024-01', trueSpend: 1200 }]
    const result = computeRollingAverage(data, 6)
    expect(result[0].avg).toBe(1200)
  })

  it('averages available months when fewer than window exist', () => {
    const data = [
      { period: '2024-01', trueSpend: 1000 },
      { period: '2024-02', trueSpend: 2000 },
    ]
    const result = computeRollingAverage(data, 6)
    expect(result[0].avg).toBe(1000)
    expect(result[1].avg).toBe(1500) // (1000 + 2000) / 2
  })

  it('uses exactly 6 months when 6+ are available', () => {
    const data = Array.from({ length: 8 }, (_, i) => ({
      period: `2024-${String(i + 1).padStart(2, '0')}`,
      trueSpend: 1000,
    }))
    const result = computeRollingAverage(data, 6)
    // All values are 1000, so average is always 1000
    expect(result[7].avg).toBe(1000)
  })

  it('returns empty array for empty input', () => {
    expect(computeRollingAverage([], 6)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/overview-date.test.jsx
```
Expected: FAIL — `computeRollingAverage` not exported yet

- [ ] **Step 3: Rewrite Overview.jsx**

```jsx
// src/pages/Overview.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import MonthlyTrendChart from '../components/MonthlyTrendChart'
import DiscretionaryTreemap from '../components/DiscretionaryTreemap'
import { bucketCategory } from '../lib/categories'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Returns ISO date string for first day of month after period (YYYY-MM)
export function nextPeriodBoundary(period) {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Rolling average of trueSpend over a sliding window
// monthlyData: [{period: string, trueSpend: number}] sorted ascending
export function computeRollingAverage(monthlyData, window = 6) {
  return monthlyData.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = monthlyData.slice(start, i + 1)
    const avg = slice.reduce((s, x) => s + x.trueSpend, 0) / slice.length
    return { period: monthlyData[i].period, avg: Math.round(avg) }
  })
}

function formatPeriodLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function Overview() {
  const [allCatData, setAllCatData] = useState(null)  // [{period, category, total}]
  const [allIncomeData, setAllIncomeData] = useState(null)  // [{period, total}]
  const [periods, setPeriods] = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [nurseryTotal, setNurseryTotal] = useState(0)

  // Load all data once on mount
  useEffect(() => {
    async function load() {
      const [{ data: catData }, { data: incomeData }] = await Promise.all([
        supabase.rpc('get_monthly_category_totals'),
        supabase.rpc('get_monthly_income'),
      ])
      const ps = [...new Set((catData ?? []).map(r => r.period))].sort()
      setAllCatData(catData ?? [])
      setAllIncomeData(incomeData ?? [])
      setPeriods(ps)
      setPeriodIndex(ps.length > 0 ? ps.length - 1 : null)
    }
    load()
  }, [])

  const period = periodIndex !== null && periods.length > 0 ? periods[periodIndex] : null

  // Fetch nursery sub-total for selected period (the only per-period re-fetch)
  useEffect(() => {
    if (!period) return
    supabase
      .from('transactions')
      .select('amount')
      .ilike('description', 'Vasco Nursery%')
      .gte('date', `${period}-01`)
      .lt('date', nextPeriodBoundary(period))
      .then(({ data }) => {
        setNurseryTotal(data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0)
      })
  }, [period])

  // Derive KPIs for selected period from cached data
  const periodRows = period && allCatData
    ? allCatData.filter(r => r.period === period)
    : []

  const bills = periodRows
    .filter(r => bucketCategory(r.category) === 'bills')
    .reduce((s, r) => s + Number(r.total), 0)

  const discretionary = periodRows
    .filter(r => bucketCategory(r.category) === 'discretionary')
    .reduce((s, r) => s + Number(r.total), 0)

  const transient = periodRows
    .filter(r => bucketCategory(r.category) === 'transient')
    .reduce((s, r) => s + Number(r.total), 0)

  const income = allIncomeData
    ? Number(allIncomeData.find(r => r.period === period)?.total ?? 0)
    : 0

  // Discretionary treemap: categories for selected period, sorted by total
  const discretionaryItems = periodRows
    .filter(r => bucketCategory(r.category) === 'discretionary')
    .map(r => ({ name: r.category, size: Math.round(Number(r.total)) }))
    .sort((a, b) => b.size - a.size)

  // Monthly trend: true spend (bills + discretionary only) + 6-month rolling average
  const allPeriods = allCatData
    ? [...new Set(allCatData.map(r => r.period))].sort()
    : []

  const monthlyTrueSpend = allPeriods.map(p => {
    const rows = allCatData.filter(r => r.period === p)
    const trueSpend = rows
      .filter(r => bucketCategory(r.category) !== 'transient')
      .reduce((s, r) => s + Number(r.total), 0)
    return { period: p, trueSpend: Math.round(trueSpend) }
  })

  const rollingAvg = computeRollingAverage(monthlyTrueSpend)

  const trendData = monthlyTrueSpend.slice(-12).map((item, i) => {
    const [y, m] = item.period.split('-')
    const label = new Date(Number(y), Number(m) - 1)
      .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    const offset = monthlyTrueSpend.length - Math.min(12, monthlyTrueSpend.length)
    return {
      month: label,
      amount: item.trueSpend,
      avg: rollingAvg[offset + i]?.avg,
    }
  })

  const loading = allCatData === null || allIncomeData === null || periodIndex === null

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet. Upload a CSV to get started.</div>

  return (
    <div className="space-y-6">
      {/* Month picker */}
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

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Bills & Fixed"
          value={formatGBP(bills)}
          subLine={nurseryTotal > 0 ? `Nursery ${formatGBP(nurseryTotal)}` : undefined}
        />
        <KpiCard label="Discretionary" value={formatGBP(discretionary)} />
        <KpiCard label="Transfers" value={formatGBP(transient)} muted />
        <KpiCard label="Income" value={income > 0 ? formatGBP(income) : '—'} />
      </div>

      {/* Discretionary treemap */}
      {discretionaryItems.length > 0 && (
        <div className="border border-[#66473B] rounded p-5">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Discretionary Breakdown
          </h2>
          <DiscretionaryTreemap data={discretionaryItems} />
        </div>
      )}

      {/* Monthly trend with rolling average */}
      <div className="border border-[#66473B] rounded p-5">
        <h2
          className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          Monthly Trend
        </h2>
        <MonthlyTrendChart data={trendData} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/overview-date.test.jsx
```
Expected: PASS — `nextPeriodBoundary` tests still pass; `computeRollingAverage` tests now pass

- [ ] **Step 5: Commit**

```bash
git add src/pages/Overview.jsx tests/overview-date.test.jsx
git commit -m "feat: Overview rewritten with 4-card layout, treemap, rolling average trend"
```

---

### Task 5: Rewrite YearVsYear.jsx

**Files:**
- Rewrite: `src/pages/YearVsYear.jsx`

Key changes:
- Replace `.from('transactions').limit(10000)` with `supabase.rpc('get_monthly_category_totals')`
- Filter out transient categories before aggregating
- 2026 (incomplete year) month forecast: months with no data show `~£X,XXX` in muted colour, where X = average of known months in that year

- [ ] **Step 1: Rewrite YearVsYear.jsx**

No new unit tests needed for this task (the page is data-display; the logic is straightforward). After implementing, verify by running all tests to ensure no regressions.

```jsx
// src/pages/YearVsYear.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bucketCategory } from '../lib/categories'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function DeltaCell({ delta }) {
  if (delta === null) return <td className="px-5 py-2.5 text-right text-[#35211A]">—</td>
  return (
    <td className={`px-5 py-2.5 text-right font-medium ${delta > 0 ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
      {delta > 0 ? '+' : ''}{delta}%
    </td>
  )
}

const TH = ({ children, right }) => (
  <th
    className={`px-5 py-3 text-xs font-semibold text-[#B6A596] uppercase tracking-widest ${right ? 'text-right' : 'text-left'}`}
    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
  >
    {children}
  </th>
)

export default function YearVsYear() {
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(null)
  const [prevYear, setPrevYear] = useState(null)
  const [rows, setRows] = useState([])
  const [catRows, setCatRows] = useState([])
  const [forecast, setForecast] = useState(null)
  const [monthAvg, setMonthAvg] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_monthly_category_totals')

      const byYearMonth = {}
      const byCatYear = {}

      data?.forEach(({ period, category, total }) => {
        // Exclude transient categories from all calculations
        if (bucketCategory(category) === 'transient') return

        const [y, m] = period.split('-')
        const yr = Number(y), mo = Number(m)
        const amt = Number(total)

        if (!byYearMonth[yr]) byYearMonth[yr] = {}
        byYearMonth[yr][mo] = (byYearMonth[yr][mo] || 0) + amt

        const key = `${category}|${yr}`
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

      // Forecast: average of completed months in the current year
      const completedMonths = monthRows.filter(r => r.cur !== null)
      if (completedMonths.length > 0) {
        const avg = completedMonths.reduce((s, r) => s + r.cur, 0) / completedMonths.length
        setMonthAvg(Math.round(avg))
        setForecast(Math.round(avg * 12))
      }

      // Category rows: use all categories that appear in either year
      const categories = [
        ...new Set(
          Object.keys(byCatYear)
            .map(key => key.split('|')[0])
        ),
      ].sort()

      setCatRows(
        categories.map(cat => {
          const cur = byCatYear[`${cat}|${cy}`] ?? 0
          const prev = byCatYear[`${cat}|${py}`] ?? 0
          const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
          return { cat, cur, prev, delta }
        }).sort((a, b) => b.cur - a.cur)
      )

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Monthly table */}
      <div className="border border-[#66473B] rounded">
        <div className="px-5 py-4 border-b border-[#35211A] flex items-center justify-between">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Monthly: {prevYear} vs {currentYear}
          </h2>
          {forecast && (
            <span className="text-xs text-[#B6A596]">
              {currentYear} forecast:{' '}
              <span className="text-[#EBDCC4] font-semibold">{formatGBP(forecast)}</span>
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Month</TH>
                <TH right>{prevYear}</TH>
                <TH right>{currentYear}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.label}
                  className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                >
                  <td className="px-5 py-2.5 text-[#EBDCC4]">{r.label}</td>
                  <td className="px-5 py-2.5 text-right text-[#B6A596]">
                    {r.prev !== null ? formatGBP(r.prev) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {r.cur !== null ? (
                      <span className="text-[#EBDCC4] font-medium">{formatGBP(r.cur)}</span>
                    ) : monthAvg !== null ? (
                      <span className="text-[#66473B]">~{formatGBP(monthAvg)}</span>
                    ) : (
                      <span className="text-[#35211A]">—</span>
                    )}
                  </td>
                  <DeltaCell delta={r.delta} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category table */}
      <div className="border border-[#66473B] rounded">
        <div className="px-5 py-4 border-b border-[#35211A]">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            By Category: {prevYear} vs {currentYear}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Category</TH>
                <TH right>{prevYear}</TH>
                <TH right>{currentYear}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {catRows.map((r, idx) => (
                <tr
                  key={r.cat}
                  className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                >
                  <td className="px-5 py-2.5 text-[#EBDCC4]">{r.cat}</td>
                  <td className="px-5 py-2.5 text-right text-[#B6A596]">{formatGBP(r.prev)}</td>
                  <td className="px-5 py-2.5 text-right text-[#EBDCC4] font-medium">
                    {r.cur > 0 ? formatGBP(r.cur) : <span className="text-[#66473B]">~{formatGBP(monthAvg ?? 0)}</span>}
                  </td>
                  <DeltaCell delta={r.delta} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/YearVsYear.jsx
git commit -m "feat: YearVsYear uses category RPC, excludes transient, adds month forecasts"
```

---

### Task 6: Fix Categories.jsx — replace .limit(10000) with RPC

**Files:**
- Modify: `src/pages/Categories.jsx`

Replace the initial category load (line 17-28 in the current file) that queries `.from('transactions').select('category').limit(10000)` with a call to `supabase.rpc('get_distinct_categories')`.

- [ ] **Step 1: Update Categories.jsx**

Replace only the `useEffect` that loads the category list (the first useEffect). The rest of the component stays the same.

```jsx
// Replace only the first useEffect in Categories.jsx (lines 17-28)
// Old:
//   supabase.from('transactions').select('category').limit(10000).then(({ data }) => {
//     const cats = [...new Set(data?.map(t => t.category))].sort()
//     ...
//   })

// New:
  useEffect(() => {
    supabase
      .rpc('get_distinct_categories')
      .then(({ data }) => {
        const cats = data?.map(r => r.category) ?? []
        setCategories(cats)
        if (cats.length) setSelected(cats[0])
        setLoading(false)
      })
  }, [])
```

The second `useEffect` (loads transactions for a selected category) keeps its `.limit(10000)` — that's a per-category query that won't hit the row limit in practice.

- [ ] **Step 2: Run all tests**

```bash
npm test
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/Categories.jsx
git commit -m "fix: Categories uses get_distinct_categories RPC, removes .limit(10000) on category load"
```
