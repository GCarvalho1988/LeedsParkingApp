# LeedsParkingArea Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vanilla JS single-page app for booking two office parking spaces, authenticated via Microsoft Entra ID, backed by a SharePoint list, deployable to Azure Static Web Apps.

**Architecture:** Multi-file vanilla JS (no framework, no bundler). MSAL.js 2.x from CDN handles Graph token acquisition. Azure SWA platform auth enforces the Entra ID login wall before the page loads. All SharePoint data flows through a thin `api.js` module that wraps `fetch` calls to Microsoft Graph.

**Tech Stack:** HTML5, CSS3, vanilla ES modules, MSAL.js 2.x (CDN), Microsoft Graph API, Azure Static Web Apps, GitHub Actions.

---

## File Map

All files live at the root of the new `LeedsParkingArea` repo.

| File | Purpose |
|------|---------|
| `config.js` | Placeholder env constants (tenant ID, client ID, SharePoint details) |
| `dates.js` | Pure date utilities: week calculation, past-date check, formatting |
| `auth.js` | MSAL instance, `handleRedirectPromise`, `getAccount`, `getToken`, `login` |
| `api.js` | All Graph/SharePoint calls: `getBookingsForWeek`, `bookSpace`, `cancelBooking` |
| `ui.js` | All DOM rendering: week grid, day cards, book/cancel interactions, error display |
| `app.js` | Bootstrap: init MSAL → handle redirect → check account → render |
| `index.html` | App shell: loads MSAL from CDN, mounts `app.js` as ES module |
| `style.css` | Teams-friendly, mobile-first styles |
| `staticwebapp.config.json` | SWA: Entra ID auth, authenticated-only routes, SPA fallback |
| `.github/workflows/deploy.yml` | GitHub Actions: deploy to Azure SWA on push to `main` |
| `package.json` | Dev-only: Jest for unit testing `dates.js` and `api.js` |
| `jest.config.js` | Jest config for native ESM |
| `tests/dates.test.js` | Unit tests for `dates.js` |
| `tests/api.test.js` | Unit tests for `api.js` (fetch + auth mocked) |
| `.gitignore` | Excludes `node_modules/`, `.env` |

---

## Task 1: Initialise the repository

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `jest.config.js`

- [ ] **Step 1: Create the repo directory and initialise git**

Choose a location outside the Claude PlayArea repo (e.g. `~/repos/LeedsParkingArea`). Then:

```bash
mkdir LeedsParkingArea
cd LeedsParkingArea
git init
git checkout -b main
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.env
.superpowers/
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "leeds-parking-area",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 4: Create `jest.config.js`**

```js
export default {
  testEnvironment: 'node',
};
```

- [ ] **Step 5: Install dev dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json jest.config.js
git commit -m "chore: initialise repo with Jest test infrastructure"
```

---

## Task 2: `config.js` — environment constants

**Files:**
- Create: `config.js`

- [ ] **Step 1: Create `config.js`**

```js
// Replace ALL values here once Azure infrastructure is provisioned.
// See docs/superpowers/specs/2026-03-22-parking-app-design.md — Provisioning Prerequisites.

export const TENANT_ID = 'YOUR_TENANT_ID';
export const CLIENT_ID = 'YOUR_CLIENT_ID';

// SharePoint site — used to build the Graph API URL
// Format: 'yourtenant.sharepoint.com'
export const SHAREPOINT_HOSTNAME = 'YOUR_SHAREPOINT_HOSTNAME';

// Format: '/sites/yoursitename'
export const SHAREPOINT_SITE_PATH = 'YOUR_SHAREPOINT_SITE_PATH';

// SharePoint List GUID — find in List Settings > List information URL
export const LIST_ID = 'YOUR_LIST_ID';
```

- [ ] **Step 2: Commit**

```bash
git add config.js
git commit -m "chore: add config.js with placeholder env constants"
```

---

## Task 3: `dates.js` — pure date utilities (TDD)

**Files:**
- Create: `tests/dates.test.js`
- Create: `dates.js`

- [ ] **Step 1: Create the test directory and write failing tests**

```bash
mkdir tests
```

Create `tests/dates.test.js`:

