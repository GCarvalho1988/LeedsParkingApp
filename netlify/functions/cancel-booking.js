import { readBlob, writeBlob } from './_blob-helpers.js';

export default async (req) => {
  const { id } = await req.json();
  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }
  await writeBlob('bookings', bookings.filter((b) => b.id !== id));
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
