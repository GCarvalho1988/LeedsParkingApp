import {
  weekStart,
  weekDays,
  isPast,
  isCurrentWeek,
  isBeyondMaxWeek,
  toISODate,
  formatDay,
} from '../dates.js';

describe('weekStart', () => {
  test('returns the Monday of a Wednesday', () => {
    const wed = new Date('2026-03-25T12:00:00');
    expect(toISODate(weekStart(wed))).toBe('2026-03-23');
  });

  test('returns the same Monday when given a Monday', () => {
    const mon = new Date('2026-03-23T00:00:00');
    expect(toISODate(weekStart(mon))).toBe('2026-03-23');
  });

  test('returns the preceding Monday when given a Sunday', () => {
    const sun = new Date('2026-03-29T12:00:00');
    expect(toISODate(weekStart(sun))).toBe('2026-03-23');
  });
});

describe('weekDays', () => {
  test('returns 5 consecutive days starting from Monday', () => {
    const mon = new Date('2026-03-23');
    const days = weekDays(mon);
    expect(days).toHaveLength(5);
    expect(toISODate(days[0])).toBe('2026-03-23'); // Mon
    expect(toISODate(days[4])).toBe('2026-03-27'); // Fri
  });
});

describe('isPast', () => {
  test('returns true for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isPast(yesterday)).toBe(true);
  });

  test('returns false for today', () => {
    expect(isPast(new Date())).toBe(false);
  });

  test('returns false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isPast(tomorrow)).toBe(false);
  });
});

describe('isCurrentWeek', () => {
  test('returns true for the current week Monday', () => {
    const currentMonday = weekStart(new Date());
    expect(isCurrentWeek(currentMonday)).toBe(true);
  });

  test('returns false for next week Monday', () => {
    const nextMonday = weekStart(new Date());
    nextMonday.setDate(nextMonday.getDate() + 7);
    expect(isCurrentWeek(nextMonday)).toBe(false);
  });
});

describe('isBeyondMaxWeek', () => {
  test('returns false for the current week', () => {
    const currentMonday = weekStart(new Date());
    expect(isBeyondMaxWeek(currentMonday)).toBe(false);
  });

  test('returns false for 3 weeks ahead (the furthest allowed)', () => {
    const monday = weekStart(new Date());
    monday.setDate(monday.getDate() + 21);
    expect(isBeyondMaxWeek(monday)).toBe(false);
  });

  test('returns true for 4 weeks ahead', () => {
    const monday = weekStart(new Date());
    monday.setDate(monday.getDate() + 28);
    expect(isBeyondMaxWeek(monday)).toBe(true);
  });
});

describe('toISODate', () => {
  test('returns YYYY-MM-DD string', () => {
    expect(toISODate(new Date('2026-03-23T15:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDay', () => {
  test('returns a human-readable day string', () => {
    const result = formatDay(new Date('2026-03-23'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
