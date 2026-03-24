import { readBlob, writeBlob } from './_blob-helpers.js';

export default async (req) => {
  const body = await req.json();
  // do NOT log body — contains password
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 200 });
  }

  // Reject empty or whitespace-only names before any blob access
  if (!body.name || !body.name.trim()) {
    return new Response(JSON.stringify({ error: 'invalidName' }), { status: 200 });
  }

  const employees = await readBlob('employees');
  if (employees === null) {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }

  if (body.action === 'add') {
    if (employees.includes(body.name)) {
      return new Response(JSON.stringify({ error: 'alreadyExists' }), { status: 200 });
    }
    employees.push(body.name);
    await writeBlob('employees', employees);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (body.action === 'remove') {
    await writeBlob('employees', employees.filter((e) => e !== body.name));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: 'unknownAction' }), { status: 400 });
};
