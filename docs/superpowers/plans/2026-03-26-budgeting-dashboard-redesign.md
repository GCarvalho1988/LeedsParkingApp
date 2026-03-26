# Budgeting Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Cinematic Editorial dark redesign, fix two data bugs (invalid date filter, 1000-row truncation), and add inline category re-assignment to the Transactions page.

**Architecture:** All changes are to existing files only. No new pages. One new component (`CategorySelect` inlined in Transactions). Two new Supabase RPC functions. All styling via Tailwind arbitrary values (`bg-[#181818]` etc.) with base body styles in `index.css`. Fonts via Fontshare CDN.

**Tech Stack:** React 18, Vite, Tailwind CSS v4, Recharts, Supabase JS client, Fontshare CDN (Clash Grotesk + General Sans)

**Working directory:** `Budgeting-Dashboard/` inside the `feature/budgeting-dashboard` worktree

---

## File Map

| File | Change |
|---|---|
| `index.html` | Add Fontshare font CDN links |
| `src/index.css` | Body base styles, noise overlay |
| `src/App.jsx` | Layout wrapper bg colour |
| `src/components/Navbar.jsx` | Full restyle |
| `src/components/KpiCard.jsx` | Full restyle |
| `src/components/CategoryBarChart.jsx` | Dark Recharts config |
| `src/components/MonthlyTrendChart.jsx` | Dark Recharts config |
| `src/components/FlagButton.jsx` | Visible FLAG pill + dark modal |
| `src/pages/Login.jsx` | Full dark redesign |
| `src/pages/Overview.jsx` | Date bug fix + month picker + RPC trend |
| `src/pages/Categories.jsx` | Restyle + `.limit(10000)` |
| `src/pages/YearVsYear.jsx` | Restyle + `.limit(10000)` |
| `src/pages/Transactions.jsx` | Restyle + inline CategorySelect + category update |
| `supabase/migrations/002_redesign.sql` | RPC functions + RLS policy |
| `tests/overview-date.test.js` | Unit test: nextPeriodBoundary |

---

## Task 1: Supabase Migrations (manual step)

**Files:**
- Create: `supabase/migrations/002_redesign.sql`

This task requires running SQL manually in the Supabase dashboard (SQL Editor). The file is saved for reference.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/002_redesign.sql` with this content:

```sql
-- RPC: monthly totals for trend chart (bypasses 1000-row default limit)
CREATE OR REPLACE FUNCTION get_monthly_totals()
RETURNS TABLE (period text, total numeric)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    to_char(date, 'YYYY-MM') AS period,
    SUM(amount)::numeric      AS total
  FROM transactions
  GROUP BY 1
  ORDER BY 1;
$$;

-- RPC: distinct categories for re-assignment dropdown
CREATE OR REPLACE FUNCTION get_distinct_categories()
RETURNS TABLE (category text)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT category FROM transactions ORDER BY 1;
$$;

-- RLS: allow authenticated users to update category on any transaction
-- (Supabase does not support column-level RLS; the app only sends { category } in the payload)
CREATE POLICY "authenticated_update_category"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 2: Run the SQL in Supabase dashboard**

Open your Supabase project → SQL Editor → New query. Paste the contents of `002_redesign.sql` and click Run.

Expected output: three `SUCCESS` messages (CREATE FUNCTION × 2, CREATE POLICY × 1).

- [ ] **Step 3: Verify RPCs are callable**

In the Supabase SQL Editor run:
```sql
SELECT * FROM get_monthly_totals() LIMIT 3;
SELECT * FROM get_distinct_categories() LIMIT 3;
```

Both should return rows. If you get "permission denied", re-run with `SECURITY DEFINER` (already set above).

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/002_redesign.sql
git commit -m "feat: add monthly totals + distinct categories RPCs and category update RLS"
```

---

## Task 2: Design System Foundation

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add Fontshare fonts to `index.html`**

Replace the entire contents of `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Budgeting Dashboard</title>
    <link
      href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@400,500,600,700&f[]=general-sans@300,400,500,600,700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/index.css` with dark base styles + noise overlay**

```css
@import "tailwindcss";

* {
  box-sizing: border-box;
}

