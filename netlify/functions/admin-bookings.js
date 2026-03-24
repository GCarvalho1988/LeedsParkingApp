import { readBlob, writeBlob } from './_blob-helpers.js';

export const handler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  // do NOT log body — contains password
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 200, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
  }

  if (body.action === 'add') {
    const id = crypto.randomUUID();
    bookings.push({ id, ...body.booking });
    await writeBlob('bookings', bookings);
    return { statusCode: 200, body: JSON.stringify({ id }) };
  }

  if (body.action === 'cancel') {
    await writeBlob('bookings', bookings.filter((b) => b.id !== body.booking.id));
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: 'unknownAction' }) };
};