```js
import {
  weekStart,
  weekDays,
  isPast,
  isCurrentWeek,
  isBeyondMaxWeek,
  toISODate,
  formatDay,
} from '../dates.js';

describe('weekStart', () => {
  test('returns the Monday of a Wednesday', () => {
    const wed = new Date('2026-03-25T12:00:00');
    expect(toISODate(weekStart(wed))).toBe('2026-03-23');
  });

  test('returns the same Monday when given a Monday', () => {
    const mon = new Date('2026-03-23T00:00:00');
    expect(toISODate(weekStart(mon))).toBe('2026-03-23');
  });

  test('returns the preceding Monday when given a Sunday', () => {
    const sun = new Date('2026-03-29T12:00:00');
    expect(toISODate(weekStart(sun))).toBe('2026-03-23');
  });
});

describe('weekDays', () => {
  test('returns 5 consecutive days starting from Monday', () => {
    const mon = new Date('2026-03-23');
    const days = weekDays(mon);
    expect(days).toHaveLength(5);
    expect(toISODate(days[0])).toBe('2026-03-23'); // Mon
    expect(toISODate(days[4])).toBe('2026-03-27'); // Fri
  });
});

describe('isPast', () => {
  test('returns true for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isPast(yesterday)).toBe(true);
  });

  test('returns false for today', () => {
    expect(isPast(new Date())).toBe(false);
  });

  test('returns false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isPast(tomorrow)).toBe(false);
  });
});

describe('isCurrentWeek', () => {
  test('returns true for the current week Monday', () => {
    const currentMonday = weekStart(new Date());
    expect(isCurrentWeek(currentMonday)).toBe(true);
  });

  test('returns false for next week Monday', () => {
    const nextMonday = weekStart(new Date());
    nextMonday.setDate(nextMonday.getDate() + 7);
    expect(isCurrentWeek(nextMonday)).toBe(false);
  });
});

describe('isBeyondMaxWeek', () => {
  test('returns false for the current week', () => {
    const currentMonday = weekStart(new Date());
    expect(isBeyondMaxWeek(currentMonday)).toBe(false);
  });

  test('returns false for 3 weeks ahead (the furthest allowed)', () => {
    const monday = weekStart(new Date());
    monday.setDate(monday.getDate() + 21);
    expect(isBeyondMaxWeek(monday)).toBe(false);
  });

  test('returns true for 4 weeks ahead', () => {
    const monday = weekStart(new Date());
    monday.setDate(monday.getDate() + 28);
    expect(isBeyondMaxWeek(monday)).toBe(true);
  });
});

describe('toISODate', () => {
  test('returns YYYY-MM-DD string', () => {
    expect(toISODate(new Date('2026-03-23T15:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDay', () => {
  test('returns a human-readable day string', () => {
    const result = formatDay(new Date('2026-03-23'));
    // Just verify it's a non-empty string — locale formatting varies
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- tests/dates.test.js
```

Expected: `Cannot find module '../dates.js'` — confirms tests are wired correctly.

- [ ] **Step 3: Implement `dates.js`**

```js
/**
 * Returns the Monday of the week containing the given date.
 * Treats Sunday as the end of the prior week (ISO week convention).
 */
export function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns an array of 5 Date objects (Mon–Fri) for the week
 * starting at the given Monday.
 */
export function weekDays(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Returns true if the date is strictly before today (yesterday or earlier).
 * Today itself returns false — today is bookable.
 */
export function isPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Returns true if the given Monday is the current week's Monday.
 */
export function isCurrentWeek(monday) {
  const currentMonday = weekStart(new Date());
  return monday.getTime() === currentMonday.getTime();
}

/**
 * Returns true if the given Monday is beyond the rolling 4-week window
 * (current week + 3 more weeks ahead).
 */
export function isBeyondMaxWeek(monday) {
  const currentMonday = weekStart(new Date());
  const maxMonday = new Date(currentMonday);
  maxMonday.setDate(maxMonday.getDate() + 21); // 3 more weeks = 21 days
  return monday > maxMonday;
}

/**
 * Returns a YYYY-MM-DD string in local time.
 * Used for date comparisons and Graph API filter values.
 */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a human-readable day string, e.g. "Mon 23 Mar".
 */
export function formatDay(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test -- tests/dates.test.js
```

Expected: all tests PASS, no failures.

- [ ] **Step 5: Commit**

```bash
git add dates.js tests/dates.test.js
git commit -m "feat: add dates.js with week calculation utilities"
```

---

## Task 4: `auth.js` — MSAL initialisation and token acquisition

**Files:**
- Create: `auth.js`

`auth.js` depends on the browser global `msal` (loaded from CDN in `index.html`) and cannot be meaningfully unit-tested without a full browser environment. It is tested manually in Task 13.

- [ ] **Step 1: Create `auth.js`**

