/**
 * Returns the Monday of the week containing the given date.
 * Treats Sunday as the end of the prior week (ISO week convention).
 */
export function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns an array of 5 Date objects (Mon–Fri) for the week
 * starting at the given Monday.
 */
export function weekDays(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Returns true if the date is strictly before today (yesterday or earlier).
 * Today itself returns false — today is bookable.
 */
export function isPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Returns true if the given Monday is the current week's Monday.
 */
export function isCurrentWeek(monday) {
  const currentMonday = weekStart(new Date());
  return monday.getTime() === currentMonday.getTime();
}

/**
 * Returns true if the given Monday is beyond the rolling 4-week window
 * (current week + 3 more weeks ahead).
 */
export function isBeyondMaxWeek(monday) {
  const currentMonday = weekStart(new Date());
  const maxMonday = new Date(currentMonday);
  maxMonday.setDate(maxMonday.getDate() + 21); // 3 more weeks = 21 days
  return monday > maxMonday;
}

/**
 * Returns a YYYY-MM-DD string in local time.
 * Used for date comparisons and Graph API filter values.
 */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a human-readable day string, e.g. "Mon 23 Mar".
 */
export function formatDay(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
