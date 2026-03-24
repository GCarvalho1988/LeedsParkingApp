# Design Spec: Netlify Blobs Migration + Admin Panel

**Date:** 2026-03-24
**Branch:** `smartsheet-api` *(branch name predates pivot from Smartsheet to Netlify Blobs — same branch)*
**Status:** Approved

---

## Overview

Replace the current Power Automate + SharePoint architecture with a fully Netlify-native solution using Netlify Blobs for persistence. Add a password-protected admin panel embedded in the main app.

**Motivation:** Power Automate flows are slow (3–8s per operation, with cold-start penalties). Direct Netlify Blobs access eliminates all external service dependencies and reduces response times to ~500ms.

---

## Architecture

```
Frontend (unchanged) → Netlify Functions → Netlify Blobs
```

### Netlify Blobs Store: `parking-app`

| Key | Value | Type |
|---|---|---|
| `employees` | `["Alice Smith", "Bob Jones", ...]` | JSON array of strings |
| `bookings` | `[{ id, date, space, bookedBy }, ...]` | JSON array of objects |

### Booking object shape

```json
{
  "id": "uuid-v4",
  "date": "2026-03-24",
  "space": 1,
  "bookedBy": "Alice Smith"
}
```

### Fixed constants

- **Spaces:** hardcoded as `2` everywhere. Not configurable — physical limitation.
- **Admin password:** Netlify env var `ADMIN_PASSWORD`. Checked server-side on every admin request. No sessions or tokens. Netlify enforces HTTPS; admin functions must never log request bodies (password would be exposed in function logs).

---

## Netlify Functions

Replaces all 4 existing Power Automate proxy functions. Two new admin functions added.

### Public endpoints

> **Note on response shape change:** `get-employees` previously returned `[{ "": "Alice Smith" }]` (PA flow format). It now returns `["Alice Smith", ...]` (plain strings). The `Object.values(e)[0]` transform in `api.js` `getEmployees()` must be removed. The corresponding test fixture must also be updated from object format to string format.

> **Note on `get-bookings` parameters:** Parameters are sent in the POST body as `{ start, end }`. The existing `api.test.js` asserts query-string parameters (`?start=...`) — this is incorrect and must be fixed during the test update.

| Function | Endpoint | Request | Response |
|---|---|---|---|
| `get-employees.js` | `POST /api/get-employees` | `{}` | `["Alice Smith", ...]` |
| `get-bookings.js` | `POST /api/get-bookings` | `{ start, end }` (ISO dates, in body) | `[{ id, date, space, bookedBy }, ...]` |
| `book-space.js` | `POST /api/book-space` | `{ date, space, name }` | `{ id }` or `{ error }` |
| `cancel-booking.js` | `POST /api/cancel-booking` | `{ id }` | `{ success: true }` |

> **`cancel-booking` ownership:** No ownership verification — any user who knows a booking `id` can cancel it. Accepted as intentional for a trusted internal team.

### `book-space.js` logic (race condition handling)

1. Read `bookings` blob
2. If user already has a booking on that date → return `{ error: 'alreadyBooked' }`
3. If requested space is already taken on that date → return `{ error: 'taken', bookedBy: '<name>' }`
4. Append new booking with generated UUID, write blob back
5. Return `{ id: '<new-uuid>' }`

> **Race condition:** A small window exists between read and write. Accepted as low-risk (15 users, 2 spaces, unlikely simultaneous bookings). The same read-modify-write pattern applies to all admin blob writes — the same risk is accepted there too. Admin UI should disable action buttons during in-flight requests to reduce the window.

### Admin endpoints

| Function | Endpoint | What it does |
|---|---|---|
| `admin-employees.js` | `POST /api/admin-employees` | Check password, then add or remove an employee |
| `admin-bookings.js` | `POST /api/admin-bookings` | Check password, then add or cancel any booking |

**Admin auth pattern** (same 2 lines at top of both admin functions):
```js
if (body.password !== process.env.ADMIN_PASSWORD) {
  return { status: 401, body: { error: 'unauthorized' } }
}
// do NOT log body — contains password
```

**`admin-employees.js` request body:**
```json
{ "password": "...", "action": "add", "name": "Alice Smith" }
{ "password": "...", "action": "remove", "name": "Alice Smith" }
```

