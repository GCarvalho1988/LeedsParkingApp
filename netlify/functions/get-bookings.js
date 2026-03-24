import { readBlob } from './_blob-helpers.js';

export const handler = async (event) => {
  const { start, end } = JSON.parse(event.body || '{}');
  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
  }
  const filtered = bookings.filter((b) => b.date >= start && b.date <= end);
  return { statusCode: 200, body: JSON.stringify(filtered) };
};
