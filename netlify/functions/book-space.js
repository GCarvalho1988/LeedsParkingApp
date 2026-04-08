import { readBlobWithEtag, writeBlobConditional } from './_blob-helpers.js';
import { appendAuditLog } from './_audit-helpers.js';

const MAX_RETRIES = 5;

export default async (req) => {
  const { date, space, name } = await req.json();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Back off before retrying so stale replicas have time to propagate the previous write
    if (attempt > 0) await new Promise((r) => setTimeout(r, 150 * attempt));
    const { data: bookings, etag } = await readBlobWithEtag('bookings');
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
    try {
      await writeBlobConditional('bookings', [...bookings, { id, date, space, bookedBy: name }], etag);
      try {
        await appendAuditLog(req, { action: 'book', space, date, bookedBy: name });
      } catch { /* non-fatal */ }
      return new Response(JSON.stringify({ id }), { status: 200 });
    } catch {
      // ETag mismatch — a concurrent write landed between our read and write; retry
    }
  }

  return new Response(JSON.stringify({ error: 'conflict' }), { status: 200 });
};