```js
import { TENANT_ID, CLIENT_ID } from './config.js';

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

const GRAPH_SCOPES = ['Sites.ReadWrite.All'];

let msalInstance = null;

/**
 * Initialises the MSAL PublicClientApplication.
 * Must be called before any other auth function.
 * Depends on the global `msal` object loaded from the CDN script tag.
 */
export function initMsal() {
  // eslint-disable-next-line no-undef
  msalInstance = new msal.PublicClientApplication(msalConfig);
}

/**
 * Must be called on every page load, before checking for an active account.
 * Processes the auth response when the browser returns from an Entra ID redirect.
 * Returns null if no redirect response is present.
 */
export async function handleRedirect() {
  return msalInstance.handleRedirectPromise();
}

/**
 * Returns the first active MSAL account, or null if not signed in.
 */
export function getAccount() {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Acquires a Graph access token silently.
 * Falls back to a redirect if the silent call fails (e.g. token expired).
 * Returns the access token string, or undefined if a redirect was triggered.
 */
export async function getToken() {
  const account = getAccount();
  if (!account) throw new Error('No MSAL account found — call handleRedirect first.');

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: GRAPH_SCOPES,
      account,
    });
    return result.accessToken;
  } catch {
    // Silent acquisition failed — redirect to Entra ID to refresh
    await msalInstance.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
    // Page will redirect; execution stops here
  }
}

/**
 * Initiates an Entra ID login redirect.
 * Called when no active account is found on startup.
 */
export async function login() {
  await msalInstance.loginRedirect({ scopes: GRAPH_SCOPES });
}
```

- [ ] **Step 2: Commit**

```bash
git add auth.js
git commit -m "feat: add auth.js MSAL wrapper"
```

---

## Task 5: `api.js` — Microsoft Graph calls (TDD)

**Files:**
- Create: `tests/api.test.js`
- Create: `api.js`

- [ ] **Step 1: Write failing tests**

Create `tests/api.test.js`:

```js
// Mock auth.js and config.js before importing api.js.
// jest.unstable_mockModule must be called before the dynamic import.

const mockGetToken = jest.fn().mockResolvedValue('fake-token');

jest.unstable_mockModule('../auth.js', () => ({
  getToken: mockGetToken,
}));

jest.unstable_mockModule('../config.js', () => ({
  SHAREPOINT_HOSTNAME: 'tenant.sharepoint.com',
  SHAREPOINT_SITE_PATH: '/sites/testsite',
  LIST_ID: 'aaaabbbb-1234-5678-abcd-000000000000',
}));

// Dynamic import after mocks are registered
const { getBookingsForWeek, bookSpace, cancelBooking } = await import('../api.js');

// Mock the global fetch
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper: builds a minimal mock fetch response
function mockFetchResponse(body, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => body,
  });
}

// ─── getBookingsForWeek ────────────────────────────────────────────────────

describe('getBookingsForWeek', () => {
  test('returns mapped booking objects for the week', async () => {
    fetch.mockReturnValueOnce(
      mockFetchResponse({
        value: [
          {
            id: 'item-1',
            fields: {
              Date: '2026-03-23T00:00:00Z',
              Space: 1,
              BookedBy: 'Alice Smith',
              BookedByEmail: 'alice@example.com',
            },
          },
        ],
      })
    );

    const result = await getBookingsForWeek('2026-03-23', '2026-03-27');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'item-1',
      date: '2026-03-23',
      space: 1,
      bookedBy: 'Alice Smith',
      bookedByEmail: 'alice@example.com',
    });
  });

  test('includes Authorization header with token', async () => {
    fetch.mockReturnValueOnce(mockFetchResponse({ value: [] }));

    await getBookingsForWeek('2026-03-23', '2026-03-27');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer fake-token');
  });

  test('throws on non-OK Graph response', async () => {
    fetch.mockReturnValueOnce(mockFetchResponse({}, false));

    await expect(getBookingsForWeek('2026-03-23', '2026-03-27')).rejects.toThrow('Graph API error');
  });
});

// ─── bookSpace ─────────────────────────────────────────────────────────────

describe('bookSpace', () => {
  test('returns { error: alreadyBooked } when user already has a booking that day', async () => {
    // Step 1 check returns an existing booking for this user
    fetch.mockReturnValueOnce(
      mockFetchResponse({ value: [{ id: 'existing', fields: {} }] })
    );

    const result = await bookSpace('2026-03-23', 1, 'Alice Smith', 'alice@example.com');

    expect(result).toEqual({ error: 'alreadyBooked' });
    // Must stop after the first check — no second fetch call
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('returns { error: taken, bookedBy } when space is booked by someone else', async () => {
    fetch
      .mockReturnValueOnce(mockFetchResponse({ value: [] })) // Step 1: user has no booking
      .mockReturnValueOnce(
        mockFetchResponse({ value: [{ id: 'space-taken', fields: { BookedBy: 'Bob Jones' } }] })
      ); // Step 2: space is taken

    const result = await bookSpace('2026-03-23', 1, 'Alice Smith', 'alice@example.com');

    expect(result).toEqual({ error: 'taken', bookedBy: 'Bob Jones' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('POSTs new booking and returns { success: true } when both checks pass', async () => {
    fetch
      .mockReturnValueOnce(mockFetchResponse({ value: [] })) // Step 1: user free
      .mockReturnValueOnce(mockFetchResponse({ value: [] })) // Step 2: space free
      .mockReturnValueOnce(mockFetchResponse({ id: 'new-item', fields: {} })); // Step 3: POST

    const result = await bookSpace('2026-03-23', 1, 'Alice Smith', 'alice@example.com');

    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledTimes(3);

    // Verify the POST body
    const [, postOptions] = fetch.mock.calls[2];
    expect(postOptions.method).toBe('POST');
    const body = JSON.parse(postOptions.body);
    expect(body.fields.Space).toBe(1);
    expect(body.fields.BookedByEmail).toBe('alice@example.com');
    expect(body.fields.Date).toBe('2026-03-23T00:00:00Z');
  });
});

// ─── cancelBooking ─────────────────────────────────────────────────────────

describe('cancelBooking', () => {
  test('sends a DELETE request to the correct item URL', async () => {
    fetch.mockReturnValueOnce(Promise.resolve({ ok: true }));

    await cancelBooking('item-abc');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
    expect(url).toContain('item-abc');
  });

  test('throws on non-OK Graph response', async () => {
    fetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 403, statusText: 'Forbidden' }));

    await expect(cancelBooking('item-abc')).rejects.toThrow('Graph API error');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- tests/api.test.js
```

