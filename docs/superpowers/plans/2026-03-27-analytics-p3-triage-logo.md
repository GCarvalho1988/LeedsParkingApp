# Analytics Overhaul — Plan 3: Triage + Logo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the BudgetDash logo to the navbar, rename FlagButton to CommentButton, create the `/review` triage inbox page for Dulce's monthly transaction tagging, and wire up the navbar badge.

**Architecture:** Pure frontend additions. No DB changes — the review page reuses the existing `transactions` table and category update RLS policy from migration 002.

**Tech Stack:** React 18, Tailwind CSS v4, Supabase JS client

**Dependency:** Requires Plan 1 (`categories.js`) and Plan 2 (`CommentButton` if renamed from FlagButton) to be complete.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/Logo.jsx` | SVG trend-line mark (24×24 in navbar) |
| Create | `src/components/CommentButton.jsx` | Renamed FlagButton with "Comment" UI text |
| Delete | `src/components/FlagButton.jsx` | Replaced by CommentButton |
| Modify | `src/pages/Transactions.jsx` | Update FlagButton import → CommentButton |
| Rename | `tests/FlagButton.test.jsx` → `tests/CommentButton.test.jsx` | Update test to use CommentButton |
| Create | `src/pages/Review.jsx` | Triage inbox — Dulce's monthly review page |
| Modify | `src/components/Navbar.jsx` | Add Logo + REVIEW tab + unreviewed badge count |
| Modify | `src/App.jsx` | Add `/review` route |

---

### Task 1: Logo.jsx SVG component

**Files:**
- Create: `src/components/Logo.jsx`

Rising trend line with two terminal dots inside a rounded square. Coral dot at start, cream dot at end. Renders at 24×24 by default.

- [ ] **Step 1: Write failing test**

Create `tests/Logo.test.jsx`:

```jsx
// tests/Logo.test.jsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Logo from '../src/components/Logo'

