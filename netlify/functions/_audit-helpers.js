import { readBlobWithEtag, writeBlobConditional } from './_blob-helpers.js';

const MAX_RETRIES = 5;
const MAX_ENTRIES = 500;

export async function appendAuditLog(req, { action, space, date, bookedBy }) {
  const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  const entry = { ts: new Date().toISOString(), action, space, date, bookedBy, ip };

  let lastError = 'conflict';
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 150 * attempt));
    const { data: log, etag } = await readBlobWithEtag('audit-log');
    if (log === null) { lastError = 'storageError'; continue; }
    const updated = [...log, entry].slice(-MAX_ENTRIES);
    try {
      await writeBlobConditional('audit-log', updated, etag);
      return;
    } catch {
      // ETag mismatch — retry
    }
  }
  throw new Error(lastError);
}
