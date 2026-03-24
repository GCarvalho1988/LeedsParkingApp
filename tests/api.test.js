import { jest } from '@jest/globals';

const { getEmployees, getBookingsForWeek, bookSpace, cancelBooking, clearEmployeeCache } = await import('../api.js');

// Helper: mock a single fetch response
function mockFetch(body, ok = true) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => body,
  });
}

beforeEach(() => jest.clearAllMocks());

// ─── getEmployees ──────────────────────────────────────────────────────────

describe('getEmployees', () => {
  beforeEach(() => clearEmployeeCache()); // isolate cache between tests

  test('returns plain string array from the endpoint', async () => {
    mockFetch(['Alice Smith', 'Bob Jones']);
    const result = await getEmployees();
    expect(result).toEqual(['Alice Smith', 'Bob Jones']);
    expect(fetch).toHaveBeenCalledWith(
      '/api/get-employees',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('throws on non-OK response', async () => {
    mockFetch({}, false);
    await expect(getEmployees()).rejects.toThrow('Flow error');
  });
});

// ─── getBookingsForWeek ────────────────────────────────────────────────────

describe('getBookingsForWeek', () => {
  test('POSTs start/end in body and returns bookings array', async () => {
    const data = [{ id: '1', date: '2026-03-24', space: 1, bookedBy: 'Alice Smith' }];
    mockFetch(data);
    const result = await getBookingsForWeek('2026-03-24', '2026-03-28');
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(
      '/api/get-bookings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ start: '2026-03-24', end: '2026-03-28' }),
      })
    );
  });

  test('returns empty array when endpoint returns []', async () => {
    mockFetch([]);
    const result = await getBookingsForWeek('2026-03-24', '2026-03-28');
    expect(result).toEqual([]);
  });
});

// ─── bookSpace ─────────────────────────────────────────────────────────────

describe('bookSpace', () => {
  test('POSTs date, space, name and returns id on success', async () => {
    mockFetch({ id: 'uuid-123' });
    const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
    expect(result).toEqual({ id: 'uuid-123' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/book-space',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ date: '2026-03-24', space: 1, name: 'Alice Smith' }),
      })
    );
  });

  test('returns alreadyBooked error', async () => {
    mockFetch({ error: 'alreadyBooked' });
    const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
    expect(result).toEqual({ error: 'alreadyBooked' });
  });

  test('returns taken error with bookedBy', async () => {
    mockFetch({ error: 'taken', bookedBy: 'Bob Jones' });
    const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
    expect(result).toEqual({ error: 'taken', bookedBy: 'Bob Jones' });
  });

  test('throws on non-OK response', async () => {
    mockFetch({}, false);
    await expect(bookSpace('2026-03-24', 1, 'Alice Smith')).rejects.toThrow('Flow error');
  });
});

// ─── cancelBooking ─────────────────────────────────────────────────────────

describe('cancelBooking', () => {
  test('POSTs id and returns success', async () => {
    mockFetch({ success: true });
    const result = await cancelBooking('42');
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/cancel-booking',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: '42' }),
      })
    );
  });

  test('throws on non-OK response', async () => {
    mockFetch({}, false);
    await expect(cancelBooking('42')).rejects.toThrow('Flow error');
  });
});
