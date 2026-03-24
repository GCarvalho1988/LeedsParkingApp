import { readBlob, writeBlob } from './_blob-helpers.js';

export const handler = async (event) => {
  const { date, space, name } = JSON.parse(event.body || '{}');
  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
  }

  // One booking per user per day
  if (bookings.some((b) => b.date === date && b.bookedBy === name)) {
    return { statusCode: 200, body: JSON.stringify({ error: 'alreadyBooked' }) };
  }

  // Space already taken
  const conflict = bookings.find((b) => b.date === date && b.space === space);
  if (conflict) {
    return { statusCode: 200, body: JSON.stringify({ error: 'taken', bookedBy: conflict.bookedBy }) };
  }

  const id = crypto.randomUUID();
  bookings.push({ id, date, space, bookedBy: name });
  await writeBlob('bookings', bookings);
  return { statusCode: 200, body: JSON.stringify({ id }) };
};
