import { jest } from '@jest/globals';

const mockReadBlob = jest.fn();
jest.unstable_mockModule('../netlify/functions/_blob-helpers.js', () => ({
  readBlobWithEtag: jest.fn(),
  writeBlobConditional: jest.fn(),
  readBlob: mockReadBlob,
  writeBlob: jest.fn(),
}));

const { default: handler } = await import('../netlify/functions/get-audit-log.js');

function req(body) {
  return { json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ADMIN_PASSWORD = 'secret';
});

describe('get-audit-log: auth', () => {
  test('returns unauthorized when password is wrong', async () => {
    const res = await handler(req({ password: 'wrong' }));
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mockReadBlob).not.toHaveBeenCalled();
  });
});

describe('get-audit-log: success', () => {
  test('returns the full audit log array', async () => {
    const entries = [
      { ts: '2026-04-08T10:00:00.000Z', action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice', ip: '1.2.3.4' },
    ];
    mockReadBlob.mockResolvedValue(entries);

    const res = await handler(req({ password: 'secret' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(entries);
  });

  test('returns empty array when log is empty', async () => {
    mockReadBlob.mockResolvedValue([]);
    const res = await handler(req({ password: 'secret' }));
    expect(await res.json()).toEqual([]);
  });
});

describe('get-audit-log: storage error', () => {
  test('returns storageError with status 500 when blob is corrupt', async () => {
    mockReadBlob.mockResolvedValue(null);
    const res = await handler(req({ password: 'secret' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'storageError' });
  });
});
