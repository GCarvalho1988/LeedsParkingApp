import { bookableDays, isPast, toISODate, formatDay } from './dates.js';
import { getBookingsForWeek, bookSpace, cancelBooking, getEmployees } from './api.js';
import { getName, setName, clearName } from './identity.js';
import {
  adminAddEmployee, adminRemoveEmployee,
  adminBookSpace, adminCancelBooking,
} from './api.js';

let _headerEl = null;
let _errorEl = null;
let _gridEl = null;
let _days = null;
let _bookings = null;
let _adminPassword = null; // held in memory only — never persisted

// ─── Identity overlay ───────────────────────────────────────────────────────

/**
 * Renders the name-picker overlay inside #app.
 * Calls onComplete() after the user successfully sets their name.
 * @param {() => void} onComplete
 */
export async function renderIdentityOverlay(onComplete) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const overlay = document.createElement('div');
  overlay.className = 'identity-overlay';

  const heading = document.createElement('p');
  heading.className = 'identity-heading';
  heading.textContent = 'Who are you?';
  overlay.appendChild(heading);

  // Load employees — show error + retry if the flow is unreachable
  let employees = [];
  try {
    employees = await getEmployees();
  } catch {
    const errMsg = document.createElement('p');
    errMsg.className = 'identity-error';
    errMsg.textContent = 'Could not load employee list. Check your connection.';
    const retryBtn = document.createElement('button');
    retryBtn.className = 'week-nav-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => renderIdentityOverlay(onComplete));
    overlay.appendChild(errMsg);
    overlay.appendChild(retryBtn);
    app.appendChild(overlay);
    return;
  }

  // Dropdown
  const select = document.createElement('select');
  select.className = 'identity-select';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Select your name —';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);
  employees.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  const otherOpt = document.createElement('option');
  otherOpt.value = '__other__';
  otherOpt.textContent = 'Other…';
  select.appendChild(otherOpt);
  overlay.appendChild(select);

  // Text input for "Other…" (hidden until selected)
  const otherInput = document.createElement('input');
  otherInput.type = 'text';
  otherInput.className = 'identity-input';
  otherInput.placeholder = 'Enter your name';
  otherInput.hidden = true;
  overlay.appendChild(otherInput);

  // Submit button — disabled until a non-empty name is resolved
  const submitBtn = document.createElement('button');
  submitBtn.className = 'identity-submit';
  submitBtn.textContent = "Let's go";
  submitBtn.disabled = true;
  overlay.appendChild(submitBtn);

  function getResolvedName() {
    if (select.value === '__other__') return otherInput.value.trim();
    return select.value;
  }

  function updateSubmitState() {
    submitBtn.disabled = !getResolvedName();
  }

  select.addEventListener('change', () => {
    otherInput.hidden = select.value !== '__other__';
    updateSubmitState();
  });
  otherInput.addEventListener('input', updateSubmitState);

  submitBtn.addEventListener('click', () => {
    const name = getResolvedName();
    if (!name) return;
    setName(name);
    onComplete();
  });

  app.appendChild(overlay);
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Entry point called by app.js after auth is confirmed.
 * Builds the full inner DOM inside #app on first call;
 * subsequent calls (week navigation) update the nav and grid in place.
 */
export function render() {
  const app = document.getElementById('app');

  if (!_headerEl) {
    _headerEl = _buildHeader();
    _errorEl = _buildErrorBanner();
    _gridEl = document.createElement('div');
    _gridEl.id = 'week-grid';
    app.appendChild(_headerEl);
    app.appendChild(_errorEl);
    app.appendChild(_gridEl);
  }

  _updateHeader();
  _loadAndRenderAll();
}

// ─── Header ─────────────────────────────────────────────────────────────────

function _buildHeader() {
  const header = document.createElement('div');
  header.className = 'week-nav';

  const notYouBtn = document.createElement('button');
  notYouBtn.className = 'not-you-link';
  notYouBtn.dataset.role = 'not-you';
  notYouBtn.addEventListener('click', () => {
    clearName();
    _headerEl = null;
    _errorEl = null;
    _gridEl = null;
    renderIdentityOverlay(() => render());
  });

  header.appendChild(notYouBtn);
  return header;
}

function _updateHeader() {
  _headerEl.querySelector('[data-role="not-you"]').textContent = `Not you? ${getName()}`;
}

// ─── Error banner ───────────────────────────────────────────────────────────

function _buildErrorBanner() {
  const el = document.createElement('div');
  el.className = 'error-banner';
  el.setAttribute('role', 'alert');
  el.hidden = true;
  return el;
}

function _showError(message) {
  _errorEl.textContent = message;
  _errorEl.hidden = false;
}

function _clearError() {
  _errorEl.hidden = true;
  _errorEl.textContent = '';
}

// ─── Grid loading ──────────────────────────────────────────────────────────

