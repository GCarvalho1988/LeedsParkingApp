import { readBlobWithEtag, writeBlobConditional } from './_blob-helpers.js';
import { appendAuditLog } from './_audit-helpers.js';

const MAX_RETRIES = 5;

export default async (req) => {
  const { id, name } = await req.json();

  if (!id || !name) {
    return new Response(JSON.stringify({ error: 'badRequest' }), { status: 400 });
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 150 * attempt));
    const { data: bookings, etag } = await readBlobWithEtag('bookings');
    if (bookings === null) {
      return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
    }

    // Only cancel if the booking belongs to the requester
    const target = bookings.find((b) => b.id === id);
    if (!target) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    if (target.bookedBy !== name) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    }

    try {
      await writeBlobConditional('bookings', bookings.filter((b) => b.id !== id), etag);
      try {
        await appendAuditLog(req, { action: 'cancel', space: target.space, date: target.date, bookedBy: target.bookedBy });
      } catch (e) { console.error('[audit] cancel-booking append failed:', e); }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch {
      // ETag mismatch — concurrent write; retry
    }
  }

  return new Response(JSON.stringify({ error: 'conflict' }), { status: 200 });
};
