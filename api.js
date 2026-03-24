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
