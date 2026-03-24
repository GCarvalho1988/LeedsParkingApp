import { readBlob, writeBlob } from './_blob-helpers.js';

export default async (req) => {
  const body = await req.json();
  // do NOT log body — contains password
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 200 });
  }

  // set: client sends full array — no read needed, eliminates read-modify-write race
  if (body.action === 'set') {
    if (!Array.isArray(body.employees)) {
      return new Response(JSON.stringify({ error: 'invalidPayload' }), { status: 200 });
    }
    await writeBlob('employees', body.employees);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  // add/remove still used by password verification (action: 'add', name: '')
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