describe('Logo', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Logo />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders at default 24×24 size', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
  })

  it('accepts a custom size prop', () => {
    const { container } = render(<Logo size={48} />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('48')
    expect(svg.getAttribute('height')).toBe('48')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/Logo.test.jsx
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement Logo.jsx**

```jsx
// src/components/Logo.jsx
export default function Logo({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rounded square border */}
      <rect
        x="2" y="2" width="24" height="24" rx="4"
        fill="none"
        stroke="#DC9F85"
        strokeWidth="1.5"
      />
      {/* Rising trend line */}
      <line
        x1="9" y1="20" x2="19" y2="8"
        stroke="#DC9F85"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Start dot — coral */}
      <circle cx="9" cy="20" r="2" fill="#DC9F85" />
      {/* End dot — cream */}
      <circle cx="19" cy="8" r="2" fill="#EBDCC4" />
    </svg>
  )
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- tests/Logo.test.jsx
```
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/Logo.jsx tests/Logo.test.jsx
git commit -m "feat: add Logo SVG component (rising trend line mark)"
```

---

### Task 2: Rename FlagButton → CommentButton

**Files:**
- Create: `src/components/CommentButton.jsx` (new file — copy of FlagButton with text changes)
- Delete: `src/components/FlagButton.jsx`
- Rename: `tests/FlagButton.test.jsx` → `tests/CommentButton.test.jsx`
- Modify: `src/pages/Transactions.jsx` (update import)

Changes to the component:
- All occurrences of `'FLAG'` / `'Flag'` in UI text → `'COMMENT'` / `'Comment'`
- Prop name stays the same (`transactionId`, `existingFlags`) — the DB table is still `flags`

- [ ] **Step 1: Create CommentButton.jsx**

```jsx
// src/components/CommentButton.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function CommentButton({ transactionId, existingFlags = [] }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [flags, setFlags] = useState(existingFlags)
  const [saving, setSaving] = useState(false)

  const hasComments = flags.length > 0

  async function submitComment() {
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
          hasComments
            ? 'border-[#DC9F85] text-[#DC9F85]'
            : 'border-[#66473B] text-[#B6A596] hover:border-[#DC9F85] hover:text-[#DC9F85]'
        }`}
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {hasComments ? `COMMENT (${flags.length})` : 'COMMENT'}
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
              onClick={submitComment}
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
```

- [ ] **Step 2: Create tests/CommentButton.test.jsx**

Copy `tests/FlagButton.test.jsx`, rename it `tests/CommentButton.test.jsx`, and update the import and text assertions:

```jsx
// tests/CommentButton.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CommentButton from '../src/components/CommentButton'

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null })) })) })) }) },
}))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}))

describe('CommentButton', () => {
  it('renders COMMENT button with no existing comments', () => {
    render(<CommentButton transactionId="tx-1" existingFlags={[]} />)
    expect(screen.getByText('COMMENT')).toBeTruthy()
  })

  it('shows comment count when comments exist', () => {
    render(<CommentButton transactionId="tx-1" existingFlags={[{ id: '1', comment: 'test' }]} />)
    expect(screen.getByText('COMMENT (1)')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run new tests**

```bash
npm test -- tests/CommentButton.test.jsx
```
Expected: PASS

- [ ] **Step 4: Update Transactions.jsx import**

Open `src/pages/Transactions.jsx`. Find the import line:
```js
import FlagButton from '../components/FlagButton'
```
Replace with:
```js
import CommentButton from '../components/CommentButton'
```

Also find every usage of `<FlagButton` in the file and replace with `<CommentButton`.

- [ ] **Step 5: Delete FlagButton.jsx and FlagButton.test.jsx**

```bash
rm src/components/FlagButton.jsx
rm tests/FlagButton.test.jsx
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```
Expected: PASS — all tests pass including CommentButton, no references to FlagButton remaining

- [ ] **Step 7: Commit**

```bash
git add src/components/CommentButton.jsx tests/CommentButton.test.jsx src/pages/Transactions.jsx
git rm src/components/FlagButton.jsx tests/FlagButton.test.jsx
git commit -m "feat: rename FlagButton to CommentButton throughout"
```

---

### Task 3: Create Review.jsx triage inbox

**Files:**
- Create: `src/pages/Review.jsx`

**Behaviour:**
- Fetches transactions for the most recent period (latest upload) where category NOT IN BILLS_CATEGORIES AND NOT IN TRANSIENT_CATEGORIES
- Sorted: "Clothing & shoes" rows first, then remaining by category alphabetically, then by date descending within each group
- Each row shows: date | description | amount | category | `Personal` button | `Work` button
- Tap Personal → `UPDATE transactions SET category = 'Dulce Personal Purchases'` → row disappears from list
- Tap Work → `UPDATE transactions SET category = 'Dulce Work Expenses'` → row disappears from list
- Live counter "X to review" in header

**Note:** The period selector uses the same uploads list as Overview. Default to most recent period.

- [ ] **Step 1: Write smoke test**

Create `tests/Review.test.jsx`:

```jsx
// tests/Review.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, vi } from 'vitest'
import Review from '../src/pages/Review'

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          then: vi.fn(cb => cb({ data: [] })),
        })),
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
        not: vi.fn(() => ({
          then: vi.fn(cb => cb({ data: [], count: 0 })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}))

describe('Review', () => {
  it('renders without crashing', () => {
    render(<Review />)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/Review.test.jsx
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement Review.jsx**

```jsx
// src/pages/Review.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BILLS_CATEGORIES, TRANSIENT_CATEGORIES } from '../lib/categories'
import { nextPeriodBoundary } from './Overview'

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
      .then(({ data }) => {
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
      .then(({ data }) => {
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

  function formatPeriodLabel(p) {
    if (!p) return ''
    const [y, m] = p.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/Review.test.jsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/Review.jsx tests/Review.test.jsx
git commit -m "feat: add Review triage inbox page for Dulce's monthly transaction tagging"
```

---

### Task 4: Update Navbar + App.jsx with Logo, Review tab, and badge

**Files:**
- Modify: `src/components/Navbar.jsx`
- Modify: `src/App.jsx`

**Navbar changes:**
- Import and render `Logo` component to the left of the BUDGETDASH wordmark
- Add a `REVIEW` tab to the tabs array
- Show a badge count next to REVIEW of unreviewed transactions in the most recent period
  - Badge = count of transactions in most recent upload period where category NOT IN BILLS_CATEGORIES AND NOT IN TRANSIENT_CATEGORIES
  - Fetch on mount, show nothing if loading or count is 0

**App.jsx change:**
- Add `/review` route (accessible to both roles — no admin restriction)

- [ ] **Step 1: Update App.jsx**

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Navbar from './components/Navbar'
import Overview from './pages/Overview'
import Categories from './pages/Categories'
import YearVsYear from './pages/YearVsYear'
import Transactions from './pages/Transactions'
import Review from './pages/Review'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#181818]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout><Overview /></Layout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>} />
          <Route path="/year-vs-year" element={<ProtectedRoute><Layout><YearVsYear /></Layout></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>} />
          <Route path="/review" element={<ProtectedRoute><Layout><Review /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Update Navbar.jsx**

```jsx
// src/components/Navbar.jsx
import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CsvUploader from './CsvUploader'
import Logo from './Logo'
import { supabase } from '../lib/supabase'
import { BILLS_CATEGORIES, TRANSIENT_CATEGORIES } from '../lib/categories'
import { nextPeriodBoundary } from '../pages/Overview'

const tabs = [
  { to: '/', label: 'OVERVIEW', end: true },
  { to: '/categories', label: 'CATEGORIES' },
  { to: '/year-vs-year', label: 'YEAR VS YEAR' },
  { to: '/transactions', label: 'TRANSACTIONS' },
  { to: '/review', label: 'REVIEW' },
]

export default function Navbar() {
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [reviewCount, setReviewCount] = useState(null)

  // Fetch unreviewed count for most recent period on mount
  useEffect(() => {
    async function loadBadge() {
      const { data: uploads } = await supabase
        .from('uploads')
        .select('period')
        .order('period', { ascending: false })
        .limit(1)

      const latestPeriod = uploads?.[0]?.period
      if (!latestPeriod) return

      const excluded = [...BILLS_CATEGORIES, ...TRANSIENT_CATEGORIES]
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .gte('date', `${latestPeriod}-01`)
        .lt('date', nextPeriodBoundary(latestPeriod))
        .not('category', 'in', `(${excluded.map(c => `"${c}"`).join(',')})`)

      setReviewCount(count ?? 0)
    }
    loadBadge()
  }, [])

  return (
    <>
      <nav className="bg-[#181818] border-b border-[#35211A]">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          {/* Logo mark + wordmark */}
          <div className="flex items-center gap-2 mr-4">
            <Logo size={24} />
            <span
              className="text-[#B6A596] text-xs font-semibold tracking-[0.2em] uppercase"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              BUDGETDASH
            </span>
          </div>

          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `text-xs font-medium tracking-widest pb-0.5 border-b transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'border-[#DC9F85] text-[#EBDCC4]'
                    : 'border-transparent text-[#B6A596] hover:text-[#EBDCC4]'
                }`
              }
            >
              {t.label}
              {t.to === '/review' && reviewCount > 0 && (
                <span
                  className="bg-[#DC9F85] text-[#181818] text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  {reviewCount}
                </span>
              )}
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

- [ ] **Step 3: Run all tests**

```bash
npm test
```
Expected: PASS — all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/Navbar.jsx
git commit -m "feat: add Logo + Review tab with badge count to navbar; wire /review route"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 2: Build to verify no compile errors**

```bash
npm run build
```
Expected: build succeeds, no TypeScript or import errors

- [ ] **Step 3: Commit if any cleanup needed, then push to GitHub**

```bash
git log --oneline -10  # verify commit trail looks clean
git push origin HEAD
```