Expected: `Cannot find module '../api.js'` — correct.

- [ ] **Step 3: Implement `api.js`**

```js
import { SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH, LIST_ID } from './config.js';
import { getToken } from './auth.js';

const LIST_BASE =
  `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}:/lists/${LIST_ID}`;

/**
 * Internal helper: performs an authenticated fetch against the Graph API.
 * Throws on non-OK responses.
 * Returns null for DELETE (no response body); parsed JSON otherwise.
 */
async function graphFetch(path, options = {}) {
  const token = await getToken();
  const url = `${LIST_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Graph API error: ${res.status} ${res.statusText}`);
  }
  return options.method === 'DELETE' ? null : res.json();
}

/**
 * Fetches all bookings for the week spanning startDate–endDate.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Array<{id, date, space, bookedBy, bookedByEmail}>>}
 */
export async function getBookingsForWeek(startDate, endDate) {
  const filter =
    `fields/Date ge '${startDate}T00:00:00Z' and fields/Date le '${endDate}T23:59:59Z'`;
  const data = await graphFetch(
    `/items?$filter=${encodeURIComponent(filter)}&$expand=fields&$top=50`
  );
  return data.value.map((item) => ({
    id: item.id,
    date: item.fields.Date.slice(0, 10),
    space: item.fields.Space,
    bookedBy: item.fields.BookedBy,
    bookedByEmail: item.fields.BookedByEmail,
  }));
}

/**
 * Attempts to book a parking space.
 * Runs two pre-flight checks before writing:
 *   1. User must not already have a booking that day.
 *   2. The requested space must be free.
 *
 * @param {string} date        - YYYY-MM-DD
 * @param {number} space       - 1 or 2
 * @param {string} displayName - User's display name
 * @param {string} email       - User's email
 * @returns {Promise<{success: true} | {error: 'alreadyBooked'} | {error: 'taken', bookedBy: string}>}
 */
export async function bookSpace(date, space, displayName, email) {
  // Step 1: check the user has no existing booking this day
  const userFilter =
    `fields/Date eq '${date}T00:00:00Z' and fields/BookedByEmail eq '${email}'`;
  const userCheck = await graphFetch(
    `/items?$filter=${encodeURIComponent(userFilter)}&$expand=fields&$top=1`
  );
  if (userCheck.value.length > 0) {
    return { error: 'alreadyBooked' };
  }

  // Step 2: check the requested space is still free
  const spaceFilter =
    `fields/Date eq '${date}T00:00:00Z' and fields/Space eq ${space}`;
  const spaceCheck = await graphFetch(
    `/items?$filter=${encodeURIComponent(spaceFilter)}&$expand=fields&$top=1`
  );
  if (spaceCheck.value.length > 0) {
    return { error: 'taken', bookedBy: spaceCheck.value[0].fields.BookedBy };
  }

  // Step 3: POST the new booking
  await graphFetch('/items', {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        Date: `${date}T00:00:00Z`,
        Space: space,
        BookedBy: displayName,
        BookedByEmail: email,
      },
    }),
  });
  return { success: true };
}

/**
 * Deletes a booking by its SharePoint list item ID.
 * Only call this for items the current user owns (enforced in ui.js).
 * @param {string} listItemId - SharePoint list item ID
 */
export async function cancelBooking(listItemId) {
  await graphFetch(`/items/${listItemId}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test -- tests/api.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests across `dates.test.js` and `api.test.js` PASS.

- [ ] **Step 6: Commit**

```bash
git add api.js tests/api.test.js
git commit -m "feat: add api.js with Graph/SharePoint CRUD and tests"
```

---

## Task 6: `ui.js` — week grid rendering

**Files:**
- Create: `ui.js`

`ui.js` manipulates the DOM and calls `api.js`. It is tested manually in Task 13.

- [ ] **Step 1: Create `ui.js`**

```js
import { weekStart, weekDays, isPast, isCurrentWeek, isBeyondMaxWeek, toISODate, formatDay } from './dates.js';
import { getBookingsForWeek, bookSpace, cancelBooking } from './api.js';
import { getAccount } from './auth.js';

let currentMonday = weekStart(new Date());

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Entry point called by app.js after auth is confirmed.
 * Renders the week navigation and loads the current week's bookings.
 */
export function render() {
  _renderNav();
  _loadAndRenderWeek();
}

// ─── Navigation ────────────────────────────────────────────────────────────

function _renderNav() {
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const weekLabel = document.getElementById('week-label');

  const days = weekDays(currentMonday);
  weekLabel.textContent = `${formatDay(days[0])} – ${formatDay(days[4])}`;

  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  prevBtn.disabled = isCurrentWeek(currentMonday);
  nextBtn.disabled = isBeyondMaxWeek(nextMonday);

  // Replace event listeners by cloning buttons (avoids stacking listeners on re-render)
  const newPrev = prevBtn.cloneNode(true);
  const newNext = nextBtn.cloneNode(true);
  prevBtn.replaceWith(newPrev);
  nextBtn.replaceWith(newNext);

  newPrev.disabled = isCurrentWeek(currentMonday);
  newNext.disabled = isBeyondMaxWeek(nextMonday);

  newPrev.addEventListener('click', () => {
    currentMonday = new Date(currentMonday);
    currentMonday.setDate(currentMonday.getDate() - 7);
    render();
  });

  newNext.addEventListener('click', () => {
    currentMonday = new Date(currentMonday);
    currentMonday.setDate(currentMonday.getDate() + 7);
    render();
  });
}

// ─── Grid loading ──────────────────────────────────────────────────────────

async function _loadAndRenderWeek() {
  const days = weekDays(currentMonday);
  const startDate = toISODate(days[0]);
  const endDate = toISODate(days[4]);
  const grid = document.getElementById('week-grid');

  grid.innerHTML = '<p class="loading">Loading…</p>';
  _clearError();

  try {
    const bookings = await getBookingsForWeek(startDate, endDate);
    _renderGrid(days, bookings);
  } catch {
    _showError('Could not load bookings. Check your connection and try again.');
    grid.innerHTML = '';
  }
}

// ─── Grid rendering ────────────────────────────────────────────────────────

function _renderGrid(days, bookings) {
  const account = getAccount();
  // MSAL stores the UPN (email) in account.username
  const userEmail = account.username.toLowerCase();
  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';

  for (const day of days) {
    const dateStr = toISODate(day);
    const past = isPast(day);
    const dayCard = document.createElement('div');
    dayCard.className = `day-card${past ? ' past' : ''}`;

    const dayLabel = document.createElement('div');
    dayLabel.className = 'day-label';
    dayLabel.textContent = formatDay(day);
    dayCard.appendChild(dayLabel);

    const spacesRow = document.createElement('div');
    spacesRow.className = 'spaces-row';

    for (const space of [1, 2]) {
      const booking = bookings.find(
        (b) => b.date === dateStr && b.space === space
      ) ?? null;
      spacesRow.appendChild(_buildSpaceCell(dateStr, space, booking, userEmail, past));
    }

    dayCard.appendChild(spacesRow);
    grid.appendChild(dayCard);
  }
}

function _buildSpaceCell(date, space, booking, userEmail, past) {
  const cell = document.createElement('div');
  cell.className = 'space-cell';

  const label = document.createElement('div');
  label.className = 'space-label';
  label.textContent = `Space ${space}`;
  cell.appendChild(label);

  const status = document.createElement('div');
  status.className = 'space-status';

  if (past) {
    cell.classList.add('past');
    status.textContent = booking ? booking.bookedBy : '—';
    cell.appendChild(status);
    return cell;
  }

  if (!booking) {
    cell.classList.add('free');
    status.textContent = 'Free';
    const btn = document.createElement('button');
    btn.className = 'btn-book';
    btn.textContent = '+ Book';
    btn.addEventListener('click', () => _handleBook(date, space, cell));
    cell.appendChild(status);
    cell.appendChild(btn);
    return cell;
  }

  if (booking.bookedByEmail.toLowerCase() === userEmail) {
    cell.classList.add('mine');
    status.textContent = 'You';
    const btn = document.createElement('button');
    btn.className = 'btn-cancel';
    btn.textContent = '✕ Cancel';
    btn.addEventListener('click', () => _handleCancel(booking.id, cell));
    cell.appendChild(status);
    cell.appendChild(btn);
    return cell;
  }

  cell.classList.add('taken');
  status.textContent = booking.bookedBy;
  cell.appendChild(status);
  return cell;
}

// ─── Interactions ──────────────────────────────────────────────────────────

async function _handleBook(date, space, cell) {
  const account = getAccount();
  cell.classList.add('loading');
  _clearError();

  try {
    const result = await bookSpace(date, space, account.name, account.username);
    if (result.error === 'alreadyBooked') {
      _showCellMessage(cell, 'You already have a space booked this day');
      cell.classList.remove('loading');
    } else if (result.error === 'taken') {
      _showCellMessage(cell, `Just taken by ${result.bookedBy} — try the other space`);
      cell.classList.remove('loading');
    } else {
      // Success — re-fetch and re-render the whole week
      await _loadAndRenderWeek();
    }
  } catch {
    _showError('Could not complete booking. Please try again.');
    cell.classList.remove('loading');
  }
}

async function _handleCancel(itemId, cell) {
  cell.classList.add('loading');
  _clearError();

  try {
    await cancelBooking(itemId);
    await _loadAndRenderWeek();
  } catch {
    _showError('Could not cancel booking. Please try again.');
    cell.classList.remove('loading');
  }
}

// ─── Error display ─────────────────────────────────────────────────────────

function _showError(message) {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.textContent = message;
    banner.hidden = false;
  }
}

function _clearError() {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.hidden = true;
    banner.textContent = '';
  }
}

function _showCellMessage(cell, message) {
  let msg = cell.querySelector('.cell-message');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'cell-message';
    cell.appendChild(msg);
  }
  msg.textContent = message;
}
```

- [ ] **Step 2: Commit**

```bash
git add ui.js
git commit -m "feat: add ui.js week grid rendering and booking interactions"
```

---

## Task 7: `app.js` — bootstrap

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create `app.js`**

```js
import { initMsal, handleRedirect, getAccount, login } from './auth.js';
import { render } from './ui.js';

async function bootstrap() {
  // Step 1: Initialise MSAL (must happen before any other MSAL call)
  initMsal();

  // Step 2: Always process any in-flight redirect response first.
  // This is mandatory for the redirect auth flow — if omitted, the app
  // will loop between login redirects and page loads.
  await handleRedirect();

  // Step 3: Check for an active signed-in account
  const account = getAccount();
  if (!account) {
    // No account found — trigger Entra ID login redirect.
    // The page will redirect; execution ends here.
    await login();
    return;
  }

  // Step 4: User is signed in — render the app
  render();
}

bootstrap().catch((err) => {
  console.error('App failed to initialise:', err);
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.textContent = 'Authentication error. Please refresh the page.';
    banner.hidden = false;
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add app.js
git commit -m "feat: add app.js bootstrap sequence"
```

---

## Task 8: `index.html` — app shell

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Parking Booking</title>
  <link rel="stylesheet" href="style.css" />
  <!--
    MSAL.js 2.x UMD bundle — exposes the global `msal` object used by auth.js.
    Pin to a specific version. Check https://github.com/AzureAD/microsoft-authentication-library-for-js
    for the latest 2.x release if updating.
  -->
  <script src="https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js"></script>
</head>
<body>
  <div id="app">
    <header>
      <h1>Parking Booking</h1>
    </header>

    <div id="error-banner" role="alert" hidden></div>

    <nav id="week-nav" aria-label="Week navigation">
      <button id="btn-prev" aria-label="Previous week">&#8249; Prev</button>
      <span id="week-label"></span>
      <button id="btn-next" aria-label="Next week">Next &#8250;</button>
    </nav>

    <main id="week-grid" aria-live="polite"></main>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add index.html app shell"
```

---

## Task 9: `style.css` — Teams-friendly styling

**Files:**
- Create: `style.css`

- [ ] **Step 1: Create `style.css`**

```css
/* ── Reset ─────────────────────────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ── Base ───────────────────────────────────────────────────────────────── */
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #ffffff;
  color: #242424;
  font-size: 14px;
  line-height: 1.5;
}

