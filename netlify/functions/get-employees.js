import { readBlob } from './_blob-helpers.js';

export const handler = async () => {
  const employees = await readBlob('employees');
  if (employees === null) {
    return { statusCode: 500, body: JSON.stringify({ error: 'storageError' }) };
  }
  return { statusCode: 200, body: JSON.stringify(employees) };
};
