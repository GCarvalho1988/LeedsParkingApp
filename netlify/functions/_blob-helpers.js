// netlify/functions/_blob-helpers.js
// Shared utilities for reading and writing Netlify Blobs.
// Returns [] for missing keys. Returns null and lets the caller
// return a 500 storageError if JSON is corrupt.
import { getStore } from '@netlify/blobs';

const _store = () => getStore('parking-app');

export async function readBlob(key) {
  const store = _store();
  const raw = await store.get(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null; // caller must handle as storageError
  }
}

export async function writeBlob(key, data) {
  const store = _store();
  await store.set(key, JSON.stringify(data));
}
