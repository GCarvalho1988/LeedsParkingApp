import { readBlob, writeBlob } from './_blob-helpers.js';

export const handler = async (event) => {
  const { id } = JSON.parse(event.body || '{}');
  const bookings = await readBlob('bookings');
  if (bookings === null) {
    return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
  }
  await writeBlob('bookings', bookings.filter((b) => b.id !== id));
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
