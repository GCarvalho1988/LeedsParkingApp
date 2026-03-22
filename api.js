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
 * @param {string} startDate - YYYY-MM-DD (local date)
 * @param {string} endDate   - YYYY-MM-DD (local date)
 * @returns {Promise<Array<{id, date, space, bookedBy, bookedByEmail}>>}
 *
 * Note: Graph returns dates as UTC ISO strings (e.g. "2026-03-23T00:00:00Z").
 * We slice the first 10 characters to extract the date portion directly,
 * rather than using toISODate() which uses local time. Both reads and writes
 * use the same YYYY-MM-DDT00:00:00Z convention so they are consistent.
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
 * @param {string} date        - YYYY-MM-DD (local date)
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
