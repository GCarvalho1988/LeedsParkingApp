// Maintains a session-level write cache in sessionStorage to compensate for
// Netlify Blobs eventual consistency. Cleared automatically when the tab closes.

const PENDING_KEY = 'parking_pending';
const CANCELLED_KEY = 'parking_cancelled';

function _read(key) {
  try { return JSON.parse(sessionStorage.getItem(key) ?? '[]'); } catch { return []; }
}

function _write(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore quota */ }
}

export function addPendingBooking(booking) {
  _write(PENDING_KEY, [..._read(PENDING_KEY), booking]);
}

export function addCancelledId(id) {
  _write(CANCELLED_KEY, [..._read(CANCELLED_KEY), id]);
}

// Merges blob bookings with session state.
// - Removes IDs we cancelled this session (blob may not have propagated the delete)
// - Adds bookings we made this session that haven't yet appeared in the blob
export function mergeWithSession(blobBookings) {
  const cancelledIds = new Set(_read(CANCELLED_KEY));
  const pending = _read(PENDING_KEY);

  const filtered = blobBookings.filter((b) => !cancelledIds.has(b.id));
  const blobIds = new Set(blobBookings.map((b) => b.id));
  const stillPending = pending.filter((b) => !blobIds.has(b.id));

  return [...filtered, ...stillPending];
}
