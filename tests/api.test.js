// Mock auth.js and config.js before importing api.js.
// jest.unstable_mockModule must be called before the dynamic import.
import { jest } from '@jest/globals';

const mockGetToken = jest.fn().mockResolvedValue('fake-token');

jest.unstable_mockModule('../auth.js', () => ({
  getToken: mockGetToken,
}));

jest.unstable_mockModule('../config.js', () => ({
  SHAREPOINT_HOSTNAME: 'tenant.sharepoint.com',
  SHAREPOINT_SITE_PATH: '/sites/testsite',
  LIST_ID: 'aaaabbbb-1234-5678-abcd-000000000000',
}));

// Dynamic import after mocks are registered
const { getBookingsForWeek, bookSpace, cancelBooking } = await import('../api.js');

// Mock the global fetch
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper: builds a minimal mock fetch response
function mockFetchResponse(body, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => body,
  });
}

// ─── getBookingsForWeek ────────────────────────────────────────────────────

describe('getBookingsForWeek', () => {
  test('returns mapped booking objects for the week', async () => {
    fetch.mockReturnValueOnce(
      mockFetchResponse({
        value: [
          {
            id: 'item-1',
            fields: {
              Date: '2026-03-23T00:00:00Z',
              Space: 1,
              BookedBy: 'Alice Smith',
              BookedByEmail: 'alice@example.com',
            },
          },
        ],
      })
    );

    const result = await getBookingsForWeek('2026-03-23', '2026-03-27');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'item-1',
      date: '2026-03-23',
      space: 1,
      bookedBy: 'Alice Smith',
      bookedByEmail: 'alice@example.com',
    });
  });

  test('includes Authorization header with token', async () => {
    fetch.mockReturnValueOnce(mockFetchResponse({ value: [] }));

    await getBookingsForWeek('2026-03-23', '2026-03-27');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer fake-token');
  });

  test('throws on non-OK Graph response', async () => {
    fetch.mockReturnValueOnce(mockFetchResponse({}, false));

    await expect(getBookingsForWeek('2026-03-23', '2026-03-27')).rejects.toThrow('Graph API error');
  });
});

// ─── bookSpace ─────────────────────────────────────────────────────────────

describe('bookSpace', () => {
  test('returns { error: alreadyBooked } when user already has a booking that day', async () => {
    // Step 1 check returns an existing booking for this user
    fetch.mockReturnValueOnce(
      mockFetchResponse({ value: [{ id: 'existing', fields: {} }] })
    );

    const result = await bookSpace('2026-03-23', 1, 'Alice Smith', 'alice@example.com');

    expect(result).toEqual({ error: 'alreadyBooked' });
    // Must stop after the first check — no second fetch call
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('returns { error: taken, bookedBy } when space is booked by someone else', async () => {
    fetch
      .mockReturnValueOnce(mockFetchResponse({ value: [] })) // Step 1: user has no booking
      .mockReturnValueOnce(
        mockFetchResponse({ value: [{ id: 'space-taken', fields: { BookedBy: 'Bob Jones' } }] })
      ); // Step 2: space is taken

    const result = await bookSpace('2026-03-23', 1, 'Alice Smith', 'alice@example.com');

    expect(result).toEqual({ error: 'taken', bookedBy: 'Bob Jones' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('POSTs new booking and returns { success: true } when both checks pass', async () => {
    fetch
      .mockReturnValueOnce(mockFetchResponse({ value: [] })) // Step 1: user free
      .mockReturnValueOnce(mockFetchResponse({ value: [] })) // Step 2: space free
      .mockReturnValueOnce(mockFetchResponse({ id: 'new-item', fields: {} })); // Step 3: POST

    const result = await bookSpace('2026-03-23', 1, 'Alice Smith', 'alice@example.com');

    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledTimes(3);

    // Verify the POST body
    const [, postOptions] = fetch.mock.calls[2];
    expect(postOptions.method).toBe('POST');
    const body = JSON.parse(postOptions.body);
    expect(body.fields.Space).toBe(1);
    expect(body.fields.BookedByEmail).toBe('alice@example.com');
    expect(body.fields.Date).toBe('2026-03-23T00:00:00Z');
  });
});

// ─── cancelBooking ─────────────────────────────────────────────────────────

describe('cancelBooking', () => {
  test('sends a DELETE request to the correct item URL', async () => {
    fetch.mockReturnValueOnce(Promise.resolve({ ok: true }));

    await cancelBooking('item-abc');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
    expect(url).toContain('item-abc');
  });

  test('throws on non-OK Graph response', async () => {
    fetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 403, statusText: 'Forbidden' }));

    await expect(cancelBooking('item-abc')).rejects.toThrow('Graph API error');
  });
});
