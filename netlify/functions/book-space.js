import { readBlob, writeBlob } from './_blob-helpers.js';

export default async (req) => {
  const { date, space, name } = await req.json();
  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }

  // One booking per user per day
  if (bookings.some((b) => b.date === date && b.bookedBy === name)) {
    return new Response(JSON.stringify({ error: 'alreadyBooked' }), { status: 200 });
  }

  // Space already taken
  const conflict = bookings.find((b) => b.date === date && b.space === space);
  if (conflict) {
    return new Response(JSON.stringify({ error: 'taken', bookedBy: conflict.bookedBy }), { status: 200 });
  }

  const id = crypto.randomUUID();
  bookings.push({ id, date, space, bookedBy: name });
  await writeBlob('bookings', bookings);
  return new Response(JSON.stringify({ id }), { status: 200 });
};
