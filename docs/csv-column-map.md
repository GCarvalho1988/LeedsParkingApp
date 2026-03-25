# LifeStages CSV Column Map

Verified against: `Transaction Export 02-02-2026.csv`

## CSV Export Format (monthly uploads)

| CSV Column Header | Maps to | Notes |
|---|---|---|
| `DATE` | `date` | Already ISO format: `YYYY-MM-DD`. Use directly, no parsing needed. |
| `AMOUNT` | `amount` | Negative = expenditure (money out). Positive = income/refunds — **excluded from import**. Store as `Math.abs(AMOUNT)`. |
| `DESCRIPTION` | `description` | Free-text merchant name. May contain padding spaces. Trim on import. |
| `CATEGORY` | `category` | LifeStages tag (e.g. "Eating out", "Travel", "Clothing & shoes"). |
| `CATEGORY GROUP` | *(drop)* | Higher-level grouping (e.g. "Entertainment", "Transport"). Not imported — may add later. |
| `ACCOUNT` | *(drop)* | Source account name. All joint account transactions. Not imported. |
| `TO ACCOUNT` | *(drop)* | Usually "N/A". Not imported. |
| `PROJECT` | *(drop)* | Usually "N/A". Not imported. |
| `NOTES` | *(drop)* | Usually empty. Not imported. |

## Import Rule

**Only import rows where `AMOUNT < 0`** (expenditure). Positive amounts (salary transfers, refunds, income) are excluded — they are not expenditure and would skew spend totals.

## Excel Format (Historical Transactions.xlsx)

Two sheets covering Oct 2024 – Feb 2026:
- `Agg Transactions 2425` — Oct 2024 to Sep 2025 (2,419 data rows)
- `Agg Transactions 2526` — Oct 2025 to Feb 2026 (1,025 data rows)

Same columns as CSV **plus** a `MONTH` column (drop — same value as `DATE`).

**Key difference:** `DATE` and `MONTH` are **Excel serial date numbers**, not strings.
- Convert using: `XLSX.SSF.parse_date_code(serialNumber)` → `{ y, m, d }`
- Example: `45566` → Oct 2024

## Data Quirks

- Description strings may have excessive internal spacing (normalise with `.trim()` — single spaces between words not guaranteed, leave as-is beyond trimming)
- Some amounts are integers (e.g. `-20`), some are decimals (e.g. `-7.5`, `-11.45`) — parse as float
- The Excel file may contain rows already covered by the LifeStages CSV export (Feb 2026 overlap) — the seeder's duplicate-period check handles this
- Encoding: UTF-8 (CSV confirmed)
