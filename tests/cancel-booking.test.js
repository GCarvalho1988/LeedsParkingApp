import { jest } from '@jest/globals';

const mockReadBlobWithEtag = jest.fn();
const mockWriteBlobConditional = jest.fn();
jest.unstable_mockModule('../netlify/functions/_blob-helpers.js', () => ({
  readBlobWithEtag: mockReadBlobWithEtag,
  writeBlobConditional: mockWriteBlobConditional,
  readBlob: jest.fn(),
  writeBlob: jest.fn(),
}));

const { default: handler } = await import('../netlify/functions/cancel-booking.js');

function req(body) {
  return { json: async () => body };
}

beforeEach(() => jest.clearAllMocks());

describe('cancel-booking: success', () => {
  test('removes the booking when id and name match', async () => {
    const bookings = [
      { id: 'abc', date: '2026-04-01', space: 1, bookedBy: 'Alice' },
      { id: 'def', date: '2026-04-02', space: 2, bookedBy: 'Bob' },
    ];
    mockReadBlobWithEtag.mockResolvedValue({ data: bookings, etag: 'e1' });
    mockWriteBlobConditional.mockResolvedValue();

    const res = await handler(req({ id: 'abc', name: 'Alice' }));
    expect(await res.json()).toEqual({ success: true });
    expect(mockWriteBlobConditional).toHaveBeenCalledWith(
      'bookings',
      [{ id: 'def', date: '2026-04-02', space: 2, bookedBy: 'Bob' }],
      'e1'
    );
  });

  test('succeeds silently when id does not exist (idempotent)', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: [], etag: 'e1' });

    const res = await handler(req({ id: 'nonexistent', name: 'Alice' }));
    expect(await res.json()).toEqual({ success: true });
    expect(mockWriteBlobConditional).not.toHaveBeenCalled();
  });
});

describe('cancel-booking: ownership enforcement', () => {
  test('returns 403 forbidden when name does not match bookedBy', async () => {
    const bookings = [{ id: 'abc', date: '2026-04-01', space: 1, bookedBy: 'Alice' }];
    mockReadBlobWithEtag.mockResolvedValue({ data: bookings, etag: 'e1' });

    const res = await handler(req({ id: 'abc', name: 'Bob' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(mockWriteBlobConditional).not.toHaveBeenCalled();
  });

  test('returns 400 when id is missing', async () => {
    const res = await handler(req({ name: 'Alice' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
  });

  test('returns 400 when name is missing', async () => {
    const res = await handler(req({ id: 'abc' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
  });
});

describe('cancel-booking: ETag retry', () => {
  test('retries on ETag mismatch and succeeds on second attempt', async () => {
    const bookings = [{ id: 'abc', date: '2026-04-01', space: 1, bookedBy: 'Alice' }];

    mockReadBlobWithEtag
      .mockResolvedValueOnce({ data: bookings, etag: 'e-original' })
      .mockResolvedValueOnce({ data: bookings, etag: 'e-after-concurrent' });

    mockWriteBlobConditional
      .mockRejectedValueOnce(new Error('412'))
      .mockResolvedValueOnce();

    const res = await handler(req({ id: 'abc', name: 'Alice' }));
    expect(await res.json()).toEqual({ success: true });
    expect(mockReadBlobWithEtag).toHaveBeenCalledTimes(2);
  });

  test('returns conflict after exhausting all 5 retries', async () => {
    const bookings = [{ id: 'abc', date: '2026-04-01', space: 1, bookedBy: 'Alice' }];
    mockReadBlobWithEtag.mockResolvedValue({ data: bookings, etag: 'e1' });
    mockWriteBlobConditional.mockRejectedValue(new Error('412'));

    const res = await handler(req({ id: 'abc', name: 'Alice' }));
    expect(await res.json()).toEqual({ error: 'conflict' });
    expect(mockReadBlobWithEtag).toHaveBeenCalledTimes(5);
  });
});

describe('cancel-booking: storage error', () => {
  test('returns storageError when blob is corrupt', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: null, etag: null });

    const res = await handler(req({ id: 'abc', name: 'Alice' }));
    expect(await res.json()).toEqual({ error: 'storageError' });
    expect(res.status).toBe(500);
  });
});
