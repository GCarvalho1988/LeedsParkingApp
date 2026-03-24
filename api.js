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
  const data = await flowFetch('/api/get-employees');
  _employeeCache = [...data].sort((a, b) => a.localeCompare(b));
  return _employeeCache;
}

export async function getBookingsForWeek(startDate, endDate) {
  return flowFetch('/api/get-bookings', { start: startDate, end: endDate });
}

export async function bookSpace(date, space, name) {
  return flowFetch('/api/book-space', { date, space, name });
}

export async function cancelBooking(id, name) {
  return flowFetch('/api/cancel-booking', { id, name });
}

// Verifies the admin password without touching any blob.
// Uses action:'add' + empty name so the server hits the invalidName guard before any write.
export async function adminVerifyPassword(password) {
  return flowFetch('/api/admin-employees', { password, action: 'add', name: '' });
}

export async function adminAddEmployee(password, name, currentEmployees) {
  // Dedup client-side — avoids a server round-trip and the read-modify-write race
  if (currentEmployees.includes(name)) return { error: 'alreadyExists' };
  const employees = [...currentEmployees, name].sort((a, b) => a.localeCompare(b));
  const result = await flowFetch('/api/admin-employees', { password, action: 'set', employees });
  if (!result.error) clearEmployeeCache();
  return result;
}

export async function adminRemoveEmployee(password, name, currentEmployees) {
  const employees = currentEmployees.filter((e) => e !== name);
  const result = await flowFetch('/api/admin-employees', { password, action: 'set', employees });
  if (!result.error) clearEmployeeCache();
  return result;
}

export async function adminBookSpace(password, booking) {
  return flowFetch('/api/admin-bookings', { password, action: 'add', booking });
}

export async function adminCancelBooking(password, id) {
  return flowFetch('/api/admin-bookings', { password, action: 'cancel', booking: { id } });
}