#app {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #242424;
  margin-bottom: 12px;
}

/* ── Error banner ───────────────────────────────────────────────────────── */
#error-banner {
  background: #fde7e9;
  border-left: 4px solid #d13438;
  color: #a4262c;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
}

/* ── Week navigation ────────────────────────────────────────────────────── */
#week-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

#week-nav button {
  padding: 6px 14px;
  border: 1px solid #d1d1d1;
  border-radius: 4px;
  background: #ffffff;
  color: #242424;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  flex-shrink: 0;
}

#week-nav button:hover:not(:disabled) {
  background: #f5f5f5;
}

#week-nav button:disabled {
  opacity: 0.4;
  cursor: default;
}

#week-label {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
}

/* ── Day card ───────────────────────────────────────────────────────────── */
.day-card {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}

.day-card.past {
  opacity: 0.55;
}

.day-label {
  background: #f5f5f5;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 13px;
  color: #616161;
  border-bottom: 1px solid #e0e0e0;
}

/* ── Space cells ────────────────────────────────────────────────────────── */
.spaces-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.space-cell {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-right: 1px solid #e0e0e0;
  min-height: 76px;
}

.space-cell:last-child {
  border-right: none;
}

.space-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888888;
}

.space-status {
  font-size: 13px;
  font-weight: 500;
}

