import { weekStart, weekDays, isPast, isCurrentWeek, isBeyondMaxWeek, toISODate, formatDay } from './dates.js';
import { getBookingsForWeek, bookSpace, cancelBooking } from './api.js';
import { getAccount } from './auth.js';

let currentMonday = weekStart(new Date());

// Module-level references to the dynamically created nav and error banner,
// so _renderNav can update them on re-render without re-creating them.
let _navEl = null;
let _errorEl = null;
let _gridEl = null;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Entry point called by app.js after auth is confirmed.
 * Builds the full inner DOM inside #app on first call;
 * subsequent calls (week navigation) update the nav and grid in place.
 */
export function render() {
  const app = document.getElementById('app');

  if (!_navEl) {
    // First render: build the skeleton
    _navEl = _buildNav();
    _errorEl = _buildErrorBanner();
    _gridEl = document.createElement('div');
    _gridEl.id = 'week-grid';
    app.appendChild(_navEl);
    app.appendChild(_errorEl);
    app.appendChild(_gridEl);
  }

  _updateNav();
  _loadAndRenderWeek();
}

// ─── Navigation ────────────────────────────────────────────────────────────

function _buildNav() {
  const nav = document.createElement('div');
  nav.className = 'week-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'week-nav-btn';
  prevBtn.setAttribute('aria-label', 'Previous week');
  prevBtn.innerHTML = '&#8249;';
  prevBtn.dataset.role = 'prev';

  const label = document.createElement('span');
  label.className = 'week-nav-label';
  label.dataset.role = 'label';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'week-nav-btn';
  nextBtn.setAttribute('aria-label', 'Next week');
  nextBtn.innerHTML = '&#8250;';
  nextBtn.dataset.role = 'next';

  prevBtn.addEventListener('click', () => {
    currentMonday = new Date(currentMonday);
    currentMonday.setDate(currentMonday.getDate() - 7);
    render();
  });

  nextBtn.addEventListener('click', () => {
    currentMonday = new Date(currentMonday);
    currentMonday.setDate(currentMonday.getDate() + 7);
    render();
  });

  nav.appendChild(prevBtn);
  nav.appendChild(label);
  nav.appendChild(nextBtn);
  return nav;
}

function _updateNav() {
  const days = weekDays(currentMonday);
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  _navEl.querySelector('[data-role="label"]').textContent =
    `${formatDay(days[0])} – ${formatDay(days[4])}`;
  _navEl.querySelector('[data-role="prev"]').disabled = isCurrentWeek(currentMonday);
  _navEl.querySelector('[data-role="next"]').disabled = isBeyondMaxWeek(nextMonday);
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

async function _loadAndRenderWeek() {
  const days = weekDays(currentMonday);
  const startDate = toISODate(days[0]);
  const endDate = toISODate(days[4]);

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
  const account = getAccount();
  const userEmail = account.username.toLowerCase();
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

  // Day rows
  for (const day of days) {
    const dateStr = toISODate(day);
    const past = isPast(day);

    const row = document.createElement('div');
    row.className = 'week-grid-row day-row';

    // Day label
    const dayLabel = document.createElement('div');
    dayLabel.className = 'day-label';
    const abbr = document.createElement('span');
    abbr.className = 'day-abbr';
    // formatDay returns e.g. "Mon 23 Mar" — split to get abbr and number
    const [dayAbbr, dayNum] = formatDay(day).split(' ');
    abbr.textContent = dayAbbr;
    const num = document.createElement('span');
    num.className = 'day-num';
    num.textContent = dayNum;
    dayLabel.appendChild(abbr);
    dayLabel.appendChild(num);
    row.appendChild(dayLabel);

    for (const space of [1, 2]) {
      const booking = bookings.find(
        (b) => b.date === dateStr && b.space === space
      ) ?? null;
      row.appendChild(_buildCell(dateStr, space, booking, userEmail, past));
    }

    _gridEl.appendChild(row);
  }

  // Legend
  _gridEl.appendChild(_buildLegend());
}

function _buildCell(date, space, booking, userEmail, past) {
  const cell = document.createElement('div');
  cell.className = 'cell';

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

  if (booking.bookedByEmail.toLowerCase() === userEmail) {
    cell.classList.add('cell-mine');
    stateEl.textContent = 'You \u2715';
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
  const account = getAccount();
  cell.classList.add('loading');
  _clearError();

  try {
    const result = await bookSpace(date, space, account.name, account.username);
    if (result.error === 'alreadyBooked') {
      _showCellMessage(cell, 'You already have a space booked this day');
      cell.classList.remove('loading');
    } else if (result.error === 'taken') {
      _showCellMessage(cell, `Just taken by ${result.bookedBy} \u2014 try the other space`);
      cell.classList.remove('loading');
    } else {
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

// ─── Inline cell message (race condition warnings) ─────────────────────────

function _showCellMessage(cell, message) {
  // Replace the cell-sub line with the message text
  const sub = cell.querySelector('.cell-sub');
  if (sub) {
    sub.className = 'cell-msg';
    sub.textContent = message;
  }
}
