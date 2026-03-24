import { readBlob, writeBlob } from './_blob-helpers.js';

export default async (req) => {
  const body = await req.json();
  // do NOT log body — contains password
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 200 });
  }

  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }

  if (body.action === 'add') {
    const id = crypto.randomUUID();
    bookings.push({ id, ...body.booking });
    await writeBlob('bookings', bookings);
    return new Response(JSON.stringify({ id }), { status: 200 });
  }

  if (body.action === 'cancel') {
    await writeBlob('bookings', bookings.filter((b) => b.id !== body.booking.id));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: 'unknownAction' }), { status: 400 });
};
