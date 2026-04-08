import { getAuditStore } from './_blob-helpers.js';

export async function appendAuditLog(req, { action, space, date, bookedBy }) {
  const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  const entry = { ts: new Date().toISOString(), action, space, date, bookedBy, ip };
  const key = `audit-log/${entry.ts}-${crypto.randomUUID()}`;
  const store = getAuditStore();
  await store.set(key, JSON.stringify(entry));
}
