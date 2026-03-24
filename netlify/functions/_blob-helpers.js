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
//
// When etag is present  → onlyIfMatch: only write if blob still has this etag.
// When etag is null     → onlyIfNew:   only write if blob truly does not exist.
//
// The null/absent case is critical: a stale read can return null etag even when
// the blob EXISTS (just not yet propagated to this replica). Using onlyIfNew
// instead of an unconditional write prevents overwriting data we couldn't see.
// On failure in both cases we throw so the caller's retry loop re-reads fresh state.
export async function writeBlobConditional(key, data, etag) {
  const store = _store();
  const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
  const result = await store.set(key, JSON.stringify(data), opts);
  if (result && result.modified === false) {
    throw new Error('Conditional write failed: ETag mismatch or blob already exists');
  }
}
