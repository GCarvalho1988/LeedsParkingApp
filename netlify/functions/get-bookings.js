import { readBlob } from './_blob-helpers.js';

export default async (req) => {
  const { start, end } = await req.json();
  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }
  const filtered = bookings.filter((b) => b.date >= start && b.date <= end);
  return new Response(JSON.stringify(filtered), { status: 200 });
};
