# Analytics Overhaul — Plan 1: Data Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the income table to Supabase, create category-bucketing RPCs, fix the PLATINUM M/C recategorisation, add `src/lib/categories.js`, and update both seeders to handle income rows.

**Architecture:** Pure data layer — no frontend changes. All logic lives in SQL (migration), a new frontend-importable config module (`categories.js`), a new Node script (`seed-income.js`), and an update to the existing Netlify function (`ingest-csv.js`).

**Tech Stack:** Supabase SQL, Node.js ESM scripts, XLSX library, Vitest

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/003_income_categories.sql` | income table + RPCs + PLATINUM M/C recategorisation |
| Create | `src/lib/categories.js` | BILLS_CATEGORIES, TRANSIENT_CATEGORIES, bucketCategory() |
| Create | `tests/categories.test.js` | unit tests for categories.js |
| Create | `scripts/seed-income.js` | seed income rows from historical Excel |
| Create | `tests/seed-income.test.js` | unit tests for normaliseIncomeRow |
| Modify | `netlify/functions/ingest-csv.js` | return income rows from parseRow; insert into income table |
| Modify | `tests/ingest-csv.test.js` | update test for positive-amount behaviour; add PLATINUM M/C test |

---

### Task 1: Supabase migration 003

**Files:**
- Create: `supabase/migrations/003_income_categories.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/003_income_categories.sql