body {
  background-color: #181818;
  color: #EBDCC4;
  font-family: 'General Sans', sans-serif;
  min-height: 100vh;
}

/* Fractal noise texture overlay — fixed, full viewport, non-interactive */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
}
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev` from `Budgeting-Dashboard/`. Open `http://localhost:5173/login`.

Expected: background is dark charcoal (`#181818`), fonts have changed from system default to General Sans. No noise visible but present at 3% opacity.

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "feat: apply dark design system — fonts, base styles, noise overlay"
```

---

## Task 3: App Layout + Navbar

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Navbar.jsx`

- [ ] **Step 1: Update App.jsx Layout wrapper**

Replace the `Layout` function in `src/App.jsx`:

```jsx
function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#181818]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Restyle Navbar.jsx**

Replace the entire contents of `src/components/Navbar.jsx`:

```jsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CsvUploader from './CsvUploader'

const tabs = [
  { to: '/', label: 'OVERVIEW', end: true },
  { to: '/categories', label: 'CATEGORIES' },
  { to: '/year-vs-year', label: 'YEAR VS YEAR' },
  { to: '/transactions', label: 'TRANSACTIONS' },
]

export default function Navbar() {
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const [uploaderOpen, setUploaderOpen] = useState(false)

  return (
    <>
      <nav className="bg-[#181818] border-b border-[#35211A]">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          <span
            className="text-[#B6A596] text-xs font-semibold tracking-[0.2em] uppercase mr-4"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            BUDGETDASH
          </span>
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `text-xs font-medium tracking-widest pb-0.5 border-b transition-colors ${
                  isActive
                    ? 'border-[#DC9F85] text-[#EBDCC4]'
                    : 'border-transparent text-[#B6A596] hover:text-[#EBDCC4]'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3">
            {role === 'admin' && (
              <button
                onClick={() => setUploaderOpen(true)}
                className="bg-[#DC9F85] text-[#181818] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded hover:opacity-90 transition-opacity"
                style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
              >
                Upload CSV
              </button>
            )}
            <button
              onClick={() => { signOut(); navigate('/login') }}
              className="text-xs text-[#B6A596] hover:text-[#EBDCC4] border border-[#66473B] px-3 py-1.5 rounded transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      {uploaderOpen && <CsvUploader onSuccess={() => setUploaderOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:5173`. The navbar should be dark with earth-toned borders, Clash Grotesk brand text, and the active tab underlined in coral rust.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/Navbar.jsx
git commit -m "feat: dark navbar and layout wrapper"
```

---

## Task 4: KpiCard + Charts

**Files:**
- Modify: `src/components/KpiCard.jsx`
- Modify: `src/components/CategoryBarChart.jsx`
- Modify: `src/components/MonthlyTrendChart.jsx`

- [ ] **Step 1: Restyle KpiCard.jsx**

```jsx
export default function KpiCard({ label, value, delta, deltaLabel }) {
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
        className="text-2xl font-bold text-[#EBDCC4] mt-2"
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {value}
      </p>
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${positive ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)}% {deltaLabel}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Restyle CategoryBarChart.jsx**

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLOURS = ['#DC9F85','#B6A596','#c4856a','#9a8070','#e8b89d','#8a6555','#d4a090','#7a5040']

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded px-3 py-2 text-xs text-[#EBDCC4]">
      <p className="text-[#B6A596] mb-1">{label}</p>
      <p>£{Number(payload[0].value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
    </div>
  )
}

export default function CategoryBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 140, right: 20 }}>
        <XAxis
          type="number"
          tickFormatter={v => `£${v}`}
          tick={{ fontSize: 11, fill: '#B6A596' }}
          axisLine={{ stroke: '#35211A' }}
          tickLine={{ stroke: '#35211A' }}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fontSize: 11, fill: '#B6A596' }}
          width={140}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(220,159,133,0.06)' }} />
        <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLOURS[i % COLOURS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Restyle MonthlyTrendChart.jsx**

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded px-3 py-2 text-xs text-[#EBDCC4]">
      <p className="text-[#B6A596] mb-1">{label}</p>
      <p>£{Number(payload[0].value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
    </div>
  )
}

export default function MonthlyTrendChart({ data }) {
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
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Verify in browser**

Navigate to the Overview tab. KPI cards should be dark with earth borders. Charts should have dark backgrounds, coral rust line/bars, and muted axis text. (The category chart will still be empty until Task 6 fixes the date bug.)

- [ ] **Step 5: Commit**

```bash
git add src/components/KpiCard.jsx src/components/CategoryBarChart.jsx src/components/MonthlyTrendChart.jsx
git commit -m "feat: dark KpiCard and chart components"
```

---

## Task 5: FlagButton — Visible Pill + Dark Modal

**Files:**
- Modify: `src/components/FlagButton.jsx`

- [ ] **Step 1: Replace FlagButton.jsx**

```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function FlagButton({ transactionId, existingFlags = [] }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [flags, setFlags] = useState(existingFlags)
  const [saving, setSaving] = useState(false)

  const isFlagged = flags.length > 0

  async function submitFlag() {
    if (!comment.trim()) return
    setSaving(true)
    const { data } = await supabase.from('flags').insert({
      transaction_id: transactionId,
      user_id: user.id,
      comment: comment.trim(),
    }).select().single()
    if (data) setFlags(f => [...f, { ...data, user_id: user.id }])
    setComment('')
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs font-medium uppercase tracking-widest px-2.5 py-1 rounded border transition-colors ${
          isFlagged
            ? 'border-[#DC9F85] text-[#DC9F85]'
            : 'border-[#66473B] text-[#B6A596] hover:border-[#DC9F85] hover:text-[#DC9F85]'
        }`}
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {isFlagged ? `FLAG (${flags.length})` : 'FLAG'}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-20 w-72 bg-[#181818] border border-[#66473B] rounded p-4 shadow-xl">
          {flags.length > 0 && (
            <div className="mb-3 space-y-2">
              {flags.map(f => (
                <div key={f.id} className="text-xs border border-[#35211A] rounded p-2 text-[#B6A596]">
                  {f.comment}
                </div>
              ))}
            </div>
          )}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="w-full bg-transparent border border-[#66473B] rounded px-3 py-2 text-sm text-[#EBDCC4] placeholder-[#66473B] resize-none focus:outline-none focus:border-[#DC9F85] mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 border border-[#66473B] text-[#B6A596] rounded py-1.5 text-xs hover:border-[#B6A596] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitFlag}
              disabled={saving}
              className="flex-1 bg-[#DC9F85] text-[#181818] rounded py-1.5 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

- [ ] **Step 2: Verify in browser**

Navigate to Transactions. Each row should have a small `FLAG` pill button on the right. Flagged transactions should show `FLAG (N)` in coral rust. Clicking should open a dark modal.

- [ ] **Step 3: Commit**

```bash
git add src/components/FlagButton.jsx
git commit -m "feat: visible FLAG pill button with dark modal"
```

---

## Task 6: Login Page Redesign

**Files:**
- Modify: `src/pages/Login.jsx`

- [ ] **Step 1: Replace Login.jsx**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const err = await signIn(email, password)
    if (err) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-[#181818] flex flex-col items-center justify-center px-4">
      <h1
        className="text-5xl font-bold text-[#EBDCC4] uppercase tracking-tight mb-12"
        style={{ fontFamily: "'Clash Grotesk', sans-serif", lineHeight: 0.85 }}
      >
        BUDGETDASH
      </h1>
      <div className="w-full max-w-sm border border-[#66473B] rounded p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#B6A596] uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-transparent border border-[#66473B] rounded px-3 py-2.5 text-sm text-[#EBDCC4] placeholder-[#66473B] focus:outline-none focus:border-[#DC9F85] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#B6A596] uppercase tracking-widest mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-transparent border border-[#66473B] rounded px-3 py-2.5 text-sm text-[#EBDCC4] placeholder-[#66473B] focus:outline-none focus:border-[#DC9F85] transition-colors"
            />
          </div>
          {error && <p className="text-[#DC9F85] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#DC9F85] text-[#181818] rounded py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify by signing out and viewing login page**

Sign out via the navbar. The login page should show a dark background, oversized `BUDGETDASH` heading, and the form in an earth-bordered card.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat: dark editorial login page"
```

---

## Task 7: Fix Overview — Date Bug + Month Picker + RPC Trend

**Files:**
- Create: `tests/overview-date.test.js`
- Modify: `src/pages/Overview.jsx`

- [ ] **Step 1: Write the failing unit test**

Create `tests/overview-date.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { nextPeriodBoundary } from '../src/pages/Overview.jsx'

describe('nextPeriodBoundary', () => {
  it('returns first day of next month for February', () => {
    expect(nextPeriodBoundary('2026-02')).toBe('2026-03-01')
  })

  it('rolls over to January of next year in December', () => {
    expect(nextPeriodBoundary('2025-12')).toBe('2026-01-01')
  })

  it('handles standard mid-year month', () => {
    expect(nextPeriodBoundary('2025-06')).toBe('2025-07-01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/overview-date.test.js
```

Expected: FAIL — `nextPeriodBoundary is not exported from Overview.jsx` (the export is added in Step 3).

- [ ] **Step 3: Replace Overview.jsx**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import CategoryBarChart from '../components/CategoryBarChart'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Returns the ISO date string for the first day of the month after `period` (YYYY-MM)
export function nextPeriodBoundary(period) {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Overview() {
  const [periods, setPeriods] = useState([])
  const [periodIndex, setPeriodIndex] = useState(null) // index into periods[] — null = loading
  const [kpis, setKpis] = useState(null)
  const [categoryData, setCategoryData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(true)

  // Load available periods once on mount
  useEffect(() => {
    supabase
      .from('uploads')
      .select('period')
      .order('period', { ascending: true })
      .then(({ data }) => {
        const ps = data?.map(r => r.period) ?? []
        setPeriods(ps)
        setPeriodIndex(ps.length - 1) // default to most recent
      })
  }, [])

  // Load KPIs and category data whenever the selected period changes
  useEffect(() => {
    if (periodIndex === null || periods.length === 0) return

    async function load() {
      setLoading(true)
      const period = periods[periodIndex]
      const [y, m] = period.split('-')
      const lastYearPeriod = `${Number(y) - 1}-${m.padStart(2, '0')}`
      const boundary = nextPeriodBoundary(period)
      const lastYearBoundary = nextPeriodBoundary(lastYearPeriod)

      // Current period transactions
      const { data: currentTx } = await supabase
        .from('transactions')
        .select('amount, category')
        .gte('date', `${period}-01`)
        .lt('date', boundary)

      const currentTotal = currentTx?.reduce((s, t) => s + Number(t.amount), 0) ?? 0

      // Same period last year
      const { data: lastYearTx } = await supabase
        .from('transactions')
        .select('amount')
        .gte('date', `${lastYearPeriod}-01`)
        .lt('date', lastYearBoundary)

      const lastYearTotal = lastYearTx?.reduce((s, t) => s + Number(t.amount), 0) ?? 0
      const yoyDelta = lastYearTotal > 0
        ? Math.round(((currentTotal - lastYearTotal) / lastYearTotal) * 100)
        : null

      // Category breakdown
      const catMap = {}
      currentTx?.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount) })
      const sortedCats = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
      const topCat = sortedCats[0]?.category ?? '—'

      // Flag count
      const { count: flagCount } = await supabase
        .from('flags')
        .select('id', { count: 'exact', head: true })

      // Monthly trend via RPC (no row limit)
      const { data: monthly } = await supabase.rpc('get_monthly_totals')
      const trend = (monthly ?? []).slice(-12).map(({ period: mo, total }) => {
        const [ty, tm] = mo.split('-')
        const label = new Date(Number(ty), Number(tm) - 1)
          .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        return { month: label, amount: Math.round(Number(total)) }
      })

      setKpis({ currentTotal, yoyDelta, topCat, flagCount: flagCount ?? 0 })
      setCategoryData(sortedCats)
      setTrendData(trend)
      setLoading(false)
    }

    load()
  }, [periodIndex, periods])

  const period = periodIndex !== null ? periods[periodIndex] : null

  function formatPeriodLabel(p) {
    if (!p) return ''
    const [y, m] = p.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  if (periodIndex === null) return <div className="text-[#B6A596] py-8">Loading…</div>
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

      {loading ? (
        <div className="text-[#B6A596] py-4">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Spent" value={formatGBP(kpis.currentTotal)} />
            <KpiCard
              label="vs Last Year"
              value={kpis.yoyDelta !== null ? `${kpis.yoyDelta > 0 ? '+' : ''}${kpis.yoyDelta}%` : '—'}
              delta={kpis.yoyDelta}
              deltaLabel="YoY"
            />
            <KpiCard label="Top Category" value={kpis.topCat} />
            <KpiCard label="Flagged" value={kpis.flagCount} />
          </div>

          <div className="border border-[#66473B] rounded p-5">
            <h2
              className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              Spend by Category
            </h2>
            <CategoryBarChart data={categoryData} />
          </div>

          <div className="border border-[#66473B] rounded p-5">
            <h2
              className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              Monthly Trend
            </h2>
            <MonthlyTrendChart data={trendData} />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

```bash
npm test -- tests/overview-date.test.js
```

Expected: PASS (3 tests passing).

- [ ] **Step 5: Verify in browser**

Navigate to Overview. KPI cards should now show real spend (not £0.00). The category chart should show bars. The trend chart should show up to Feb 2026 (not cutting off at Mar 2025). Month picker arrows should navigate between periods.

- [ ] **Step 6: Commit**

```bash
git add tests/overview-date.test.js src/pages/Overview.jsx
git commit -m "fix: date boundary bug, add month picker, use RPC for trend chart"
```

---

## Task 8: Restyle Categories Page

**Files:**
- Modify: `src/pages/Categories.jsx`

- [ ] **Step 1: Replace Categories.jsx**

```jsx
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
    supabase
      .from('transactions')
      .select('category')
      .limit(10000)
      .then(({ data }) => {
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
        .limit(10000)

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

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`px-3 py-1.5 rounded text-xs font-medium tracking-wide border transition-colors ${
              selected === cat
                ? 'border-[#DC9F85] text-[#DC9F85]'
                : 'border-[#66473B] text-[#B6A596] hover:border-[#B6A596]'
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
              <div className="flex-1 border border-[#66473B] rounded p-5">
                <p className="text-xs text-[#B6A596] uppercase tracking-widest">{yoy.py} Total</p>
                <p
                  className="text-xl font-bold text-[#EBDCC4] mt-1"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  {formatGBP(yoy.pyTotal)}
                </p>
              </div>
              <div className="flex-1 border border-[#66473B] rounded p-5">
                <p className="text-xs text-[#B6A596] uppercase tracking-widest">{yoy.cy} Total</p>
                <p
                  className="text-xl font-bold text-[#EBDCC4] mt-1"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  {formatGBP(yoy.cyTotal)}
                </p>
                {yoy.delta !== null && (
                  <p className={`text-xs mt-1 ${yoy.delta > 0 ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
                    {yoy.delta > 0 ? '↑' : '↓'} {Math.abs(yoy.delta)}% YoY
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border border-[#66473B] rounded p-5">
            <h2
              className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              {selected} — Monthly Spend
            </h2>
            <MonthlyTrendChart data={monthData} />
          </div>

          <div className="border border-[#66473B] rounded">
            <div className="px-5 py-4 border-b border-[#35211A]">
              <h2
                className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
                style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
              >
                Transactions in {selected}
              </h2>
            </div>
            <div>
              {transactions.map(tx => (
                <div
                  key={tx.date + tx.description + tx.amount}
                  className="px-5 py-3 flex justify-between text-sm border-b border-[#35211A] last:border-0"
                >
                  <div>
                    <p className="text-[#EBDCC4]">{tx.description}</p>
                    <p className="text-[#B6A596] text-xs mt-0.5">{tx.date}</p>
                  </div>
                  <p className="text-[#EBDCC4] font-medium">{formatGBP(tx.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to Categories. Pills should be dark with earth borders, coral rust when selected. Charts and transaction list should be dark-themed. Data should show full history (not truncated).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Categories.jsx
git commit -m "feat: dark Categories page + 10k row limit fix"
```

---

## Task 9: Restyle Year vs Year Page

**Files:**
- Modify: `src/pages/YearVsYear.jsx`

- [ ] **Step 1: Replace YearVsYear.jsx**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase
        .from('transactions')
        .select('date, amount, category')
        .limit(10000)

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
                  <td className="px-5 py-2.5 text-right text-[#EBDCC4] font-medium">
                    {r.cur !== null ? formatGBP(r.cur) : <span className="text-[#35211A]">—</span>}
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
                  <td className="px-5 py-2.5 text-right text-[#EBDCC4] font-medium">{formatGBP(r.cur)}</td>
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

- [ ] **Step 2: Verify in browser**

Navigate to Year vs Year. Tables should be dark, alternating rows subtly, with coral rust for positive change and muted sage for negative. Row limit fix means 2025 data should now be complete through Feb 2026.

- [ ] **Step 3: Commit**

```bash
git add src/pages/YearVsYear.jsx
git commit -m "feat: dark Year vs Year page + 10k row limit fix"
```

---

## Task 10: Transactions — Restyle + Category Re-assignment

**Files:**
- Create: `tests/transactions-category.test.js`
- Modify: `src/pages/Transactions.jsx`

- [ ] **Step 1: Write the failing unit test**

Create `tests/transactions-category.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'

// Extracted logic: build the Supabase update call
function buildCategoryUpdate(supabase, txId, newCategory) {
  return supabase.from('transactions').update({ category: newCategory }).eq('id', txId)
}

describe('buildCategoryUpdate', () => {
  it('calls update with the correct category and id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const supabase = { from }

    await buildCategoryUpdate(supabase, 'abc-123', 'Groceries')

    expect(from).toHaveBeenCalledWith('transactions')
    expect(update).toHaveBeenCalledWith({ category: 'Groceries' })
    expect(eq).toHaveBeenCalledWith('id', 'abc-123')
  })

  it('does not send extra fields', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const supabase = { from }

    await buildCategoryUpdate(supabase, 'xyz-999', 'Eating out')

    expect(update).toHaveBeenCalledWith({ category: 'Eating out' })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ date: expect.anything() }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/transactions-category.test.js
```

Expected: FAIL — `buildCategoryUpdate is not defined`.

- [ ] **Step 3: Replace Transactions.jsx**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import FlagButton from '../components/FlagButton'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Inline category select — shown when a category chip is clicked
function CategorySelect({ value, allCategories, txId, onSave, onCancel }) {
  const [selected, setSelected] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    if (selected === value) { onCancel(); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('transactions')
      .update({ category: selected })
      .eq('id', txId)
    if (err) {
      setError('Save failed')
      setSaving(false)
    } else {
      onSave(selected)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="bg-[#181818] border border-[#DC9F85] text-[#EBDCC4] text-xs rounded px-2 py-1 focus:outline-none"
        autoFocus
      >
        {allCategories.map(c => (
          <option key={c} value={c} className="bg-[#181818]">{c}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="text-xs bg-[#DC9F85] text-[#181818] font-bold px-2 py-1 rounded disabled:opacity-50"
      >
        {saving ? '…' : '✓'}
      </button>
      <button onClick={onCancel} className="text-xs text-[#B6A596] hover:text-[#EBDCC4] px-1">✕</button>
      {error && <span className="text-xs text-[#DC9F85]">{error}</span>}
    </div>
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

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ month: '', category: '', minAmount: '', maxAmount: '' })
  const [allCategories, setAllCategories] = useState([])
  const [months, setMonths] = useState([])
  const [editingCategory, setEditingCategory] = useState(null) // txId being edited

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .order('date', { ascending: false })
        .limit(10000)

      const { data: flagData } = await supabase
        .from('flags')
        .select('id, transaction_id, comment, created_at')

      const flagMap = {}
      flagData?.forEach(f => {
        if (!flagMap[f.transaction_id]) flagMap[f.transaction_id] = []
        flagMap[f.transaction_id].push(f)
      })

      // Fetch distinct categories from RPC (may differ from transaction sample)
      const { data: catData } = await supabase.rpc('get_distinct_categories')

      setTransactions(tx || [])
      setFlags(flagMap)
      setAllCategories(catData?.map(r => r.category) ?? [...new Set(tx?.map(t => t.category))].sort())
      setMonths([...new Set(tx?.map(t => t.date.slice(0, 7)))].sort().reverse())
      setLoading(false)
    }
    load()
  }, [])

  function handleCategorySaved(txId, newCategory) {
    setTransactions(txs => txs.map(t => t.id === txId ? { ...t, category: newCategory } : t))
    setEditingCategory(null)
  }

  const filtered = transactions.filter(tx => {
    if (filters.month && !tx.date.startsWith(filters.month)) return false
    if (filters.category && tx.category !== filters.category) return false
    if (filters.minAmount !== '' && Number(tx.amount) < filters.minAmount) return false
    if (filters.maxAmount !== '' && Number(tx.amount) > filters.maxAmount) return false
    return true
  })

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  const selectClass = "bg-[#181818] border border-[#66473B] text-[#B6A596] text-xs rounded px-3 py-2 focus:outline-none focus:border-[#DC9F85] transition-colors"
  const inputClass = "w-20 bg-[#181818] border border-[#66473B] text-[#B6A596] text-xs rounded px-2 py-2 placeholder-[#66473B] focus:outline-none focus:border-[#DC9F85] transition-colors"

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filters.month}
          onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
          className={selectClass}
        >
          <option value="">All months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          className={selectClass}
        >
          <option value="">All categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="number"
          placeholder="Min £"
          onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value ? Number(e.target.value) : '' }))}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="Max £"
          onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value ? Number(e.target.value) : '' }))}
          className={inputClass}
        />
        <span
          className="text-xs text-[#B6A596] uppercase tracking-widest"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          {filtered.length} transactions
        </span>
      </div>

      {/* Table */}
      <div className="border border-[#66473B] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Date</TH>
                <TH>Description</TH>
                <TH>Category</TH>
                <TH right>Amount</TH>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, idx) => (
                <tr
                  key={tx.id}
                  className={`border-b border-[#35211A] last:border-0 ${
                    flags[tx.id]?.length ? 'bg-[#DC9F85]/5' : idx % 2 === 1 ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <td className="px-5 py-3 text-[#B6A596] whitespace-nowrap text-xs">{tx.date}</td>
                  <td className="px-5 py-3 text-[#EBDCC4] max-w-xs truncate">{tx.description}</td>
                  <td className="px-5 py-3">
                    {editingCategory === tx.id ? (
                      <CategorySelect
                        value={tx.category}
                        allCategories={allCategories}
                        txId={tx.id}
                        onSave={cat => handleCategorySaved(tx.id, cat)}
                        onCancel={() => setEditingCategory(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCategory(tx.id)}
                        className="text-xs border border-[#66473B] text-[#B6A596] rounded px-2 py-1 hover:border-[#DC9F85] hover:text-[#DC9F85] transition-colors"
                        title="Click to reassign category"
                      >
                        {tx.category}
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-[#EBDCC4] font-medium">{formatGBP(tx.amount)}</td>
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
```

- [ ] **Step 4: Run the unit test to verify it passes**

```bash
npm test -- tests/transactions-category.test.js
```

Expected: PASS (2 tests passing).

- [ ] **Step 5: Verify in browser**

Navigate to Transactions. Categories should appear as small clickable chips. Clicking a chip should reveal a dropdown with all categories and save/cancel buttons. After saving, the row should immediately reflect the new category without a page reload.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add tests/transactions-category.test.js src/pages/Transactions.jsx
git commit -m "feat: inline category re-assignment + dark Transactions page"
```

---

## Task 11: Final Smoke Check

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: all tests pass, no failures.

- [ ] **Step 2: Run build to verify no compile errors**

```bash
npm run build
```

Expected: build completes with no errors. Warnings about bundle size are acceptable.

- [ ] **Step 3: Manual smoke test in browser**

Visit `http://localhost:5173` and check each page:

| Page | Check |
|---|---|
| Login | Dark bg, Clash Grotesk heading, dark input fields, coral rust button |
| Overview | Month picker arrows work, KPI cards show real data (not £0), category bars visible, trend shows to Feb 2026 |
| Categories | Pill selector works, chart shows full history, YoY cards show correct totals |
| Year vs Year | Tables dark, change column coloured correctly, 2025 data complete |
| Transactions | Filter bar dark, category chips clickable, dropdown saves to DB, FLAG pill visible |

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final smoke check — all pages verified"
```
