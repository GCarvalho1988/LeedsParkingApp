import { readBlob, writeBlob } from './_blob-helpers.js';

export const handler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  // do NOT log body — contains password
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 200, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  // Reject empty or whitespace-only names before any blob access
  if (!body.name || !body.name.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalidName' }) };
  }

  const employees = await readBlob('employees');
  if (employees === null) {
    return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
  }

  if (body.action === 'add') {
    if (employees.includes(body.name)) {
      return { statusCode: 200, body: JSON.stringify({ error: 'alreadyExists' }) };
    }
    employees.push(body.name);
    await writeBlob('employees', employees);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (body.action === 'remove') {
    await writeBlob('employees', employees.filter((e) => e !== body.name));
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: 'unknownAction' }) };
};