-- 1. Income table
CREATE TABLE IF NOT EXISTS income (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date        NOT NULL,
  description text        NOT NULL,
  amount      numeric     NOT NULL,
  category    text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Unique constraint so ON CONFLICT DO NOTHING works in seeders
CREATE UNIQUE INDEX IF NOT EXISTS income_unique_row
  ON income(date, description, amount);

ALTER TABLE income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_income"
  ON income FOR SELECT
  TO authenticated
  USING (true);

-- 2. RPC: monthly totals per category (replaces .limit(10000) raw queries)
-- Returns every period+category combination — no row limit.
CREATE OR REPLACE FUNCTION get_monthly_category_totals()
RETURNS TABLE(period text, category text, total numeric)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    to_char(date, 'YYYY-MM') AS period,
    category,
    SUM(amount)::numeric     AS total
  FROM transactions
  GROUP BY to_char(date, 'YYYY-MM'), category
  ORDER BY 1, 2;
$$;

-- 3. RPC: monthly income totals
CREATE OR REPLACE FUNCTION get_monthly_income()
RETURNS TABLE(period text, total numeric)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    to_char(date, 'YYYY-MM') AS period,
    SUM(amount)::numeric     AS total
  FROM income
  GROUP BY to_char(date, 'YYYY-MM')
  ORDER BY 1;
$$;

-- 4. Recategorise existing PLATINUM M/C transactions
-- These are 0% credit card repayments that were imported as 'Credit card payments'
UPDATE transactions
SET category = '0% Credit Card Repayment'
WHERE description ILIKE '%PLATINUM M/C%';
```

- [ ] **Step 2: Run in Supabase SQL editor**

Paste the full SQL into Supabase → SQL Editor → New query. Run it.

Verify:
- `income` table appears in Table Editor
- `get_monthly_category_totals` and `get_monthly_income` appear in Database → Functions
- The PLATINUM M/C UPDATE reports > 0 affected rows (check the output pane)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_income_categories.sql
git commit -m "feat: add income table, category RPCs, recategorise PLATINUM M/C rows"
```

---

### Task 2: Category classification module

**Files:**
- Create: `src/lib/categories.js`
- Create: `tests/categories.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/categories.test.js
import { describe, it, expect } from 'vitest'
import { BILLS_CATEGORIES, TRANSIENT_CATEGORIES, bucketCategory } from '../src/lib/categories.js'

describe('BILLS_CATEGORIES', () => {
  it('contains Mortgage', () => expect(BILLS_CATEGORIES.has('Mortgage')).toBe(true))
  it('contains 0% Credit Card Repayment', () => expect(BILLS_CATEGORIES.has('0% Credit Card Repayment')).toBe(true))
  it('contains Child & dependent expenses', () => expect(BILLS_CATEGORIES.has('Child & dependent expenses')).toBe(true))
  it('contains House Cleaning', () => expect(BILLS_CATEGORIES.has('House Cleaning')).toBe(true))
  it('does not contain Groceries', () => expect(BILLS_CATEGORIES.has('Groceries')).toBe(false))
})

describe('TRANSIENT_CATEGORIES', () => {
  it('contains Credit card payments', () => expect(TRANSIENT_CATEGORIES.has('Credit card payments')).toBe(true))
  it('contains Dulce Personal Purchases', () => expect(TRANSIENT_CATEGORIES.has('Dulce Personal Purchases')).toBe(true))
  it('contains Transfers', () => expect(TRANSIENT_CATEGORIES.has('Transfers')).toBe(true))
  it('does not contain Groceries', () => expect(TRANSIENT_CATEGORIES.has('Groceries')).toBe(false))
})

describe('bucketCategory', () => {
  it('returns bills for Mortgage', () => expect(bucketCategory('Mortgage')).toBe('bills'))
  it('returns bills for 0% Credit Card Repayment', () => expect(bucketCategory('0% Credit Card Repayment')).toBe('bills'))
  it('returns bills for Child & dependent expenses', () => expect(bucketCategory('Child & dependent expenses')).toBe('bills'))
  it('returns transient for Credit card payments', () => expect(bucketCategory('Credit card payments')).toBe('transient'))
  it('returns transient for Transfers', () => expect(bucketCategory('Transfers')).toBe('transient'))
  it('returns transient for Dulce Personal Purchases', () => expect(bucketCategory('Dulce Personal Purchases')).toBe('transient'))
  it('returns discretionary for Groceries', () => expect(bucketCategory('Groceries')).toBe('discretionary'))
  it('returns discretionary for unknown category', () => expect(bucketCategory('Something new')).toBe('discretionary'))
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/categories.test.js
```
Expected: FAIL — "Cannot find module '../src/lib/categories.js'"

- [ ] **Step 3: Implement categories.js**

```js
// src/lib/categories.js

export const BILLS_CATEGORIES = new Set([
  'Car Repayments',
  'Child & dependent expenses',
  'House Cleaning',
  'Household insurance',
  'Mortgage',
  'Online services',
  'Subscriptions',
  'Telephone & mobile',
  'TV & internet',
  'Utilities',
  '0% Credit Card Repayment',
])

export const TRANSIENT_CATEGORIES = new Set([
  'Credit card payments',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
  'Gui Personal Purchases',
  'Gui Work Expensss',
  'Transfers',
])

/**
 * @param {string} category
 * @returns {'bills' | 'discretionary' | 'transient'}
 */
export function bucketCategory(category) {
  if (TRANSIENT_CATEGORIES.has(category)) return 'transient'
  if (BILLS_CATEGORIES.has(category)) return 'bills'
  return 'discretionary'
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- tests/categories.test.js
```
Expected: PASS — 15 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.js tests/categories.test.js
git commit -m "feat: add categories.js with BILLS/TRANSIENT sets and bucketCategory()"
```

---

### Task 3: seed-income.js

**Files:**
- Create: `scripts/seed-income.js`
- Create: `tests/seed-income.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/seed-income.test.js
import { describe, it, expect } from 'vitest'
import { normaliseIncomeRow } from '../scripts/seed-income.js'

// Excel serial date 45292 = 2024-01-15
const BASE_ROW = {
  DATE: 45292,
  DESCRIPTION: 'SALARY PAYMENT',
  AMOUNT: 3500,
  CATEGORY: 'Salary',
}

describe('normaliseIncomeRow', () => {
  it('returns a normalised income row for positive non-transient amount', () => {
    const result = normaliseIncomeRow(BASE_ROW)
    expect(result.description).toBe('SALARY PAYMENT')
    expect(result.amount).toBe(3500)
    expect(result.category).toBe('Salary')
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('throws for negative amount (expense)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, AMOUNT: -100 })).toThrow()
  })

  it('throws for zero amount', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, AMOUNT: 0 })).toThrow()
  })

  it('throws for Transfers (transient)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, CATEGORY: 'Transfers' })).toThrow()
  })

  it('throws for Credit card payments (transient)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, CATEGORY: 'Credit card payments' })).toThrow()
  })

  it('throws for Dulce Personal Purchases (transient)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, CATEGORY: 'Dulce Personal Purchases' })).toThrow()
  })

  it('throws for missing required columns', () => {
    expect(() => normaliseIncomeRow({ DATE: 45292, DESCRIPTION: 'X' })).toThrow()
  })

  it('converts Excel serial date to ISO string', () => {
    const result = normaliseIncomeRow(BASE_ROW)
    // serial 45292 should resolve to a date in 2024
    expect(result.date.startsWith('2024')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/seed-income.test.js
```
Expected: FAIL — "Cannot find module '../scripts/seed-income.js'"

- [ ] **Step 3: Implement seed-income.js**

```js
// scripts/seed-income.js
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const TRANSIENT_CATEGORIES = new Set([
  'Credit card payments',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
  'Gui Personal Purchases',
  'Gui Work Expensss',
  'Transfers',
])

// Exported for testing
export function normaliseIncomeRow(row) {
  const DATE_COL = 'DATE'
  const DESC_COL = 'DESCRIPTION'
  const AMT_COL = 'AMOUNT'
  const CAT_COL = 'CATEGORY'

  if (!row[DATE_COL] || !row[DESC_COL] || row[AMT_COL] === undefined || !row[CAT_COL]) {
    throw new Error(`Missing required column: ${JSON.stringify(row)}`)
  }

  const amount = parseFloat(String(row[AMT_COL]).replace(/[^0-9.-]/g, ''))
  if (isNaN(amount)) throw new Error(`Invalid amount: ${JSON.stringify(row)}`)
  if (amount <= 0) throw new Error(`Not an income row (amount <= 0): ${JSON.stringify(row)}`)

  const category = String(row[CAT_COL]).trim()
  if (TRANSIENT_CATEGORIES.has(category)) {
    throw new Error(`Skipping transient category '${category}': ${JSON.stringify(row)}`)
  }

  // Convert Excel serial date (days since 1899-12-30) to ISO string
  const date = new Date((row[DATE_COL] - 25569) * 86400 * 1000)
  const isoDate = date.toISOString().split('T')[0]

  return {
    date: isoDate,
    description: String(row[DESC_COL]).trim(),
    amount,
    category,
  }
}

async function seed() {
  const EXCEL_PATH = process.argv[2]
  if (!EXCEL_PATH) {
    console.error('Usage: node scripts/seed-income.js <path-to-excel.xlsx>')
    process.exit(1)
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const workbook = XLSX.read(readFileSync(EXCEL_PATH), { type: 'buffer' })

  let totalProcessed = 0
  let totalSkipped = 0

  for (const sheetName of workbook.SheetNames) {
    console.log(`\nProcessing sheet: ${sheetName}`)
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

    const incomeRows = []
    for (const raw of rawRows) {
      try {
        incomeRows.push(normaliseIncomeRow(raw))
      } catch {
        totalSkipped++
      }
    }

    if (incomeRows.length === 0) {
      console.log(`  No income rows found`)
      continue
    }

    const { error } = await supabase
      .from('income')
      .upsert(incomeRows, { onConflict: 'date,description,amount', ignoreDuplicates: true })

    if (error) {
      console.error(`  Insert failed: ${error.message}`)
    } else {
      console.log(`  Processed ${incomeRows.length} income rows`)
      totalProcessed += incomeRows.length
    }
  }

  console.log(`\nDone. Processed ${totalProcessed} income rows, skipped ${totalSkipped} non-income rows.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- tests/seed-income.test.js
```
Expected: PASS — 8 tests passed

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-income.js tests/seed-income.test.js
git commit -m "feat: add seed-income.js to populate income table from historical Excel"
```

---

### Task 4: Update ingest-csv.js for income rows + PLATINUM M/C

**Files:**
- Modify: `netlify/functions/ingest-csv.js`
- Modify: `tests/ingest-csv.test.js`

**What changes in `parseRow`:**
- Positive amounts in TRANSIENT_CATEGORIES → still throw (skip transient refunds)
- Positive amounts not in TRANSIENT_CATEGORIES → return `{ type: 'income', ... }` (no longer throws)
- Negative amounts → return `{ type: 'expense', ... }` with PLATINUM M/C category override
- Zero → still throws

**What changes in the handler:**
- Split parsed rows by type: `expenseRows` and `incomeRows`
- `detectPeriod` runs on expense rows only (same as before)
- Expense rows insert into `transactions` (same as before)
- Income rows insert into `income` table with ON CONFLICT DO NOTHING

**Note:** This task depends on Task 2 (`src/lib/categories.js`) being complete.

- [ ] **Step 1: Update `tests/ingest-csv.test.js`**

The existing test `'excludes positive amounts'` checks that positive amounts throw with message `'income/refund'`. That test must be replaced because non-transient positive amounts no longer throw. Replace the `parseRow` describe block entirely:

```js
// tests/ingest-csv.test.js
import { describe, it, expect } from 'vitest'
import { parseRow, detectPeriod } from '../netlify/functions/ingest-csv.js'

const EXPENSE_ROW = {
  DATE: '2025-10-01',
  DESCRIPTION: 'Tesco',
  AMOUNT: '-45.67',
  CATEGORY: 'Groceries',
}

describe('parseRow — expenses', () => {
  it('maps negative CSV row to expense object', () => {
    const result = parseRow(EXPENSE_ROW)
    expect(result.type).toBe('expense')
    expect(result.date).toBe('2025-10-01')
    expect(result.description).toBe('Tesco')
    expect(result.amount).toBe(45.67)
    expect(result.category).toBe('Groceries')
  })

  it('throws on missing required field', () => {
    expect(() => parseRow({ DATE: '2025-10-01' })).toThrow()
  })

  it('throws on zero-amount row', () => {
    expect(() => parseRow({ DATE: '2025-10-01', DESCRIPTION: 'Free', AMOUNT: '0.00', CATEGORY: 'Other' })).toThrow('zero-amount')
  })

  it('applies PLATINUM M/C override — forces category to 0% Credit Card Repayment', () => {
    const result = parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'BARCLAYCARD PLATINUM M/C',
      AMOUNT: '-400.00',
      CATEGORY: 'Credit card payments',
    })
    expect(result.type).toBe('expense')
    expect(result.category).toBe('0% Credit Card Repayment')
    expect(result.amount).toBe(400)
  })

  it('PLATINUM M/C override is case-insensitive', () => {
    const result = parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'barclaycard platinum m/c direct debit',
      AMOUNT: '-400.00',
      CATEGORY: 'Credit card payments',
    })
    expect(result.category).toBe('0% Credit Card Repayment')
  })
})

describe('parseRow — income', () => {
  it('returns income type for positive non-transient amount', () => {
    const result = parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'EMPLOYER SALARY',
      AMOUNT: '3500.00',
      CATEGORY: 'Salary',
    })
    expect(result.type).toBe('income')
    expect(result.amount).toBe(3500)
    expect(result.description).toBe('EMPLOYER SALARY')
  })

  it('throws for positive amount with transient category', () => {
    expect(() => parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'TRANSFER IN',
      AMOUNT: '500.00',
      CATEGORY: 'Transfers',
    })).toThrow()
  })

  it('throws for positive amount with Credit card payments', () => {
    expect(() => parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'CC REFUND',
      AMOUNT: '10.00',
      CATEGORY: 'Credit card payments',
    })).toThrow()
  })
})

