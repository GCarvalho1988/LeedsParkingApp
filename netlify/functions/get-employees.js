import { readBlob } from './_blob-helpers.js';

export default async () => {
  const employees = await readBlob('employees');
  if (employees === null) {
    return new Response(JSON.stringify({ error: 'storageError' }), { status: 500 });
  }
  return new Response(JSON.stringify(employees), { status: 200 });
};
