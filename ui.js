import { bookableDays, isPast, toISODate, formatDay } from './dates.js';
import { getBookingsForWeek, bookSpace, cancelBooking, getEmployees } from './api.js';
import { getName, setName, clearName } from './identity.js';

let _headerEl = null;
let _errorEl = null;
let _gridEl = null;

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
  const days = bookableDays();
  const startDate = toISODate(days[0]);
  const endDate = toISODate(days[days.length - 1]);

  _gridEl.innerHTML = '<p style="text-align:center;color:var(--muted);padding:1.5rem 0;font-size:0.85rem;">Loading\u2026</p>';
  _clearError();

  try {
    const bookings = await getBookingsForWeek(startDate, endDate);
    _renderGrid(days, bookings);
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
      await _loadAndRenderAll();
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
    await _loadAndRenderAll();
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
