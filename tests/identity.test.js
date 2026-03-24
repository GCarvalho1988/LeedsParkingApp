import { jest } from '@jest/globals';

// ── Manual sessionStorage mock (testEnvironment is 'node') ───────────────────
const store = {};
const sessionStorageMock = {
  getItem:    jest.fn((key) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
  setItem:    jest.fn((key, value) => { store[key] = String(value); }),
  removeItem: jest.fn((key) => { delete store[key]; }),
  clear:      jest.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock, writable: true });

const { getName, setName, clearName } = await import('../identity.js');

beforeEach(() => {
  sessionStorageMock.clear();
  jest.clearAllMocks();
});

// ─── getName ───────────────────────────────────────────────────────────────

test('getName returns null when nothing is stored', () => {
  expect(getName()).toBeNull();
});

test('getName returns the stored name after setName', () => {
  setName('Alice Smith');
  expect(getName()).toBe('Alice Smith');
});

// ─── setName ──────────────────────────────────────────────────────────────

test('setName stores the name in sessionStorage', () => {
  setName('Bob Jones');
  expect(sessionStorageMock.setItem).toHaveBeenCalledWith('parkingUserName', 'Bob Jones');
});

// ─── clearName ────────────────────────────────────────────────────────────

test('clearName removes the stored name', () => {
  setName('Alice Smith');
  clearName();
  expect(getName()).toBeNull();
});

test('clearName calls sessionStorage.removeItem with the correct key', () => {
  clearName();
  expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('parkingUserName');
});
