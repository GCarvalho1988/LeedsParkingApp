import { jest } from '@jest/globals';

const mockReadBlobWithEtag = jest.fn();
const mockWriteBlobConditional = jest.fn();
jest.unstable_mockModule('../netlify/functions/_blob-helpers.js', () => ({
  readBlobWithEtag: mockReadBlobWithEtag,
  writeBlobConditional: mockWriteBlobConditional,
  readBlob: jest.fn(),
  writeBlob: jest.fn(),
}));

const { appendAuditLog } = await import('../netlify/functions/_audit-helpers.js');

function req(ip = '1.2.3.4') {
  return { headers: { get: (h) => h === 'x-nf-client-connection-ip' ? ip : null } };
}

beforeEach(() => jest.clearAllMocks());

describe('appendAuditLog: success', () => {
  test('appends entry with correct fields including IP and timestamp', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: [], etag: 'e1' });
    mockWriteBlobConditional.mockResolvedValue();

    await appendAuditLog(req('9.8.7.6'), { action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice' });

    expect(mockWriteBlobConditional).toHaveBeenCalledWith(
      'audit-log',
      expect.arrayContaining([
        expect.objectContaining({
          action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice', ip: '9.8.7.6',
        }),
      ]),
      'e1'
    );
    const written = mockWriteBlobConditional.mock.calls[0][1];
    expect(written[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('trims to 500 entries when log is at capacity', async () => {
    const existing = Array.from({ length: 500 }, (_, i) => ({
      ts: `t${i}`, action: 'book', space: 'A', date: '2026-01-01', bookedBy: 'X', ip: '1.1.1.1',
    }));
    mockReadBlobWithEtag.mockResolvedValue({ data: existing, etag: 'e1' });
    mockWriteBlobConditional.mockResolvedValue();

    await appendAuditLog(req(), { action: 'cancel', space: 'B', date: '2026-04-09', bookedBy: 'Bob' });

    const written = mockWriteBlobConditional.mock.calls[0][1];
    expect(written).toHaveLength(500);
    expect(written[499]).toMatchObject({ action: 'cancel', bookedBy: 'Bob' });
  });
});

describe('appendAuditLog: ETag retry', () => {
  test('retries on mismatch and succeeds on second attempt', async () => {
    mockReadBlobWithEtag
      .mockResolvedValueOnce({ data: [], etag: 'e1' })
      .mockResolvedValueOnce({ data: [], etag: 'e2' });
    mockWriteBlobConditional
      .mockRejectedValueOnce(new Error('412'))
      .mockResolvedValueOnce();

    await expect(
      appendAuditLog(req(), { action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice' })
    ).resolves.toBeUndefined();
    expect(mockReadBlobWithEtag).toHaveBeenCalledTimes(2);
  });

  test('throws after exhausting all 5 retries', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: [], etag: 'e1' });
    mockWriteBlobConditional.mockRejectedValue(new Error('412'));

    await expect(
      appendAuditLog(req(), { action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice' })
    ).rejects.toThrow('conflict');
    expect(mockReadBlobWithEtag).toHaveBeenCalledTimes(5);
  });
});

describe('appendAuditLog: storage error', () => {
  test('throws when blob is corrupt', async () => {
    mockReadBlobWithEtag.mockResolvedValue({ data: null, etag: null });

    await expect(
      appendAuditLog(req(), { action: 'book', space: 'A', date: '2026-04-09', bookedBy: 'Alice' })
    ).rejects.toThrow('storageError');
  });
});
