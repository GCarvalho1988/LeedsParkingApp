import { readBlobWithEtag, writeBlobConditional } from './_blob-helpers.js';

const MAX_RETRIES = 5;

export default async (req) => {
  const body = await req.json();
  // do NOT log body — contains password
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 200 });
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: bookings, etag } = await readBlobWithEtag('bookings');
    if (bookings === null) {
      return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
    }

    let updated;
    let responseBody;

    if (body.action === 'add') {
      const { date, space, bookedBy } = body.booking ?? {};
      if (!date || !space || !bookedBy) {
        return new Response(JSON.stringify({ error: 'badRequest' }), { status: 400 });
      }
      const id = crypto.randomUUID();
      updated = [...bookings, { id, date, space, bookedBy }];
      responseBody = { id };
    } else if (body.action === 'cancel') {
      const cancelId = body.booking?.id;
      if (!cancelId) {
        return new Response(JSON.stringify({ error: 'badRequest' }), { status: 400 });
      }
      updated = bookings.filter((b) => b.id !== cancelId);
      responseBody = { success: true };
    } else {
      return new Response(JSON.stringify({ error: 'unknownAction' }), { status: 400 });
    }

    try {
      await writeBlobConditional('bookings', updated, etag);
      return new Response(JSON.stringify(responseBody), { status: 200 });
    } catch {
      // ETag mismatch — retry
    }
  }

  return new Response(JSON.stringify({ error: 'conflict' }), { status: 200 });
};
