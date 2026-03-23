import { jest } from '@jest/globals';

// ── Manual localStorage mock (testEnvironment is 'node') ──────────────────
const store = {};
const localStorageMock = {
  getItem:    jest.fn((key) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
  setItem:    jest.fn((key, value) => { store[key] = String(value); }),
  removeItem: jest.fn((key) => { delete store[key]; }),
  clear:      jest.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

const { getName, setName, clearName } = await import('../identity.js');

beforeEach(() => {
  localStorageMock.clear();
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

test('setName stores the name in localStorage', () => {
  setName('Bob Jones');
  expect(localStorageMock.setItem).toHaveBeenCalledWith('parkingUserName', 'Bob Jones');
});

// ─── clearName ────────────────────────────────────────────────────────────

test('clearName removes the stored name', () => {
  setName('Alice Smith');
  clearName();
  expect(getName()).toBeNull();
});

test('clearName calls localStorage.removeItem with the correct key', () => {
  clearName();
  expect(localStorageMock.removeItem).toHaveBeenCalledWith('parkingUserName');
});
