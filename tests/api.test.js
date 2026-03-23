import { jest } from '@jest/globals';

// Mock config.js with known test URLs — must come before dynamic import
jest.unstable_mockModule('../config.js', () => ({
  FLOW_GET_EMPLOYEES:  'https://test.example/employees',
  FLOW_GET_BOOKINGS:   'https://test.example/bookings',
  FLOW_BOOK_SPACE:     'https://test.example/book',
  FLOW_CANCEL_BOOKING: 'https://test.example/cancel',
}));

const { getEmployees, getBookingsForWeek, bookSpace, cancelBooking } = await import('../api.js');

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
  test('returns the employee name array from the flow', async () => {
    mockFetch([{ '': 'Alice Smith' }, { '': 'Bob Jones' }]);
    const result = await getEmployees();
    expect(result).toEqual(['Alice Smith', 'Bob Jones']);
    expect(fetch).toHaveBeenCalledWith(
      'https://test.example/employees',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  test('throws on non-OK response', async () => {
    mockFetch({}, false);
    await expect(getEmployees()).rejects.toThrow('Flow error');
  });
});

// ─── getBookingsForWeek ────────────────────────────────────────────────────

describe('getBookingsForWeek', () => {
  test('appends start/end query params and returns bookings array', async () => {
    const data = [{ id: '1', date: '2026-03-24', space: 1, bookedBy: 'Alice Smith' }];
    mockFetch(data);
    const result = await getBookingsForWeek('2026-03-24', '2026-03-28');
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(
      'https://test.example/bookings?start=2026-03-24&end=2026-03-28',
      expect.any(Object)
    );
  });

  test('returns empty array when flow returns []', async () => {
    mockFetch([]);
    const result = await getBookingsForWeek('2026-03-24', '2026-03-28');
    expect(result).toEqual([]);
  });
});

// ─── bookSpace ─────────────────────────────────────────────────────────────

describe('bookSpace', () => {
  test('POSTs date, space, name and returns success', async () => {
    mockFetch({ success: true });
    const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://test.example/book',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ date: '2026-03-24', space: 1, name: 'Alice Smith' }),
      })
    );
  });

  test('returns alreadyBooked error from flow', async () => {
    mockFetch({ error: 'alreadyBooked' });
    const result = await bookSpace('2026-03-24', 1, 'Alice Smith');
    expect(result).toEqual({ error: 'alreadyBooked' });
  });

  test('returns taken error with bookedBy from flow', async () => {
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
      'https://test.example/cancel',
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
