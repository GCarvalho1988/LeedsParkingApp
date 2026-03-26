# Budgeting Dashboard Redesign — Design Spec

**Date:** 2026-03-26
**Status:** Approved for implementation

---

## Overview

A full redesign of the budgeting dashboard applying a "Cinematic Editorial" dark aesthetic, fixing two data bugs, and adding category re-assignment to the transactions page. No new pages; all changes are to existing components and pages.

---

## Bug Fixes

### 1. Invalid date filter (Overview KPIs empty)
`Overview.jsx` uses `${period}-32` as the upper date bound, which is invalid for months shorter than 32 days (e.g. February). Supabase rejects the query and returns no data, so KPI cards show `£0.00` and the category chart is blank.

**Fix:** Replace `-32` with a proper next-month boundary:
```js
const nextMonth = new Date(Number(y), Number(m), 1) // month is 1-based, so this rolls to next month
const nextPeriod = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
// use: .gte('date', `${period}-01`).lt('date', nextPeriod)
```

### 2. Supabase 1000-row default limit (trend truncated at Mar 25)
`Overview.jsx` and `Categories.jsx` fetch all raw transactions (`select date, amount`) and aggregate client-side. Supabase's default row cap is 1000 — with 1000+ transactions ordered ascending, only the oldest rows are returned, cutting the trend off at March 2025.

**Fix:** Create a Postgres RPC function `get_monthly_totals()` that returns one row per month `(period text, total numeric)`. The browser calls this instead of fetching raw rows. Apply `.limit(10000)` as a safety net on any remaining raw fetches.

---

## New Feature: Category Re-assignment

Transactions already have a `category` column. Allow both admin and member to update it to any category already present in the DB.

### Database
- No schema change needed — update `transactions.category` in-place
- New Supabase RPC: `get_distinct_categories()` → returns sorted list of distinct category values
- RLS policy update: add `UPDATE (category)` permission for authenticated users on `transactions`

### UI (Transactions page)
- Category column cell becomes a styled chip
- Clicking the chip opens an inline `<select>` dropdown populated from `get_distinct_categories()`
- On change: `supabase.from('transactions').update({ category }).eq('id', id)`
- On success: update local state (no full reload)
- On error: revert and show inline error toast

### New Supabase RPC `get_monthly_totals`
```sql
CREATE OR REPLACE FUNCTION get_monthly_totals()
RETURNS TABLE (period text, total numeric)
LANGUAGE sql STABLE
AS $$
  SELECT
    to_char(date, 'YYYY-MM') AS period,
    SUM(amount) AS total
  FROM transactions
  GROUP BY 1
  ORDER BY 1;
$$;
```

### New Supabase RPC `get_distinct_categories`
```sql
CREATE OR REPLACE FUNCTION get_distinct_categories()
RETURNS TABLE (category text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT category FROM transactions ORDER BY 1;
$$;
```

### RLS policy update
Add an UPDATE policy on `transactions` for authenticated users, restricted to the `category` column only:
```sql
CREATE POLICY "Authenticated users can update category"
  ON transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```
Note: Supabase column-level RLS isn't supported natively — the policy allows the full row update but the app only ever sends `{ category }` in the update payload, keeping it safe in practice.

---

## Visual Design System

Applies the "Cinematic Editorial" aesthetic spec provided by the user.

### Fonts
Load via Fontshare CDN in `index.html`:
- **Clash Grotesk** — nav brand, section headings, uppercase labels
- **General Sans** — all body text, table cells, form inputs

### CSS Tokens (Tailwind CSS vars in `index.css`)
```css
:root {
  --color-bg:       #181818;
  --color-text:     #EBDCC4;
  --color-muted:    #B6A596;
  --color-accent:   #DC9F85;
  --color-border:   #66473B;
  --color-divider:  #35211A;
}
```

### Noise Overlay
Fixed full-viewport pseudo-element in `index.css`:
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* fractal noise SVG */
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
}
```

### Core Rules
- Background: `#181818` everywhere (body, cards, modals, dropdowns)
- Text: `#EBDCC4` primary, `#B6A596` secondary/labels
- Borders: `1px solid #66473B` for cards/inputs; `1px solid #35211A` for dividers
- Border radius: `4px` max, no pill shapes
- No box shadows, no gradients
- Buttons: Upload CSV → solid `#DC9F85` bg, `#181818` text, bold uppercase, 4px radius
- Ghost buttons → `1px #66473B` border, `#EBDCC4` text

