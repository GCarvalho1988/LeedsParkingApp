import { readBlobWithEtag, writeBlobConditional } from './_blob-helpers.js';

const MAX_RETRIES = 5;

export default async (req) => {
  const { id } = await req.json();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: bookings, etag } = await readBlobWithEtag('bookings');
    if (bookings === null) {
      return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
    }

    try {
      await writeBlobConditional('bookings', bookings.filter((b) => b.id !== id), etag);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch {
      // ETag mismatch — concurrent write; retry
    }
  }

  return new Response(JSON.stringify({ error: 'conflict' }), { status: 200 });
};
