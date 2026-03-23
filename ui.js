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