describe('detectPeriod', () => {
  it('returns YYYY-MM from a list of transaction dates', () => {
    const rows = [{ date: '2025-10-01' }, { date: '2025-10-15' }]
    expect(detectPeriod(rows)).toBe('2025-10')
  })

  it('throws if rows span multiple months', () => {
    const rows = [{ date: '2025-10-01' }, { date: '2025-11-01' }]
    expect(() => detectPeriod(rows)).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/ingest-csv.test.js
```
Expected: Multiple FAILs — `parseRow` still throws for positive non-transient; no `type` field; no PLATINUM M/C override.

- [ ] **Step 3: Rewrite `netlify/functions/ingest-csv.js`**

```js
// netlify/functions/ingest-csv.js
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'
import { TRANSIENT_CATEGORIES } from '../../src/lib/categories.js'

const PLATINUM_MC_RE = /PLATINUM\s+M\/C/i

// --- Pure helpers (exported for testing) ---

export function parseRow(row) {
  const DATE_COL = 'DATE'
  const DESC_COL = 'DESCRIPTION'
  const AMOUNT_COL = 'AMOUNT'
  const CAT_COL = 'CATEGORY'

  if (!row[DATE_COL] || !row[DESC_COL] || row[AMOUNT_COL] === undefined || !row[CAT_COL]) {
    throw new Error(`Missing required column in row: ${JSON.stringify(row)}`)
  }

  const amount = parseFloat(String(row[AMOUNT_COL]).replace(/[^0-9.-]/g, ''))
  if (isNaN(amount)) throw new Error(`Invalid amount in row: ${JSON.stringify(row)}`)
  if (amount === 0) throw new Error(`Skipping zero-amount row: ${JSON.stringify(row)}`)

  const description = row[DESC_COL].trim()
  let category = row[CAT_COL].trim()

  if (amount > 0) {
    if (TRANSIENT_CATEGORIES.has(category)) {
      throw new Error(`Skipping transient positive row: ${JSON.stringify(row)}`)
    }
    return { type: 'income', date: row[DATE_COL].trim(), description, amount, category }
  }

  // amount < 0 — expense
  if (PLATINUM_MC_RE.test(description)) {
    category = '0% Credit Card Repayment'
  }

  return {
    type: 'expense',
    date: row[DATE_COL].trim(),
    description,
    amount: Math.abs(amount),
    category,
  }
}

export function detectPeriod(rows) {
  const months = new Set(rows.map(r => r.date.slice(0, 7)))
  if (months.size !== 1) throw new Error(`CSV spans multiple months: ${[...months].join(', ')}`)
  return [...months][0]
}

// --- Netlify Function handler ---

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Forbidden — admin only' }) }
  }

  let parsed_body
  try { parsed_body = JSON.parse(event.body) }
  catch { return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON body' }) } }

  const { csvText, filename, uploadedBy } = parsed_body

  const { data: rawRows, errors } = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  if (errors.length) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'CSV parse error', details: errors }) }
  }

  const parsed = []
  const warnings = []
  for (const row of rawRows) {
    try { parsed.push(parseRow(row)) }
    catch (e) { warnings.push(e.message) }
  }

  const expenseRows = parsed.filter(r => r.type === 'expense')
  const incomeRows = parsed.filter(r => r.type === 'income')

  if (expenseRows.length === 0) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No valid expense rows found', warnings }) }
  }

  let period
  try { period = detectPeriod(expenseRows) }
  catch (e) { return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) } }

  const { data: existing } = await supabase.from('uploads').select('id').eq('period', period).single()
  if (existing) {
    return { statusCode: 409, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conflict: true, period }) }
  }

  const { error: storageErr } = await supabase.storage
    .from('csv-uploads')
    .upload(`${period}/${filename}`, csvText, { contentType: 'text/csv', upsert: true })
  if (storageErr) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Storage upload failed' }) }
  }

  const { data: upload, error: uploadErr } = await supabase.from('uploads').insert({
    filename, period, uploaded_by: uploadedBy, row_count: expenseRows.length,
  }).select().single()
  if (uploadErr) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: uploadErr.message }) }
  }

  const txRows = expenseRows.map(({ type, ...t }) => ({ ...t, upload_id: upload.id }))
  const { error: txErr } = await supabase.from('transactions').insert(txRows)
  if (txErr) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: txErr.message }) }
  }

  if (incomeRows.length > 0) {
    const incomeDbRows = incomeRows.map(({ type, ...r }) => r)
    await supabase
      .from('income')
      .upsert(incomeDbRows, { onConflict: 'date,description,amount', ignoreDuplicates: true })
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, rowCount: expenseRows.length, incomeCount: incomeRows.length, warnings }),
  }
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test -- tests/ingest-csv.test.js
```
Expected: PASS — all tests in the file pass

- [ ] **Step 5: Run all tests to verify no regressions**

```bash
npm test
```
Expected: PASS — all tests pass (some may be skipped)

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/ingest-csv.js tests/ingest-csv.test.js
git commit -m "feat: ingest-csv supports income rows and PLATINUM M/C category override"
```