/* ── Cell states ────────────────────────────────────────────────────────── */
.space-cell.free {
  background: #fffbe6;
}
.space-cell.free .space-status {
  color: #7a5c00;
}

.space-cell.mine {
  background: #e6f4ea;
}
.space-cell.mine .space-status {
  color: #1b5e20;
}

.space-cell.taken {
  background: #fde7e9;
}
.space-cell.taken .space-status {
  color: #a4262c;
}

.space-cell.past {
  background: #fafafa;
}
.space-cell.past .space-status {
  color: #aaaaaa;
}

.space-cell.loading {
  opacity: 0.6;
  pointer-events: none;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */
.btn-book,
.btn-cancel {
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  width: fit-content;
}

.btn-book {
  background: #0078d4;
  color: #ffffff;
}

.btn-book:hover {
  background: #106ebe;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #c50f1f;
  color: #c50f1f;
}

.btn-cancel:hover {
  background: #fde7e9;
}

/* ── Inline cell message (e.g. race condition warning) ──────────────────── */
.cell-message {
  font-size: 11px;
  color: #a4262c;
  line-height: 1.3;
}

/* ── Loading state ──────────────────────────────────────────────────────── */
.loading {
  color: #888888;
  padding: 24px;
  text-align: center;
}

/* ── Mobile: stack spaces vertically on narrow screens ─────────────────── */
@media (max-width: 380px) {
  .spaces-row {
    grid-template-columns: 1fr;
  }

  .space-cell {
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .space-cell:last-child {
    border-bottom: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add style.css Teams-friendly mobile-first styles"
```

---

## Task 10: `staticwebapp.config.json` — SWA auth and routing

**Files:**
- Create: `staticwebapp.config.json`

- [ ] **Step 1: Create `staticwebapp.config.json`**

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0",
          "clientIdSettingName": "AAD_CLIENT_ID",
          "clientSecretSettingName": "AAD_CLIENT_SECRET"
        }
      }
    }
  },
  "routes": [
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad",
      "statusCode": 302
    }
  },
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/*.js", "/*.css"]
  },
  "globalHeaders": {
    "Cache-Control": "no-store"
  }
}
```

**Notes for provisioning:**
- Replace `YOUR_TENANT_ID` in `openIdIssuer` with the real tenant ID.
- `AAD_CLIENT_ID` and `AAD_CLIENT_SECRET` are **app setting names** (environment variables), not the values themselves. Set the actual values in the Azure Portal under the SWA resource → Configuration → Application settings.
- The SWA redirect URI to register in the App Registration is: `https://<your-swa-hostname>/.auth/login/aad/callback`

- [ ] **Step 2: Commit**

```bash
git add staticwebapp.config.json
git commit -m "feat: add staticwebapp.config.json with Entra ID auth"
```

---

## Task 11: `deploy.yml` — GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow directory and file**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure Static Web Apps

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: /
          output_location: /
          skip_app_build: true
```

**Note:** `skip_app_build: true` prevents SWA from trying to run a Node build. The app is pure static files with no build step.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy workflow for Azure SWA"
```

---

## Task 12: Run full test suite and verify

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected output:
```
PASS tests/dates.test.js
PASS tests/api.test.js

Test Suites: 2 passed, 2 total
Tests:       N passed, N total
```

If any tests fail, fix the issue before proceeding.

- [ ] **Step 2: Commit if any fixes were made**

```bash
# Only if there were changes
git add -p
git commit -m "fix: correct test failures found in full suite run"
```

---

## Task 13: Manual integration test checklist

Performed after Azure infrastructure is provisioned and config values are populated in `config.js` and the SWA app settings.

### Timezone note (BST)

`dates.js` derives date strings from local time, and `api.js` appends `T00:00:00Z` (UTC midnight). Both reads and writes use the same convention, so they are internally consistent. However, if SharePoint normalizes stored dates to UTC in a way that shifts them, bookings made during British Summer Time (late March–late October, UTC+1) could appear on the wrong day. Verify this during integration testing and raise with the team if day-boundary issues are observed.

### Pre-flight checks

- [ ] `config.js` — all placeholder values replaced with real Azure/SharePoint values
- [ ] `staticwebapp.config.json` — `YOUR_TENANT_ID` replaced in `openIdIssuer`
- [ ] SWA app settings: `AAD_CLIENT_ID` and `AAD_CLIENT_SECRET` configured in Azure Portal
- [ ] App Registration in Azure: redirect URI `https://<swa-hostname>/.auth/login/aad/callback` registered
- [ ] App Registration: `Sites.ReadWrite.All` delegated permission granted with admin consent
- [ ] SharePoint List: created with correct schema (`Date` as Date, `Space` as **Number**, `BookedBy` as Text, `BookedByEmail` as Text)
- [ ] SharePoint List: internal column names verified and matching the OData filters in `api.js`

### Auth tests (browser)

- [ ] Navigating to the SWA URL unauthenticated redirects to Microsoft login
- [ ] After login, the app loads and shows the current week
- [ ] No MSAL login popup appears (SWA handles the login wall before the page loads)

### Booking tests

- [ ] Free space shows amber "Free" state with "+ Book" button
- [ ] Clicking "+ Book" books the space and re-renders (no confirmation dialog)
- [ ] Own booking shows green "You" state with "✕ Cancel" button
- [ ] Clicking "✕ Cancel" removes the booking and re-renders
- [ ] Another user's booking shows red with their name and no action button

### Navigation tests

- [ ] "Prev" button is disabled on the current week
- [ ] "Next" button navigates forward; disabled when at current week + 3 weeks
- [ ] Past days (yesterday and earlier) are greyed out and non-interactive
- [ ] Today's free spaces are bookable

### Constraint tests

- [ ] Booking a space where the user already has one that day shows "You already have a space booked this day"
- [ ] Booking a space that was taken by someone else between render and click shows "Just taken by [name]"

### Teams tab tests

- [ ] App loads correctly when embedded as a Teams personal tab
- [ ] No login popup is triggered inside the Teams iframe
- [ ] Mobile layout (phones): spaces stack vertically, all tap targets are usable

---

## Summary

| Task | What it produces |
|------|-----------------|
| 1 | Repo scaffold with Jest |
| 2 | `config.js` with placeholders |
| 3 | `dates.js` + unit tests |
| 4 | `auth.js` MSAL wrapper |
| 5 | `api.js` + unit tests |
| 6 | `ui.js` DOM rendering and interactions |
| 7 | `app.js` bootstrap |
| 8 | `index.html` shell |
| 9 | `style.css` Teams styles |
| 10 | `staticwebapp.config.json` |
| 11 | `deploy.yml` |
| 12 | Full test run |
| 13 | Manual integration testing |
