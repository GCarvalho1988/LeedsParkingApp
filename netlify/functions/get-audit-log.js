import { getAuditStore } from './_blob-helpers.js';

export default async (req) => {
  if (!process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'misconfigured' }), { status: 500 });
  }
  const body = await req.json();
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 200 });
  }
  try {
    const store = getAuditStore();
    const { blobs } = await store.list({ prefix: 'audit-log/' });
    // Keys start with ISO timestamp → lexicographic sort = chronological (oldest first)
    const sorted = [...blobs].sort((a, b) => a.key.localeCompare(b.key));
    const latest = sorted.slice(-500);
    const entries = await Promise.all(
      latest.map(async ({ key }) => {
        const raw = await store.get(key);
        return JSON.parse(raw);
      })
    );
    return new Response(JSON.stringify(entries), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }
};
