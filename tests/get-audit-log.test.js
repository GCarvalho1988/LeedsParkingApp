import { jest } from '@jest/globals';

const mockSet = jest.fn();
const mockGet = jest.fn();
const mockList = jest.fn();

jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: () => ({ set: mockSet, get: mockGet, list: mockList }),
}));

const { default: handler } = await import('../netlify/functions/get-audit-log.js');

function req(body) {
  return { json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ADMIN_PASSWORD = 'secret';
});

describe('get-audit-log: misconfiguration guard', () => {
  test('returns misconfigured when ADMIN_PASSWORD env var is not set', async () => {
    delete process.env.ADMIN_PASSWORD;
    const res = await handler(req({ password: 'anything' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'misconfigured' });
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('get-audit-log: auth', () => {
  test('returns unauthorized when password is wrong', async () => {
    const res = await handler(req({ password: 'wrong' }));
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('get-audit-log: success', () => {
  test('returns entries sorted oldest-first by key', async () => {
    const entryA = { ts: '2026-04-08T09:00:00.000Z', action: 'cancel', space: 'B', date: '2026-04-08', bookedBy: 'Bob', ip: '5.6.7.8' };
    const entryB = { ts: '2026-04-08T10:00:00.000Z', action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice', ip: '1.2.3.4' };

    mockList.mockResolvedValue({
      blobs: [
        { key: 'audit-log/2026-04-08T10:00:00.000Z-uuid1' },
        { key: 'audit-log/2026-04-08T09:00:00.000Z-uuid2' },
      ],
    });
    // get is called in parallel — results keyed by call order after sort
    // sorted order: uuid2 (09:00) first, uuid1 (10:00) second
    mockGet
      .mockResolvedValueOnce(JSON.stringify(entryA))
      .mockResolvedValueOnce(JSON.stringify(entryB));

    const res = await handler(req({ password: 'secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].bookedBy).toBe('Bob');   // 09:00 — older, comes first
    expect(body[1].bookedBy).toBe('Alice'); // 10:00 — newer, comes last
  });

  test('returns empty array when no entries exist', async () => {
    mockList.mockResolvedValue({ blobs: [] });
    const res = await handler(req({ password: 'secret' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('caps at 500 entries when more exist', async () => {
    const manyBlobs = Array.from({ length: 600 }, (_, i) => ({
      key: `audit-log/2026-04-08T${String(i).padStart(6, '0')}-uuid${i}`,
    }));
    mockList.mockResolvedValue({ blobs: manyBlobs });
    mockGet.mockResolvedValue(JSON.stringify({ ts: 't', action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'X', ip: '1.1.1.1' }));

    const res = await handler(req({ password: 'secret' }));
    const body = await res.json();
    expect(body).toHaveLength(500);
    expect(mockGet).toHaveBeenCalledTimes(500);
  });
});

describe('get-audit-log: storage error', () => {
  test('returns storageError when list throws', async () => {
    mockList.mockRejectedValue(new Error('network error'));
    const res = await handler(req({ password: 'secret' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'storageError' });
  });
});
