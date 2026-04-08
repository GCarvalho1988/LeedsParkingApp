import { readBlob } from './_blob-helpers.js';

export default async (req) => {
  if (!process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'misconfigured' }), { status: 500 });
  }
  const body = await req.json();
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 200 });
  }
  const log = await readBlob('audit-log');
  if (log === null) {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }
  return new Response(JSON.stringify(log), { status: 200 });
};
