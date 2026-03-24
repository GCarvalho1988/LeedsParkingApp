# Netlify Blobs Migration + Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Power Automate + SharePoint backend with Netlify Blobs, and add a password-protected admin panel embedded in the main app.

**Architecture:** Seven Netlify Functions read/write two JSON blobs (`employees`, `bookings`) in a `parking-app` Netlify Blobs store. Four functions replace the existing PA proxies; two new functions serve a lock-icon-accessed admin panel in the UI. One additional file (`_blob-helpers.js`) is a shared non-endpoint utility.

**Tech Stack:** Netlify Functions v1 (ESM, `export const handler`), `@netlify/blobs` npm package, vanilla JS ES modules (frontend), Jest (tests).

> **Module format note:** The root `package.json` already has `"type": "module"`, meaning all `.js` files in the repo — including `netlify/functions/` — are treated as ES modules. All Netlify Function files in this plan use ESM syntax (`import`/`export const handler`). Do **not** use `require()` or `exports.handler = ...` — these are CommonJS and will fail.

**Spec:** `docs/superpowers/specs/2026-03-24-netlify-blobs-migration-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add `@netlify/blobs` to dependencies |
| `config.js` | Modify | Clear PA URL placeholders (now unused) |
| `netlify/functions/_blob-helpers.js` | **Create** | Shared `readBlob` / `writeBlob` helpers |
| `netlify/functions/get-employees.js` | Rewrite | Read `employees` blob, return plain string array |
| `netlify/functions/get-bookings.js` | Rewrite | Read `bookings` blob, filter by date range |
| `netlify/functions/book-space.js` | Rewrite | Constraint checks + append booking to blob |
| `netlify/functions/cancel-booking.js` | Rewrite | Remove booking by id from blob |
| `netlify/functions/admin-employees.js` | **Create** | Password-gated add/remove employee |
| `netlify/functions/admin-bookings.js` | **Create** | Password-gated add/cancel any booking |
| `api.js` | Modify | Remove `Object.values` transform; add 4 admin functions + cache invalidation |
| `tests/api.test.js` | Modify | Fix fixtures + URL assertions; add admin function tests |
| `ui.js` | Modify | Add lock icon, password overlay, admin panel (2 tabs) |
| `style.css` | Modify | Admin panel styles |
| `app.js` | Modify | Wire lock icon into card header |

---

## Task 1: Install @netlify/blobs and clear config.js

**Files:**
- Modify: `package.json`
- Modify: `config.js`

- [ ] **Step 1: Add @netlify/blobs to package.json dependencies**

  Edit `package.json` to add a `dependencies` section:

  ```json
  {
    "name": "leeds-parking-area",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
    },
    "dependencies": {
      "@netlify/blobs": "^8.1.0"
    },
    "devDependencies": {
      "jest": "^29.7.0"
    }
  }
  ```

- [ ] **Step 2: Install dependencies**

  Run: `npm install`
  Expected: `@netlify/blobs` appears in `node_modules/`

- [ ] **Step 3: Clear config.js**

  Replace the entire content of `config.js` with:

  ```js
  // Power Automate URLs removed — app now uses Netlify Blobs directly.
  // Admin password is set via ADMIN_PASSWORD environment variable in Netlify dashboard.
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json config.js
  git commit -m "chore: install @netlify/blobs, clear config.js"
  ```

---

## Task 2: Create shared blob helper

**Files:**
- Create: `netlify/functions/_blob-helpers.js`

> The underscore prefix tells Netlify not to expose this as a function endpoint.

- [ ] **Step 1: Create the helper file**

  ```js
  // netlify/functions/_blob-helpers.js
  // Shared utilities for reading and writing Netlify Blobs.
  // Returns [] for missing keys. Returns null and lets the caller
  // return a 500 storageError if JSON is corrupt.
  import { getStore } from '@netlify/blobs';

  const _store = () => getStore('parking-app');

  export async function readBlob(key) {
    const store = _store();
    const raw = await store.get(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return null; // caller must handle as storageError
    }
  }

  export async function writeBlob(key, data) {
    const store = _store();
    await store.set(key, JSON.stringify(data));
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add netlify/functions/_blob-helpers.js
  git commit -m "feat: add shared blob helpers for Netlify Functions"
  ```

---

## Task 3: Rewrite get-employees.js

**Files:**
- Modify: `netlify/functions/get-employees.js`

- [ ] **Step 1: Rewrite the function**

  ```js
  // netlify/functions/get-employees.js
  import { readBlob } from './_blob-helpers.js';

  export const handler = async () => {
    const employees = await readBlob('employees');
    if (employees === null) {
      return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
    }
    return { statusCode: 200, body: JSON.stringify(employees) };
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add netlify/functions/get-employees.js
  git commit -m "feat: rewrite get-employees to use Netlify Blobs"
  ```

---

## Task 4: Rewrite get-bookings.js

**Files:**
- Modify: `netlify/functions/get-bookings.js`

- [ ] **Step 1: Rewrite the function**

  ```js
  // netlify/functions/get-bookings.js
  import { readBlob } from './_blob-helpers.js';

  export const handler = async (event) => {
    const { start, end } = JSON.parse(event.body || '{}');
    const bookings = await readBlob('bookings');
    if (bookings === null) {
      return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
    }
    const filtered = bookings.filter((b) => b.date >= start && b.date <= end);
    return { statusCode: 200, body: JSON.stringify(filtered) };
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add netlify/functions/get-bookings.js
  git commit -m "feat: rewrite get-bookings to use Netlify Blobs"
  ```

---

## Task 5: Rewrite book-space.js

**Files:**
- Modify: `netlify/functions/book-space.js`

- [ ] **Step 1: Rewrite the function**

  ```js
  // netlify/functions/book-space.js
  import { readBlob, writeBlob } from './_blob-helpers.js';

  export const handler = async (event) => {
    const { date, space, name } = JSON.parse(event.body || '{}');
    const bookings = await readBlob('bookings');
    if (bookings === null) {
      return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
    }

    // One booking per user per day
    if (bookings.some((b) => b.date === date && b.bookedBy === name)) {
      return { statusCode: 200, body: JSON.stringify({ error: 'alreadyBooked' }) };
    }

    // Space already taken
    const conflict = bookings.find((b) => b.date === date && b.space === space);
    if (conflict) {
      return { statusCode: 200, body: JSON.stringify({ error: 'taken', bookedBy: conflict.bookedBy }) };
    }

    const id = crypto.randomUUID();
    bookings.push({ id, date, space, bookedBy: name });
    await writeBlob('bookings', bookings);
    return { statusCode: 200, body: JSON.stringify({ id }) };
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add netlify/functions/book-space.js
  git commit -m "feat: rewrite book-space to use Netlify Blobs"
  ```

---

## Task 6: Rewrite cancel-booking.js

**Files:**
- Modify: `netlify/functions/cancel-booking.js`

- [ ] **Step 1: Rewrite the function**

  ```js
  // netlify/functions/cancel-booking.js
  import { readBlob, writeBlob } from './_blob-helpers.js';

  export const handler = async (event) => {
    const { id } = JSON.parse(event.body || '{}');
    const bookings = await readBlob('bookings');
    if (bookings === null) {
      return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
    }
    await writeBlob('bookings', bookings.filter((b) => b.id !== id));
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add netlify/functions/cancel-booking.js
  git commit -m "feat: rewrite cancel-booking to use Netlify Blobs"
  ```

---

## Task 7: Create admin-employees.js

**Files:**
- Create: `netlify/functions/admin-employees.js`

- [ ] **Step 1: Create the function**

  ```js
  // netlify/functions/admin-employees.js
  import { readBlob, writeBlob } from './_blob-helpers.js';

  export const handler = async (event) => {
    const body = JSON.parse(event.body || '{}');
    // do NOT log body — contains password
    if (body.password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 200, body: JSON.stringify({ error: 'unauthorized' }) };
    }

    // Reject empty or whitespace-only names before any blob access
    if (!body.name || !body.name.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invalidName' }) };
    }

    const employees = await readBlob('employees');
    if (employees === null) {
      return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
    }

    if (body.action === 'add') {
      if (employees.includes(body.name)) {
        return { statusCode: 200, body: JSON.stringify({ error: 'alreadyExists' }) };
      }
      employees.push(body.name);
      await writeBlob('employees', employees);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (body.action === 'remove') {
      await writeBlob('employees', employees.filter((e) => e !== body.name));
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'unknownAction' }) };
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add netlify/functions/admin-employees.js
  git commit -m "feat: add admin-employees Netlify Function"
  ```

---

## Task 8: Create admin-bookings.js

**Files:**
- Create: `netlify/functions/admin-bookings.js`

- [ ] **Step 1: Create the function**

  ```js
  // netlify/functions/admin-bookings.js
  import { readBlob, writeBlob } from './_blob-helpers.js';

  export const handler = async (event) => {
    const body = JSON.parse(event.body || '{}');
    // do NOT log body — contains password
    if (body.password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 200, body: JSON.stringify({ error: 'unauthorized' }) };
    }

    const bookings = await readBlob('bookings');
    if (bookings === null) {
      return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
    }

    if (body.action === 'add') {
      const id = crypto.randomUUID();
      bookings.push({ id, ...body.booking });
      await writeBlob('bookings', bookings);
      return { statusCode: 200, body: JSON.stringify({ id }) };
    }

    if (body.action === 'cancel') {
      await writeBlob('bookings', bookings.filter((b) => b.id !== body.booking.id));
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'unknownAction' }) };
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add netlify/functions/admin-bookings.js
  git commit -m "feat: add admin-bookings Netlify Function"
  ```

---

## Task 9: Update api.js and its tests (public functions)

**Files:**
- Modify: `api.js`
- Modify: `tests/api.test.js`

The existing `api.test.js` has two issues to fix:
1. Employee fixture uses `{ '': 'Alice Smith' }` objects — must change to plain strings `'Alice Smith'`
2. `getBookingsForWeek` test asserts a query-string URL — must change to assert POST body
3. The `config.js` mock at the top is dead code (api.js never imports config.js) — remove it

- [ ] **Step 1: Write the failing tests**

  Replace the entire content of `tests/api.test.js` with the updated public-function tests (admin tests added in Task 10):

  ```js
  import { jest } from '@jest/globals';

  const { getEmployees, getBookingsForWeek, bookSpace, cancelBooking, clearEmployeeCache } = await import('../api.js');

  // Helper: mock a single fetch response
  function mockFetch(body, ok = true) {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Internal Server Error',
      json: async () => body,
    });
  }

  beforeEach(() => jest.clearAllMocks());

  // ─── getEmployees ──────────────────────────────────────────────────────────

  describe('getEmployees', () => {
    beforeEach(() => clearEmployeeCache()); // isolate cache between tests

    test('returns plain string array from the endpoint', async () => {
      mockFetch(['Alice Smith', 'Bob Jones']);
      const result = await getEmployees();
      expect(result).toEqual(['Alice Smith', 'Bob Jones']);
      expect(fetch).toHaveBeenCalledWith(
        '/api/get-employees',
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('throws on non-OK response', async () => {
      mockFetch({}, false);
      await expect(getEmployees()).rejects.toThrow('Flow error');
    });
  });

  // ─── getBookingsForWeek ────────────────────────────────────────────────────

  describe('getBookingsForWeek', () => {
    test('POSTs start/end in body and returns bookings array', async () => {
      const data = [{ id: '1', date: '2026-03-24', space: 1, bookedBy: 'Alice Smith' }];
      mockFetch(data);
      const result = await getBookingsForWeek('2026-03-24', '2026-03-28');
      expect(result).toEqual(data);
      expect(fetch).toHaveBeenCalledWith(
        '/api/get-bookings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ start: '2026-03-24', end: '2026-03-28' }),
        })
      );
    });

    test('returns empty array when endpoint returns []', async () => {
      mockFetch([]);
      const result = await getBookingsForWeek('2026-03-24', '2026-03-28');
      expect(result).toEqual([]);
    });
  });

  // ─── bookSpace ─────────────────────────────────────────────────────────────

  describe('bookSpace', () => {
    test('POSTs date, space, name and returns id on success', async () => {
      mockFetch({ id: 'uuid-123' });
      const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
      expect(result).toEqual({ id: 'uuid-123' });
      expect(fetch).toHaveBeenCalledWith(
        '/api/book-space',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ date: '2026-03-24', space: 1, name: 'Alice Smith' }),
        })
      );
    });

    test('returns alreadyBooked error', async () => {
      mockFetch({ error: 'alreadyBooked' });
      const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
      expect(result).toEqual({ error: 'alreadyBooked' });
    });

    test('returns taken error with bookedBy', async () => {
      mockFetch({ error: 'taken', bookedBy: 'Bob Jones' });
      const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
      expect(result).toEqual({ error: 'taken', bookedBy: 'Bob Jones' });
    });

    test('throws on non-OK response', async () => {
      mockFetch({}, false);
      await expect(bookSpace('2026-03-24', 1, 'Alice Smith')).rejects.toThrow('Flow error');
    });
  });

  // ─── cancelBooking ─────────────────────────────────────────────────────────

  describe('cancelBooking', () => {
    test('POSTs id and returns success', async () => {
      mockFetch({ success: true });
      const result = await cancelBooking('42');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/cancel-booking',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ id: '42' }),
        })
      );
    });

    test('throws on non-OK response', async () => {
      mockFetch({}, false);
      await expect(cancelBooking('42')).rejects.toThrow('Flow error');
    });
  });
  ```

- [ ] **Step 2: Run tests — expect failures**

  Run: `npm test -- --testPathPattern=api`
  Expected: `getEmployees` test fails (Object.values transform still in place); `getBookingsForWeek` URL assertion fails.

- [ ] **Step 3: Update api.js — remove Object.values transform and add clearEmployeeCache**

  Replace the entire content of `api.js`:

  ```js
  async function flowFetch(path, body = {}) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Flow error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  let _employeeCache = null;

  export function clearEmployeeCache() {
    _employeeCache = null;
  }

  export async function getEmployees() {
    if (_employeeCache) return _employeeCache;
    _employeeCache = await flowFetch('/api/get-employees');
    return _employeeCache;
  }

  export async function getBookingsForWeek(startDate, endDate) {
    return flowFetch('/api/get-bookings', { start: startDate, end: endDate });
  }

  export async function bookSpace(date, space, name) {
    return flowFetch('/api/book-space', { date, space, name });
  }

  export async function cancelBooking(id) {
    return flowFetch('/api/cancel-booking', { id });
  }
  ```

- [ ] **Step 4: Run tests — expect all public function tests to pass**

  Run: `npm test -- --testPathPattern=api`
  Expected: all `getEmployees`, `getBookingsForWeek`, `bookSpace`, `cancelBooking` tests PASS

- [ ] **Step 5: Run full test suite**

  Run: `npm test`
  Expected: all tests PASS

- [ ] **Step 6: Commit**

  ```bash
  git add api.js tests/api.test.js
  git commit -m "feat: update api.js for Netlify Blobs; fix test fixtures and URL assertions"
  ```

---

## Task 10: Add admin functions to api.js with tests

**Files:**
- Modify: `api.js`
- Modify: `tests/api.test.js`

- [ ] **Step 1: Write failing tests for admin functions**

  Append the following to `tests/api.test.js`:

  ```js
  // ─── Admin functions ───────────────────────────────────────────────────────
  // ESM modules are cached — a second import('../api.js') returns the same instance.
  // All admin functions are destructured from the same import at the top of this file.

  const {
    adminAddEmployee,
    adminRemoveEmployee,
    adminBookSpace,
    adminCancelBooking,
  } = await import('../api.js');

  describe('adminAddEmployee', () => {
    test('POSTs add action with password and name', async () => {
      mockFetch({ success: true });
      const result = await adminAddEmployee('secret', 'Carol White');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin-employees',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ password: 'secret', action: 'add', name: 'Carol White' }),
        })
      );
    });

    test('returns alreadyExists error without throwing', async () => {
      mockFetch({ error: 'alreadyExists' });
      const result = await adminAddEmployee('secret', 'Alice Smith');
      expect(result).toEqual({ error: 'alreadyExists' });
    });

    test('returns unauthorized on wrong password', async () => {
      mockFetch({ error: 'unauthorized' });
      const result = await adminAddEmployee('wrong', 'Carol White');
      expect(result).toEqual({ error: 'unauthorized' });
    });
  });

  describe('adminRemoveEmployee', () => {
    test('POSTs remove action with password and name', async () => {
      mockFetch({ success: true });
      const result = await adminRemoveEmployee('secret', 'Alice Smith');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin-employees',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ password: 'secret', action: 'remove', name: 'Alice Smith' }),
        })
      );
    });
  });

  describe('adminBookSpace', () => {
    test('POSTs add action with booking object', async () => {
      mockFetch({ id: 'new-uuid' });
      const booking = { date: '2026-03-24', space: 1, bookedBy: 'Alice Smith' };
      const result = await adminBookSpace('secret', booking);
      expect(result).toEqual({ id: 'new-uuid' });
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin-bookings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ password: 'secret', action: 'add', booking }),
        })
      );
    });
  });

  describe('adminCancelBooking', () => {
    test('POSTs cancel action with booking id', async () => {
      mockFetch({ success: true });
      const result = await adminCancelBooking('secret', 'uuid-42');
      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin-bookings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ password: 'secret', action: 'cancel', booking: { id: 'uuid-42' } }),
        })
      );
    });
  });

  describe('clearEmployeeCache', () => {
    test('forces getEmployees to re-fetch on next call', async () => {
      // Ensure cache is empty before this test
      clearEmployeeCache();
      // First call — populate cache
      mockFetch(['Alice Smith']);
      await getEmployees();
      // Clear cache
      clearEmployeeCache();
      // Second call — must fetch again
      mockFetch(['Alice Smith', 'Carol White']);
      const result = await getEmployees();
      expect(result).toEqual(['Alice Smith', 'Carol White']);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
  ```

- [ ] **Step 2: Run tests — expect failures (functions not yet exported)**

  Run: `npm test -- --testPathPattern=api`
  Expected: admin describe blocks fail with import errors

- [ ] **Step 3: Add admin functions to api.js**

  Append the following to `api.js` (after `cancelBooking`):

  ```js
  export async function adminAddEmployee(password, name) {
    const result = await flowFetch('/api/admin-employees', { password, action: 'add', name });
    if (!result.error) clearEmployeeCache();
    return result;
  }

  export async function adminRemoveEmployee(password, name) {
    const result = await flowFetch('/api/admin-employees', { password, action: 'remove', name });
    if (!result.error) clearEmployeeCache();
    return result;
  }

  export async function adminBookSpace(password, booking) {
    return flowFetch('/api/admin-bookings', { password, action: 'add', booking });
  }

  export async function adminCancelBooking(password, id) {
    return flowFetch('/api/admin-bookings', { password, action: 'cancel', booking: { id } });
  }
  ```

- [ ] **Step 4: Run tests — all should pass**

  Run: `npm test`
  Expected: all tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add api.js tests/api.test.js
  git commit -m "feat: add admin API functions with cache invalidation"
  ```

---

## Task 11: Admin panel styles

**Files:**
- Modify: `style.css`

Add styles for the admin lock icon, password overlay, and admin panel. Append to the end of `style.css`:

- [ ] **Step 1: Append admin styles**

  ```css
  /* ── Admin lock icon ─────────────────────────────────────────────────────── */
  .admin-lock-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    color: rgba(255,255,255,0.5);
    font-size: 0.85rem;
    line-height: 1;
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    transition: color 0.15s;
  }
  .admin-lock-btn:hover { color: rgba(255,255,255,0.9); }

  /* ── Admin password overlay ──────────────────────────────────────────────── */
  .admin-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .admin-overlay-box {
    background: var(--white);
    border-radius: 4px;
    padding: 1.75rem 2rem;
    width: min(340px, 90vw);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .admin-overlay-box h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--body);
  }
  .admin-password-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-size: 0.9rem;
    font-family: inherit;
  }
  .admin-password-input:focus {
    outline: 2px solid var(--s-cyan);
    outline-offset: 1px;
  }
  .admin-password-input.shake {
    animation: shake 0.35s ease;
    border-color: #ef4444;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(6px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }
  .admin-error-msg {
    font-size: 0.8rem;
    color: #dc2626;
    min-height: 1rem;
  }
  .admin-overlay-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  .admin-btn-cancel {
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--muted);
  }
  .admin-btn-unlock {
    padding: 0.4rem 0.9rem;
    border: none;
    border-radius: 3px;
    background: var(--s-navy);
    color: var(--white);
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .admin-btn-unlock:disabled { opacity: 0.5; cursor: default; }

  /* ── Admin panel ─────────────────────────────────────────────────────────── */
  .admin-panel {
    padding: 0 1.25rem 1.5rem;
  }
  .admin-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0 0.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.75rem;
  }
  .admin-panel-title {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .admin-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--muted);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
  }
  .admin-close-btn:hover { color: var(--body); }

  /* Tabs */
  .admin-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--border);
    margin-bottom: 1rem;
  }
  .admin-tab-btn {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
  }
  .admin-tab-btn.active {
    color: var(--s-navy);
    border-bottom-color: var(--s-navy);
    font-weight: 600;
  }

  /* Employees tab */
  .admin-employee-list {
    list-style: none;
    margin-bottom: 1rem;
  }
  .admin-employee-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--s-palest);
    font-size: 0.875rem;
  }
  .admin-remove-btn {
    background: none;
    border: 1px solid #fca5a5;
    color: #dc2626;
    border-radius: 3px;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    font-family: inherit;
  }
  .admin-remove-btn:hover { background: #fef2f2; }
  .admin-remove-btn:disabled { opacity: 0.4; cursor: default; }
  .admin-add-row {
    display: flex;
    gap: 0.5rem;
  }
  .admin-add-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .admin-add-btn {
    padding: 0.4rem 0.75rem;
    background: var(--s-navy);
    color: var(--white);
    border: none;
    border-radius: 3px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
  }
  .admin-add-btn:disabled { opacity: 0.5; cursor: default; }
  .admin-inline-msg {
    font-size: 0.78rem;
    color: #dc2626;
    margin-top: 0.35rem;
    min-height: 1rem;
  }

  /* Bookings tab */
  .admin-booking-form {
    background: var(--s-palest);
    border-radius: 3px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .admin-booking-form label {
    font-size: 0.78rem;
    color: var(--muted);
    display: block;
    margin-bottom: 0.15rem;
  }
  .admin-booking-form select,
  .admin-booking-form input {
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-size: 0.85rem;
    font-family: inherit;
    background: var(--white);
  }
  .admin-booking-submit {
    padding: 0.4rem 0.75rem;
    background: var(--s-navy);
    color: var(--white);
    border: none;
    border-radius: 3px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    align-self: flex-end;
  }
  .admin-booking-submit:disabled { opacity: 0.5; cursor: default; }

  /* Admin grid — same as main grid but with cancel on all taken cells */
  .cell-admin-cancel {
    display: block;
    margin-top: 0.2rem;
    background: none;
    border: 1px solid #fca5a5;
    color: #dc2626;
    border-radius: 3px;
    padding: 0.1rem 0.4rem;
    font-size: 0.7rem;
    cursor: pointer;
    font-family: inherit;
  }
  .cell-admin-cancel:hover { background: #fef2f2; }
  .cell-admin-cancel:disabled { opacity: 0.4; cursor: default; }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add style.css
  git commit -m "feat: add admin panel CSS styles"
  ```

---

## Task 12: Admin panel UI — lock icon and password overlay (ui.js)

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: Add admin imports and state to top of ui.js**

  After the existing imports at line 1–3, add:

  ```js
  import {
    adminAddEmployee, adminRemoveEmployee,
    adminBookSpace, adminCancelBooking,
  } from './api.js';
  ```

  After the existing module-level state variables (lines 5–9), add:

  ```js
  let _adminPassword = null; // held in memory only — never persisted
  ```

- [ ] **Step 2: Add renderAdminLockIcon export to ui.js**

  Append the following to `ui.js`:

  ```js
  // ─── Admin: lock icon ───────────────────────────────────────────────────────

  /**
   * Returns a lock button that, when clicked, shows the admin password overlay.
   * Intended to be injected into the card header by app.js.
   */
  export function buildAdminLockIcon() {
    const btn = document.createElement('button');
    btn.className = 'admin-lock-btn';
    btn.title = 'Admin';
    btn.textContent = '🔒';
    btn.addEventListener('click', () => _showAdminOverlay());
    return btn;
  }

  // ─── Admin: password overlay ────────────────────────────────────────────────

  function _showAdminOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-overlay';

    const box = document.createElement('div');
    box.className = 'admin-overlay-box';

    const heading = document.createElement('h2');
    heading.textContent = 'Admin access';
    box.appendChild(heading);

    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'admin-password-input';
    input.placeholder = 'Password';
    input.autocomplete = 'current-password';
    box.appendChild(input);

    const errMsg = document.createElement('div');
    errMsg.className = 'admin-error-msg';
    box.appendChild(errMsg);

    const actions = document.createElement('div');
    actions.className = 'admin-overlay-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'admin-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const unlockBtn = document.createElement('button');
    unlockBtn.className = 'admin-btn-unlock';
    unlockBtn.textContent = 'Unlock';
    unlockBtn.disabled = true;

    input.addEventListener('input', () => {
      unlockBtn.disabled = !input.value.trim();
      errMsg.textContent = '';
      input.classList.remove('shake');
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !unlockBtn.disabled) unlockBtn.click();
    });

    unlockBtn.addEventListener('click', async () => {
      unlockBtn.disabled = true;
      const password = input.value.trim();

      // Verify password by sending an empty name.
      // Server returns { error: 'unauthorized' } (HTTP 200) for wrong password.
      // Server returns { error: 'invalidName' } (HTTP 200) for correct password + empty name.
      // flowFetch only throws on non-OK HTTP — both cases return 200, so no throw expected.
      // Network failures are caught separately.
      let test;
      try {
        test = await adminAddEmployee(password, '');
      } catch {
        errMsg.textContent = 'Could not connect. Try again.';
        unlockBtn.disabled = false;
        return;
      }
      if (test.error === 'unauthorized') {
        input.value = '';
        input.classList.add('shake');
        errMsg.textContent = 'Incorrect password';
        unlockBtn.disabled = false;
        return;
      }

      _adminPassword = password;
      overlay.remove();
      _showAdminPanel();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(unlockBtn);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();
  }
  ```

  > **Note on password verification:** The overlay sends `{ action: 'add', name: '' }` to `admin-employees`. Wrong password → `unauthorized`. Empty name with correct password → `invalidName` (the empty-name guard fires before any blob is touched). Auth is confirmed on any response that is not `unauthorized` or `networkError`. This avoids a dedicated `/api/admin-verify` endpoint and ensures no data is written during the verification call.

- [ ] **Step 3: Commit**

  ```bash
  git add ui.js
  git commit -m "feat: add admin lock icon and password overlay to ui.js"
  ```

---

## Task 13: Admin panel UI — employees tab (ui.js)

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: Append employees tab renderer to ui.js**

  ```js
  // ─── Admin: panel shell ─────────────────────────────────────────────────────

  function _showAdminPanel() {
    const app = document.getElementById('app');

    const panel = document.createElement('div');
    panel.className = 'admin-panel';
    panel.id = 'admin-panel';

    // Header row
    const panelHeader = document.createElement('div');
    panelHeader.className = 'admin-panel-header';
    const title = document.createElement('span');
    title.className = 'admin-panel-title';
    title.textContent = 'Admin';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'admin-close-btn';
    closeBtn.textContent = '✕ Exit admin';
    closeBtn.addEventListener('click', () => {
      _adminPassword = null;
      panel.remove();
    });
    panelHeader.appendChild(title);
    panelHeader.appendChild(closeBtn);
    panel.appendChild(panelHeader);

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'admin-tabs';
    const tabEmployees = document.createElement('button');
    tabEmployees.className = 'admin-tab-btn active';
    tabEmployees.textContent = 'Employees';
    const tabBookings = document.createElement('button');
    tabBookings.className = 'admin-tab-btn';
    tabBookings.textContent = 'Bookings';
    tabBar.appendChild(tabEmployees);
    tabBar.appendChild(tabBookings);
    panel.appendChild(tabBar);

    // Content area
    const content = document.createElement('div');
    content.id = 'admin-tab-content';
    panel.appendChild(content);

    function showTab(name) {
      tabEmployees.classList.toggle('active', name === 'employees');
      tabBookings.classList.toggle('active', name === 'bookings');
      if (name === 'employees') _renderEmployeesTab(content);
      else _renderBookingsTab(content);
    }

    tabEmployees.addEventListener('click', () => showTab('employees'));
    tabBookings.addEventListener('click', () => showTab('bookings'));

    app.appendChild(panel);
    showTab('employees');
  }

  // ─── Admin: employees tab ───────────────────────────────────────────────────

  async function _renderEmployeesTab(container) {
    container.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);padding:0.5rem 0;">Loading…</p>';

    let employees;
    try {
      employees = await getEmployees();
    } catch {
      container.innerHTML = '<p style="font-size:0.85rem;color:#dc2626;">Could not load employees.</p>';
      return;
    }

    container.innerHTML = '';

    // Employee list
    const list = document.createElement('ul');
    list.className = 'admin-employee-list';

    function rebuildList(names) {
      list.innerHTML = '';
      names.forEach((name) => {
        const item = document.createElement('li');
        item.className = 'admin-employee-item';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'admin-remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', async () => {
          removeBtn.disabled = true;
          const result = await adminRemoveEmployee(_adminPassword, name);
          if (result.error === 'unauthorized') {
            _adminPassword = null;
            container.innerHTML = '<p style="color:#dc2626;font-size:0.85rem;">Session expired. Please reload.</p>';
            return;
          }
          // Re-render with updated list
          const updated = await getEmployees();
          rebuildList(updated);
        });
        item.appendChild(nameSpan);
        item.appendChild(removeBtn);
        list.appendChild(item);
      });
    }

    rebuildList(employees);
    container.appendChild(list);

    // Add employee row
    const addRow = document.createElement('div');
    addRow.className = 'admin-add-row';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'admin-add-input';
    addInput.placeholder = 'Full name';
    const addBtn = document.createElement('button');
    addBtn.className = 'admin-add-btn';
    addBtn.textContent = 'Add';
    addBtn.disabled = true;
    addInput.addEventListener('input', () => { addBtn.disabled = !addInput.value.trim(); });

    const inlineMsg = document.createElement('div');
    inlineMsg.className = 'admin-inline-msg';

    addBtn.addEventListener('click', async () => {
      const name = addInput.value.trim();
      if (!name) return;
      addBtn.disabled = true;
      inlineMsg.textContent = '';
      const result = await adminAddEmployee(_adminPassword, name);
      if (result.error === 'unauthorized') {
        _adminPassword = null;
        container.innerHTML = '<p style="color:#dc2626;font-size:0.85rem;">Session expired. Please reload.</p>';
        return;
      }
      if (result.error === 'alreadyExists') {
        inlineMsg.textContent = `"${name}" is already in the list.`;
        addBtn.disabled = false;
        return;
      }
      addInput.value = '';
      addBtn.disabled = true;
      const updated = await getEmployees();
      rebuildList(updated);
    });

    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    container.appendChild(addRow);
    container.appendChild(inlineMsg);
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add ui.js
  git commit -m "feat: add admin employees tab to ui.js"
  ```

---

## Task 14: Admin panel UI — bookings tab (ui.js)

**Files:**
- Modify: `ui.js`

- [ ] **Step 1: Append bookings tab renderer to ui.js**

  ```js
  // ─── Admin: bookings tab ────────────────────────────────────────────────────

  async function _renderBookingsTab(container) {
    container.innerHTML = '<p style="font-size:0.85rem;color:var(--muted);padding:0.5rem 0;">Loading…</p>';

    const days = bookableDays();
    const startDate = toISODate(days[0]);
    const endDate = toISODate(days[days.length - 1]);

    let bookings, employees;
    try {
      [bookings, employees] = await Promise.all([
        getBookingsForWeek(startDate, endDate),
        getEmployees(),
      ]);
    } catch {
      container.innerHTML = '<p style="font-size:0.85rem;color:#dc2626;">Could not load data.</p>';
      return;
    }

    container.innerHTML = '';

    // Add booking form
    const form = document.createElement('div');
    form.className = 'admin-booking-form';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Employee';
    const nameSelect = document.createElement('select');
    const namePlaceholder = document.createElement('option');
    namePlaceholder.value = '';
    namePlaceholder.textContent = '— Select —';
    namePlaceholder.disabled = true;
    namePlaceholder.selected = true;
    nameSelect.appendChild(namePlaceholder);
    employees.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      nameSelect.appendChild(opt);
    });

    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date (YYYY-MM-DD)';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.min = startDate;
    dateInput.max = endDate;

    const spaceLabel = document.createElement('label');
    spaceLabel.textContent = 'Space';
    const spaceSelect = document.createElement('select');
    ['1', '2'].forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `Space ${s}`;
      spaceSelect.appendChild(opt);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'admin-booking-submit';
    submitBtn.textContent = 'Add booking';

    const formMsg = document.createElement('div');
    formMsg.className = 'admin-inline-msg';

    submitBtn.addEventListener('click', async () => {
      if (!nameSelect.value || !dateInput.value) {
        formMsg.textContent = 'Select an employee and date.';
        return;
      }
      submitBtn.disabled = true;
      formMsg.textContent = '';
      const booking = { date: dateInput.value, space: Number(spaceSelect.value), bookedBy: nameSelect.value };
      const result = await adminBookSpace(_adminPassword, booking);
      if (result.error === 'unauthorized') {
        _adminPassword = null;
        container.innerHTML = '<p style="color:#dc2626;font-size:0.85rem;">Session expired. Please reload.</p>';
        return;
      }
      // Refresh tab
      _renderBookingsTab(container);
    });

    nameLabel.appendChild(nameSelect);
    dateLabel.appendChild(dateInput);
    spaceLabel.appendChild(spaceSelect);
    form.appendChild(nameLabel);
    form.appendChild(dateLabel);
    form.appendChild(spaceLabel);
    form.appendChild(submitBtn);
    form.appendChild(formMsg);
    container.appendChild(form);

    // Bookings grid (reuse existing _renderGrid logic but with admin cancel on every cell)
    const gridEl = document.createElement('div');
    gridEl.id = 'admin-week-grid';
    container.appendChild(gridEl);
    _renderAdminGrid(gridEl, days, bookings, container);
  }

  function _renderAdminGrid(gridEl, days, bookings, container) {
    gridEl.innerHTML = '';

    // Space header
    const header = document.createElement('div');
    header.className = 'week-grid-row space-header';
    header.innerHTML = `
      <div></div>
      <div class="space-header-label">Space 1</div>
      <div class="space-header-label">Space 2</div>
    `;
    gridEl.appendChild(header);

    let lastWeekMonday = null;
    for (const day of days) {
      const monday = new Date(day);
      monday.setDate(monday.getDate() - (monday.getDay() - 1));
      monday.setHours(0, 0, 0, 0);
      if (!lastWeekMonday || monday.getTime() !== lastWeekMonday.getTime()) {
        lastWeekMonday = monday;
        const weekLabel = document.createElement('div');
        weekLabel.className = 'week-label';
        const friday = new Date(monday);
        friday.setDate(friday.getDate() + 4);
        weekLabel.textContent = `${formatDay(monday)} – ${formatDay(friday)}`;
        gridEl.appendChild(weekLabel);
      }

      const dateStr = toISODate(day);
      const past = isPast(day);
      const row = document.createElement('div');
      row.className = 'week-grid-row day-row';

      const dayLabel = document.createElement('div');
      dayLabel.className = 'day-label';
      const abbr = document.createElement('span');
      abbr.className = 'day-abbr';
      abbr.textContent = day.toLocaleDateString('en-GB', { weekday: 'short' });
      const num = document.createElement('span');
      num.className = 'day-num';
      num.textContent = day.toLocaleDateString('en-GB', { day: 'numeric' });
      dayLabel.appendChild(abbr);
      dayLabel.appendChild(num);
      row.appendChild(dayLabel);

      for (const space of [1, 2]) {
        const booking = bookings.find((b) => b.date === dateStr && b.space === space) ?? null;
        const cell = document.createElement('div');
        cell.className = 'cell';

        if (past || !booking) {
          // Same as normal grid — past or free
          cell.classList.add(past ? 'cell-past' : 'cell-free');
          const stateEl = document.createElement('span');
          stateEl.className = 'cell-state';
          stateEl.textContent = past ? '—' : 'Free ✚';
          const subEl = document.createElement('span');
          subEl.className = 'cell-sub';
          subEl.textContent = past ? 'Past' : 'Tap to book';
          cell.appendChild(stateEl);
          cell.appendChild(subEl);
        } else {
          // Booked — show name + admin cancel button
          cell.classList.add('cell-taken');
          const stateEl = document.createElement('span');
          stateEl.className = 'cell-state';
          stateEl.textContent = booking.bookedBy;
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'cell-admin-cancel';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', async () => {
            cancelBtn.disabled = true;
            const result = await adminCancelBooking(_adminPassword, booking.id);
            if (result.error === 'unauthorized') {
              _adminPassword = null;
              container.innerHTML = '<p style="color:#dc2626;font-size:0.85rem;">Session expired. Please reload.</p>';
              return;
            }
            _renderBookingsTab(container);
          });
          cell.appendChild(stateEl);
          cell.appendChild(cancelBtn);
        }

        row.appendChild(cell);
      }
      gridEl.appendChild(row);
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add ui.js
  git commit -m "feat: add admin bookings tab to ui.js"
  ```

---

## Task 15: Wire up app.js

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add admin lock icon to app.js**

  Replace the entire content of `app.js`:

  ```js
  import { applyTheme, buildToggle } from './theme.js';
  import { getName } from './identity.js';
  import { renderIdentityOverlay, render, buildAdminLockIcon } from './ui.js';

  // Apply theme immediately — before any UI renders — to avoid flash of wrong theme
  applyTheme();

  try {
    if (!getName()) {
      renderIdentityOverlay(() => render());
    } else {
      render();
    }
  } catch (err) {
    console.error('App failed to initialise:', err);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML =
        '<p style="color:#991b1b;padding:1rem;font-size:0.85rem;">Failed to load. Please refresh the page.</p>';
    }
  }

  // Inject theme toggle and admin lock icon into card header after DOM is ready
  const header = document.querySelector('.card-header');
  if (header) {
    header.appendChild(buildToggle());
    header.appendChild(buildAdminLockIcon());
  }
  ```

- [ ] **Step 2: Run full test suite**

  Run: `npm test`
  Expected: all tests PASS

- [ ] **Step 3: Commit**

  ```bash
  git add app.js
  git commit -m "feat: wire admin lock icon into card header"
  ```

---

## Task 16: Final verification

- [ ] **Step 1: Run full test suite one last time**

  Run: `npm test`
  Expected: all tests PASS, no skipped tests

- [ ] **Step 2: Verify Netlify Functions file list**

  Confirm these 7 files exist in `netlify/functions/`:
  - `_blob-helpers.js`
  - `get-employees.js`
  - `get-bookings.js`
  - `book-space.js`
  - `cancel-booking.js`
  - `admin-employees.js`
  - `admin-bookings.js`

- [ ] **Step 3: Confirm old PA env vars are documented for removal**

  In Netlify dashboard (after deploy), remove:
  `FLOW_GET_EMPLOYEES`, `FLOW_GET_BOOKINGS`, `FLOW_BOOK_SPACE`, `FLOW_CANCEL_BOOKING`

  Add: `ADMIN_PASSWORD`

- [ ] **Step 4: Final commit**

  ```bash
  git add -A
  git status  # confirm nothing unexpected is staged
  git commit -m "chore: final cleanup — Netlify Blobs migration complete"
  ```

---

## Deployment checklist (manual, post-merge)

1. Set `ADMIN_PASSWORD` env var in Netlify dashboard → Deploys → Environment variables
2. Remove `FLOW_GET_EMPLOYEES`, `FLOW_GET_BOOKINGS`, `FLOW_BOOK_SPACE`, `FLOW_CANCEL_BOOKING`
3. Deploy branch → confirm Netlify build passes
4. Open app → verify booking grid loads (blob initialises as empty array on first request)
5. Lock icon → enter admin password → verify employees tab shows empty list
6. Add a test employee → verify they appear in the main booking dropdown
7. Make a test booking → verify it appears in admin bookings tab with cancel button
8. Cancel it via admin → verify it disappears from both grids
