import { jest } from '@jest/globals';

const mockSet = jest.fn();
jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: () => ({ set: mockSet, get: jest.fn(), list: jest.fn() }),
}));

const { appendAuditLog } = await import('../netlify/functions/_audit-helpers.js');

function req(ip = '1.2.3.4') {
  return { headers: { get: (h) => h === 'x-nf-client-connection-ip' ? ip : null } };
}

beforeEach(() => jest.clearAllMocks());

describe('appendAuditLog: success', () => {
  test('stores entry with correct fields under audit-log/ prefix', async () => {
    mockSet.mockResolvedValue();
    await appendAuditLog(req('9.8.7.6'), { action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice' });

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [key, value] = mockSet.mock.calls[0];
    expect(key).toMatch(/^audit-log\//);
    const entry = JSON.parse(value);
    expect(entry).toMatchObject({ action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice', ip: '9.8.7.6' });
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('each concurrent call generates a unique key', async () => {
    mockSet.mockResolvedValue();
    await Promise.all([
      appendAuditLog(req(), { action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice' }),
      appendAuditLog(req(), { action: 'book', space: 'B', date: '2026-04-09', bookedBy: 'Bob' }),
      appendAuditLog(req(), { action: 'book', space: 'A', date: '2026-04-10', bookedBy: 'Carol' }),
    ]);

    expect(mockSet).toHaveBeenCalledTimes(3);
    const keys = mockSet.mock.calls.map(([k]) => k);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(3);
    keys.forEach((k) => expect(k).toMatch(/^audit-log\//));
  });

  test('uses "unknown" as IP when header is absent', async () => {
    mockSet.mockResolvedValue();
    await appendAuditLog({ headers: { get: () => null } }, { action: 'cancel', space: 'B', date: '2026-04-09', bookedBy: 'Bob' });

    const entry = JSON.parse(mockSet.mock.calls[0][1]);
    expect(entry.ip).toBe('unknown');
  });
});