**`admin-employees.js` duplicate guard:** Adding a name that already exists in the `employees` array returns `{ error: 'alreadyExists' }` — no duplicate entries permitted.

**`admin-employees.js` cascade behaviour:** Removing an employee does **not** cancel their existing future bookings. Orphaned bookings remain visible in the admin bookings grid (the name still renders, just no longer appears in the employee dropdown). Admin must cancel orphaned bookings manually via the bookings tab.

**`admin-employees.js` cache invalidation:** After a successful add or remove, `api.js` must clear `_employeeCache` so the main booking UI reflects the change without a page reload.

**`admin-bookings.js` request body:**
```json
{ "password": "...", "action": "add", "booking": { "date": "2026-03-24", "space": 1, "bookedBy": "Alice Smith" } }
{ "password": "...", "action": "cancel", "booking": { "id": "uuid-v4" } }
```

- `add`: UUID is generated server-side. Admin bypasses `alreadyBooked` and `taken` constraints — intentional, allows override of any slot. `bookedBy` is **not** validated against the employee list — admin is trusted to enter a valid name.
- `cancel`: removes by `id` only. No ownership check.

---

## Blob Initialisation

If either blob key does not exist (fresh deploy), functions treat it as an empty array. If the blob exists but `JSON.parse` fails (corrupted data), functions return `{ error: 'storageError' }` with HTTP 500 rather than crashing silently.

---

## Admin Panel UI

### Access

A small lock icon in the corner of the existing UI. Clicking it shows a password prompt overlay. Correct password reveals the admin panel inline; wrong password shakes and clears the input. UI shows `{ error: 'unauthorized' }` response as "Incorrect password".

Password is held in memory only — never stored in `localStorage`. Closing or refreshing the page locks the panel again.

### Employee tab

- List of current employees, each with a "Remove" button
- "Add employee" text input + button at the bottom
- Buttons disabled during in-flight requests
- Changes call `POST /api/admin-employees`
- On success: clears `_employeeCache`, re-renders employee list

### Bookings tab

- Same 4-week grid as the main app
- Every booked cell (not just the current user's) shows a cancel button
- "Add booking" form: pick employee from dropdown, date, space (1 or 2)
- Buttons disabled during in-flight requests
- Changes call `POST /api/admin-bookings`

---

## Frontend Changes

| File | Change |
|---|---|
| `api.js` | Replace PA webhook calls with `/api/*` fetch calls. Remove `Object.values` transform in `getEmployees()`. Add `adminAddEmployee`, `adminRemoveEmployee`, `adminBookSpace`, `adminCancelBooking` functions. Admin functions clear `_employeeCache` after employee mutations. |
| `ui.js` | Add lock icon, password overlay, admin panel (two tabs: Employees, Bookings). Admin booking grid reuses existing grid rendering with cancel button on every booked cell. Disable buttons on in-flight requests. |
| `app.js` | Minor: wire up admin unlock flow |
| `config.js` | Remove PA URL placeholders (now unused) |
| `netlify/functions/` | Replace 4 PA proxy functions with 4 direct Blob functions + 2 admin functions |
| `netlify.toml` | Keep `/api/*` redirect pattern — no change needed |

---

## Removed

- All 4 Power Automate cloud flows
- 4 existing Netlify proxy functions (replaced)
- Smartsheet dependency (never introduced — original plan superseded)
- `FLOW_GET_EMPLOYEES`, `FLOW_GET_BOOKINGS`, `FLOW_BOOK_SPACE`, `FLOW_CANCEL_BOOKING` env vars

---

## Testing

- Existing Jest tests for `dates.js`, `identity.js` — **unchanged**
- Existing Jest tests for `api.js` — **updated**: remove `Object.values` fixture, fix `get-bookings` query-string assertion to use POST body, mock Blob-backed endpoints
- New Jest tests for admin API functions (`adminAddEmployee`, `adminRemoveEmployee`, `adminBookSpace`, `adminCancelBooking`)
- Netlify functions themselves: not unit tested — thin wrappers, validated via manual integration testing

---

## Deployment Notes

1. Add `ADMIN_PASSWORD` env var in Netlify dashboard
2. Remove old `FLOW_*` env vars from Netlify dashboard
3. Fresh deploy — existing SharePoint bookings manually re-entered via admin panel (clean cut-over agreed)
