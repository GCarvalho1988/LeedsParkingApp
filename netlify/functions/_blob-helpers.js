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

// Returns { data, etag } — use with writeBlobConditional to avoid lost-update races.
// etag is null when the blob doesn't yet exist (first write should be unconditional).
export async function readBlobWithEtag(key) {
  const store = _store();
  const result = await store.getWithMetadata(key);
  if (!result || !result.data) return { data: [], etag: result?.etag ?? null };
  try {
    return { data: JSON.parse(result.data), etag: result.etag };
  } catch {
    return { data: null, etag: null };
  }
}

// Conditional write using the ETag from readBlobWithEtag.
// Throws if another write landed between the read and this write (caller should retry).
// If etag is null (blob was absent), falls back to unconditional write.
export async function writeBlobConditional(key, data, etag) {
  const store = _store();
  const opts = etag ? { etag } : {};
  await store.set(key, JSON.stringify(data), opts);
}