async function _loadAndRenderAll() {
  _days = bookableDays();
  const startDate = toISODate(_days[0]);
  const endDate = toISODate(_days[_days.length - 1]);

  _gridEl.innerHTML = '<p style="text-align:center;color:var(--muted);padding:1.5rem 0;font-size:0.85rem;">Loading\u2026</p>';
  _clearError();

  try {
    _bookings = await getBookingsForWeek(startDate, endDate);
    _renderGrid(_days, _bookings);
  } catch {
    _showError('Could not load bookings. Check your connection and try again.');
    _gridEl.innerHTML = '';
  }
}

// ─── Grid rendering ────────────────────────────────────────────────────────

function _renderGrid(days, bookings) {
  const currentName = getName();
  _gridEl.innerHTML = '';

  // Space header row
  const header = document.createElement('div');
  header.className = 'week-grid-row space-header';
  header.innerHTML = `
    <div></div>
    <div class="space-header-label">Space 1</div>
    <div class="space-header-label">Space 2</div>
  `;
  _gridEl.appendChild(header);

  // Day rows — insert a week label whenever the week changes
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
      _gridEl.appendChild(weekLabel);
    }
    const dateStr = toISODate(day);
    const past = isPast(day);

    const row = document.createElement('div');
    row.className = 'week-grid-row day-row';

    // Day label
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
      const booking = bookings.find(
        (b) => b.date === dateStr && b.space === space
      ) ?? null;
      row.appendChild(_buildCell(dateStr, space, booking, currentName, past));
    }

    _gridEl.appendChild(row);
  }

  // Legend
  _gridEl.appendChild(_buildLegend());
}

function _buildCell(date, space, booking, currentName, past) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.setAttribute('aria-label', `Space ${space}`);

  const stateEl = document.createElement('span');
  stateEl.className = 'cell-state';

  const subEl = document.createElement('span');
  subEl.className = 'cell-sub';

  if (past) {
    cell.classList.add('cell-past');
    stateEl.textContent = '\u2014';
    subEl.textContent = 'Past';
    cell.appendChild(stateEl);
    cell.appendChild(subEl);
    return cell;
  }

  if (!booking) {
    cell.classList.add('cell-free');
    stateEl.textContent = 'Free \u271a';
    subEl.textContent = 'Tap to book';
    cell.appendChild(stateEl);
    cell.appendChild(subEl);
    cell.addEventListener('click', () => _handleBook(date, space, cell));
    return cell;
  }

  if (booking.bookedBy === currentName) {
    cell.classList.add('cell-mine');
    stateEl.textContent = `${currentName} \u2715`;
    subEl.textContent = 'Tap to cancel';
    cell.appendChild(stateEl);
    cell.appendChild(subEl);
    cell.addEventListener('click', () => _handleCancel(booking.id, cell));
    return cell;
  }

  cell.classList.add('cell-taken');
  stateEl.textContent = booking.bookedBy;
  subEl.textContent = 'Unavailable';
  cell.appendChild(stateEl);
  cell.appendChild(subEl);
  return cell;
}

function _buildLegend() {
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `
    <div class="legend-item">
      <div class="legend-dot" style="background:#fff8ec;border-color:#f9c97c;"></div>
      Free
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:#f0fdf4;border-color:#86efac;"></div>
      Your booking
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:#fef2f2;border-color:#fca5a5;"></div>
      Taken
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:#f3f4f6;border-color:#e5e7eb;"></div>
      Past
    </div>
  `;
  return legend;
}

// ─── Interactions ──────────────────────────────────────────────────────────

async function _handleBook(date, space, cell) {
  cell.classList.add('loading');
  _clearError();

  try {
    const result = await bookSpace(date, space, getName());
    if (result.error === 'alreadyBooked') {
      _showCellMessage(cell, 'You already have a space booked this day');
      cell.classList.remove('loading');
    } else if (result.error === 'taken') {
      _showCellMessage(cell, `Just taken by ${result.bookedBy} \u2014 try the other space`);
      cell.classList.remove('loading');
    } else {
      _bookings.push({ id: result.id, date, space, bookedBy: getName() });
      _renderGrid(_days, _bookings);
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
    _bookings = _bookings.filter((b) => b.id !== itemId);
    _renderGrid(_days, _bookings);
  } catch {
    _showError('Could not cancel booking. Please try again.');
    cell.classList.remove('loading');
  }
}

// ─── Inline cell message (race condition warnings) ─────────────────────────

function _showCellMessage(cell, message) {
  const sub = cell.querySelector('.cell-sub');
  if (sub) {
    sub.className = 'cell-msg';
    sub.textContent = message;
  } else {
    _showError(message);
  }
}

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
        let result;
        try {
          result = await adminRemoveEmployee(_adminPassword, name);
        } catch {
          removeBtn.disabled = false;
          return;
        }
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
    let result;
    try {
      result = await adminAddEmployee(_adminPassword, name);
    } catch {
      addBtn.disabled = false;
      return;
    }
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
    let result;
    try {
      result = await adminBookSpace(_adminPassword, booking);
    } catch {
      submitBtn.disabled = false;
      return;
    }
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
          let result;
          try {
            result = await adminCancelBooking(_adminPassword, booking.id);
          } catch {
            cancelBtn.disabled = false;
            return;
          }
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
