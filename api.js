import {
  FLOW_GET_EMPLOYEES,
  FLOW_GET_BOOKINGS,
  FLOW_BOOK_SPACE,
  FLOW_CANCEL_BOOKING,
} from './config.js';

/**
 * Internal helper: fetch a Power Automate flow URL.
 * Throws on non-OK HTTP responses.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>} Parsed JSON response body
 */
async function flowFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    throw new Error(`Flow error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Returns the list of employee display names from the Leeds Office Teams team.
 * @returns {Promise<string[]>}
 */
export async function getEmployees() {
  const data = await flowFetch(FLOW_GET_EMPLOYEES, { method: 'POST', body: JSON.stringify({}) });
  return data.map((e) => Object.values(e)[0]);
}

/**
 * Fetches all bookings for the week spanning startDate–endDate.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Array<{id: string, date: string, space: number, bookedBy: string}>>}
 */
export async function getBookingsForWeek(startDate, endDate) {
  return flowFetch(`${FLOW_GET_BOOKINGS}&start=${startDate}&end=${endDate}`);
}

/**
 * Attempts to book a parking space.
 * Duplicate checks are performed inside the Power Automate flow.
 * @param {string} date  - YYYY-MM-DD
 * @param {number} space - 1 or 2
 * @param {string} name  - Booker's display name
 * @returns {Promise<{success: true} | {error: 'alreadyBooked'} | {error: 'taken', bookedBy: string}>}
 */
export async function bookSpace(date, space, name) {
  return flowFetch(FLOW_BOOK_SPACE, {
    method: 'POST',
    body: JSON.stringify({ date, space, name }),
  });
}

/**
 * Deletes a booking by its SharePoint list item ID.
 * @param {string} id - SharePoint list item ID
 * @returns {Promise<{success: true}>}
 */
export async function cancelBooking(id) {
  return flowFetch(FLOW_CANCEL_BOOKING, {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}
