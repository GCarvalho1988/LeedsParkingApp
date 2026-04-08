# Audit Log — Design Spec

**Date:** 2026-04-08  
**Status:** Approved

## Overview

Add a server-side audit log to the LeedsParkingApp that records every booking and cancellation, including the requester's IP address. The log is viewable by admins via a new tab in the admin panel with per-column filtering.

## Scope

Tracked actions:
- **Book** — a user successfully books a parking space
- **Cancel** — a user successfully cancels their own booking

Not tracked: admin booking overrides, employee list changes.

## Data Schema

Each audit entry is a JSON object:

```json
{
  "ts": "2026-04-08T10:23:45.123Z",
  "action": "book",
  "space": "A",
  "date": "2026-04-09",
  "bookedBy": "Alice",
  "ip": "82.45.12.99"
}
```

- `ts` — ISO 8601 UTC timestamp of when the action was performed
- `action` — `"book"` or `"cancel"`
- `space` — parking space identifier (`"A"` or `"B"`)
- `date` — the booking date (YYYY-MM-DD), i.e. the date being booked or cancelled
- `bookedBy` — employee name as entered by the user
- `ip` — client IP from the `x-nf-client-connection-ip` Netlify header

## Storage

- Netlify Blob key: `audit-log` (same store as `bookings` and `employees`)
- Format: JSON array, newest entries at the end
- Retention: rolling cap of 500 entries — on each append, trim to last 500 before writing

## Append Strategy

Uses the same ETag conditional-write retry pattern as `book-space.js`:

1. Read `audit-log` blob with ETag
2. Append new entry, trim to 500
3. Write conditionally (`onlyIfMatch` / `onlyIfNew`)
4. On ETag mismatch, retry (up to 5 attempts, 150ms × attempt backoff)

The append is called after a successful booking/cancel write and wrapped in `try/catch` — an audit write failure must never affect the booking response.

## Server-Side Changes

### New: `netlify/functions/_audit-helpers.js`

Single export:

```js
export async function appendAuditLog(req, { action, space, date, bookedBy })
```

- Extracts IP from `req.headers.get('x-nf-client-connection-ip')`
- Builds the entry with `ts: new Date().toISOString()`
- Runs the ETag retry loop against the `audit-log` blob
- Trims to 500 on each attempt

### Modified: `netlify/functions/book-space.js`

After the successful `writeBlobConditional` for the booking, add:

```js
try {
  await appendAuditLog(req, { action: 'book', space, date, bookedBy: name });
} catch { /* non-fatal */ }
```

### Modified: `netlify/functions/cancel-booking.js`

After the successful `writeBlobConditional` for the cancellation, add:

```js
try {
  await appendAuditLog(req, { action: 'cancel', space: target.space, date: target.date, bookedBy: target.bookedBy });
} catch { /* non-fatal */ }
```

### New: `netlify/functions/get-audit-log.js`

- Validates `ADMIN_PASSWORD` from request body
- Returns the full `audit-log` array (up to 500 entries)
- No pagination required at this scale

## Client-Side Changes

### `api.js`

New function:

```js
export async function adminGetAuditLog(password)
```

Calls `/api/get-audit-log` with the admin password.

### `ui.js`

New "Audit Log" tab added to the admin panel tab bar (third tab, after Employees and Bookings).

**Tab behaviour:**
- Log is fetched once when the tab is first opened
- All filtering is client-side (no re-fetch on filter change)
- Entries are displayed in reverse order (newest first); the blob stores them oldest-first (append to end)

**Table columns:** Timestamp, Action, Name, Space, Booking Date, IP Address

**Column filters (sub-header row below column labels):**
- Timestamp — text input, substring match against formatted timestamp string
- Action — dropdown (`All / Book / Cancel`)
- Name — text input, substring match (case-insensitive)
- Space — dropdown (`All / A / B`)
- Booking Date — date picker, exact day match against `date` field
- IP Address — text input, substring match

All active filters combine with AND logic. A "Showing X of Y entries" count above the table updates live as filters change.

**Visual design:** Matches existing admin panel style. Action column uses coloured pill badges (green for BOOK, red for CANCEL). IP address displayed in monospace.

## Out of Scope

- Exporting the log (CSV, etc.)
- Admin ability to clear the log
- Logging admin actions (employee adds/removes, admin booking overrides)
- Pagination (500 entries is sufficient at this scale)
