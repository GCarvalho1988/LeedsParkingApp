import { jest } from '@jest/globals';

// Mock _blob-helpers so the function never touches @netlify/blobs
const mockReadBlobWithEtag = jest.fn();
const mockWriteBlobConditional = jest.fn();
jest.unstable_mockModule('../netlify/functions/_blob-helpers.js', () => ({
  readBlobWithEtag: mockReadBlobWithEtag,
  writeBlobConditional: mockWriteBlobConditional,
  readBlob: jest.fn(),
  writeBlob: jest.fn(),
}));

const mockAppendAuditLog = jest.fn();
jest.unstable_mockModule('../netlify/functions/_audit-helpers.js', () => ({
  appendAuditLog: mockAppendAuditLog,
}));

const { default: handler } = await import('../netlify/functions/book-space.js');

function req(body) {
  return { json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAppendAuditLog.mockResolvedValue();
});

// ─── Happy path ─────────────────────────────────────────────────────────────

describe('book-space: success', () => {
  test('books a free space and returns a UUID id', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: [], etag: 'e1' });
    mockWriteBlobConditional.mockResolvedValue();

    const res = await handler(req({ date: '2026-04-01', space: 1, name: 'Alice' }));
    const body = await res.json();

    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe('string');
    expect(mockWriteBlobConditional).toHaveBeenCalledWith(
      'bookings',
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-04-01', space: 1, bookedBy: 'Alice' }),
      ]),
      'e1'
    );
  });

  test('calls appendAuditLog with correct fields after successful booking', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: [], etag: 'e1' });
    mockWriteBlobConditional.mockResolvedValue();

    await handler(req({ date: '2026-04-09', space: 'A', name: 'Alice' }));

    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      { action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice' }
    );
  });

  test('does not call appendAuditLog when booking fails (alreadyBooked)', async () => {
    mockReadBlobWithEtag.mockResolvedValue({
      data: [{ id: 'x', date: '2026-04-09', space: 2, bookedBy: 'Alice' }],
      etag: 'e1',
    });

    await handler(req({ date: '2026-04-09', space: 2, name: 'Alice' }));

    expect(mockAppendAuditLog).not.toHaveBeenCalled();
  });
});

// ─── Conflict detection ─────────────────────────────────────────────────────

describe('book-space: conflict detection', () => {
  test('returns alreadyBooked when user already has a booking on that day', async () => {
    mockReadBlobWithEtag.mockResolvedValue({
      data: [{ id: 'x', date: '2026-04-01', space: 1, bookedBy: 'Alice' }],
      etag: 'e1',
    });

    const res = await handler(req({ date: '2026-04-01', space: 2, name: 'Alice' }));
    expect(await res.json()).toEqual({ error: 'alreadyBooked' });
    expect(mockWriteBlobConditional).not.toHaveBeenCalled();
  });

  test('returns taken with bookedBy when the specific space is taken', async () => {
    mockReadBlobWithEtag.mockResolvedValue({
      data: [{ id: 'x', date: '2026-04-01', space: 1, bookedBy: 'Bob' }],
      etag: 'e1',
    });

    const res = await handler(req({ date: '2026-04-01', space: 1, name: 'Alice' }));
    expect(await res.json()).toEqual({ error: 'taken', bookedBy: 'Bob' });
    expect(mockWriteBlobConditional).not.toHaveBeenCalled();
  });
});

// ─── ETag retry logic ───────────────────────────────────────────────────────

describe('book-space: ETag retry on concurrent writes', () => {
  test('retries after ETag mismatch and succeeds on second attempt', async () => {
    const concurrentBooking = { id: 'other', date: '2026-04-01', space: 1, bookedBy: 'Bob' };

    // First read: empty blob. First write: fails (concurrent write by Bob on space 1).
    // Second read: blob now contains Bob's booking. Second write: Alice gets space 2.
    mockReadBlobWithEtag
      .mockResolvedValueOnce({ data: [], etag: 'e-original' })
      .mockResolvedValueOnce({ data: [concurrentBooking], etag: 'e-after-bob' });

    mockWriteBlobConditional
      .mockRejectedValueOnce(new Error('412 Precondition Failed'))
      .mockResolvedValueOnce();

    const res = await handler(req({ date: '2026-04-01', space: 2, name: 'Alice' }));
    const body = await res.json();

    expect(body.id).toBeDefined();
    expect(mockReadBlobWithEtag).toHaveBeenCalledTimes(2);
    expect(mockWriteBlobConditional).toHaveBeenCalledTimes(2);
    // Second write uses the fresh ETag
    expect(mockWriteBlobConditional).toHaveBeenLastCalledWith(
      'bookings',
      expect.arrayContaining([
        expect.objectContaining({ bookedBy: 'Alice' }),
      ]),
      'e-after-bob'
    );
  });

  test('after retry, detects alreadyBooked in the fresh read', async () => {
    // Simulates: user double-clicked and first click already booked
    const existingBooking = { id: 'x', date: '2026-04-01', space: 1, bookedBy: 'Alice' };

    mockReadBlobWithEtag
      .mockResolvedValueOnce({ data: [], etag: 'e1' })
      .mockResolvedValueOnce({ data: [existingBooking], etag: 'e2' });

    mockWriteBlobConditional.mockRejectedValueOnce(new Error('412'));

    const res = await handler(req({ date: '2026-04-01', space: 2, name: 'Alice' }));
    expect(await res.json()).toEqual({ error: 'alreadyBooked' });
  });

  test('returns conflict after exhausting all 5 retries', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: [], etag: 'e1' });
    mockWriteBlobConditional.mockRejectedValue(new Error('412'));

    const res = await handler(req({ date: '2026-04-01', space: 1, name: 'Alice' }));
    expect(await res.json()).toEqual({ error: 'conflict' });
    expect(mockReadBlobWithEtag).toHaveBeenCalledTimes(5);
  });
});

// ─── Storage error ──────────────────────────────────────────────────────────

describe('book-space: storage error', () => {
  test('returns storageError when blob data is corrupt (null)', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: null, etag: null });

    const res = await handler(req({ date: '2026-04-01', space: 1, name: 'Alice' }));
    expect(await res.json()).toEqual({ error: 'storageError' });
    expect(res.status).toBe(500);
  });
});
