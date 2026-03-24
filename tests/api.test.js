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
  test('POSTs id and name, returns success', async () => {
    mockFetch({ success: true });
    const result = await cancelBooking('42', 'Alice');
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/cancel-booking',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: '42', name: 'Alice' }),
      })
    );
  });

  test('throws on non-OK response', async () => {
    mockFetch({}, false);
    await expect(cancelBooking('42', 'Alice')).rejects.toThrow('Flow error');
  });
});

// ─── Admin functions ───────────────────────────────────────────────────────
// ESM modules are cached — a second import('../api.js') returns the same instance.
// All admin functions are destructured from the same import at the top of this file.

const {
  adminAddEmployee,
  adminRemoveEmployee,
  adminBookSpace,
  adminCancelBooking,
} = await import('../api.js');

describe('adminAddEmployee', () => {
  test('POSTs set action with full sorted list including new name', async () => {
    mockFetch({ success: true });
    const result = await adminAddEmployee('secret', 'Carol White', ['Alice Smith', 'Bob Jones']);
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin-employees',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret', action: 'set', employees: ['Alice Smith', 'Bob Jones', 'Carol White'] }),
      })
    );
  });

  test('returns alreadyExists without fetching when name already in list', async () => {
    const result = await adminAddEmployee('secret', 'Alice Smith', ['Alice Smith', 'Bob Jones']);
    expect(result).toEqual({ error: 'alreadyExists' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('returns unauthorized on wrong password', async () => {
    mockFetch({ error: 'unauthorized' });
    const result = await adminAddEmployee('wrong', 'Carol White', []);
    expect(result).toEqual({ error: 'unauthorized' });
  });
});

describe('adminRemoveEmployee', () => {
  test('POSTs set action with name removed from list', async () => {
    mockFetch({ success: true });
    const result = await adminRemoveEmployee('secret', 'Alice Smith', ['Alice Smith', 'Bob Jones']);
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin-employees',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret', action: 'set', employees: ['Bob Jones'] }),
      })
    );
  });
});

describe('adminBookSpace', () => {
  test('POSTs add action with booking object', async () => {
    mockFetch({ id: 'new-uuid' });
    const booking = { date: '2026-03-24', space: 1, bookedBy: 'Alice Smith' };
    const result = await adminBookSpace('secret', booking);
    expect(result).toEqual({ id: 'new-uuid' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin-bookings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret', action: 'add', booking }),
      })
    );
  });
});

describe('adminCancelBooking', () => {
  test('POSTs cancel action with booking id', async () => {
    mockFetch({ success: true });
    const result = await adminCancelBooking('secret', 'uuid-42');
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin-bookings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret', action: 'cancel', booking: { id: 'uuid-42' } }),
      })
    );
  });
});

describe('clearEmployeeCache', () => {
  test('forces getEmployees to re-fetch on next call', async () => {
    // Set up a single mock that returns two different responses
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ['Alice Smith'] })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ['Alice Smith', 'Carol White'] });

    // Ensure cache is empty before this test
    clearEmployeeCache();
    // First call — populate cache
    await getEmployees();
    // Clear cache
    clearEmployeeCache();
    // Second call — must fetch again
    const result = await getEmployees();
    expect(result).toEqual(['Alice Smith', 'Carol White']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