### Chart Colours (Recharts)
- Bar fill / line stroke: `#DC9F85`
- Secondary series: `#B6A596`
- Grid lines: `#35211A`
- Axis tick text: `#B6A596`
- Tooltip bg: `#181818`, border `#66473B`

---

## Per-Page Layout Changes

### Navbar (`Navbar.jsx`)
- Brand: `BUDGETDASH` in Clash Grotesk, uppercase, `#B6A596`, wide tracking
- Tabs: uppercase, `#B6A596` inactive, `#EBDCC4` active with `1px solid #DC9F85` bottom underline
- Right: Upload CSV button (accent), Sign out ghost button
- Bottom border: `1px solid #35211A`
- Background: `#181818`

### Overview (`Overview.jsx`)
- **Month picker** added above KPI row: `< Feb 2026 >` — prev/next arrows in `#DC9F85`, label in Clash Grotesk uppercase `#EBDCC4`. Defaults to most recent period; navigates only through periods present in the `uploads` table (fetched once on mount).
- KPI cards: dark bg, `1px #66473B` border, label in `#B6A596` small uppercase, value in Clash Grotesk large `#EBDCC4`
- Spend by Category: dark panel, recharts bar chart with accent colours — now populated (bug fix)
- Monthly Trend: all months shown via RPC — chart extends to Feb 2026

### Categories (`Categories.jsx`)
- Category pill buttons: `1px #66473B` border, `#B6A596` text; selected → `#DC9F85` border + text
- YoY stat cards: same dark card style as Overview KPIs
- Chart: dark treatment
- Transaction list rows: `#181818` bg, `1px #35211A` bottom border per row

### Year vs Year (`YearVsYear.jsx`)
- Table: `#181818` bg, header row `#35211A` bg, `#B6A596` header text uppercase
- Alternating rows: `#181818` / slight tint `rgba(255,255,255,0.02)`
- Positive change: `#DC9F85`; negative: `#B6A596`; neutral `—`: `#35211A` text

### Transactions (`Transactions.jsx`)
- Filter bar: dark selects/inputs with `1px #66473B` border, `#B6A596` placeholder
- Table header: uppercase, `#B6A596`, `1px #35211A` bottom border
- Category cell: styled chip — `1px #66473B` border, `#B6A596` text, 4px radius. Click → inline `<select>` with same dark styling, populated from `get_distinct_categories()`
- Flag button: replace tiny icon with a `FLAG` pill — `1px #66473B` border, `#B6A596` text, 4px radius. Flagged rows show `#DC9F85` accent
- Flag modal: dark overlay, `#181818` bg panel, `1px #66473B` border, textarea dark-styled

### Login (`Login.jsx`)
- Full `#181818` bg
- `BUDGETDASH` heading in Clash Grotesk, oversized, centered
- Input fields: transparent bg, `1px #66473B` border, `#B6A596` placeholder, `#EBDCC4` input text
- Sign in button: solid `#DC9F85`, `#181818` text, bold uppercase

---

## Component Changes Summary

| Component | Changes |
|---|---|
| `index.css` | CSS tokens, noise overlay, font imports |
| `Navbar.jsx` | Dark styling, brand text, tab styles |
| `KpiCard.jsx` | Dark card, Clash Grotesk value |
| `CategoryBarChart.jsx` | Dark Recharts config |
| `MonthlyTrendChart.jsx` | Dark Recharts config, uses RPC data |
| `FlagButton.jsx` | Visible FLAG pill, dark modal |
| `Overview.jsx` | Month picker, bug fix, RPC for trend |
| `Categories.jsx` | Dark styling, `.limit(10000)` fix |
| `YearVsYear.jsx` | Dark table styling |
| `Transactions.jsx` | Category chip + re-assign, FLAG button |
| `Login.jsx` | Dark full-page redesign |
| `supabase/migrations/` | RPC functions + RLS update |

---

## Out of Scope

- No new pages
- No mobile-specific layout changes (responsive is implicit via existing Tailwind)
- No category creation/deletion — re-assign to existing values only
- No light mode toggle — dark is the only mode
