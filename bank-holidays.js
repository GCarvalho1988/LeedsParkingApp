// Fetches UK bank holidays from the official gov.uk API and caches them for
// the session. Returns a Map<dateStr (YYYY-MM-DD), holidayName> for England & Wales.

let _cache = null;

export async function getBankHolidays() {
  if (_cache) return _cache;
  try {
    const res = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!res.ok) { return new Map(); }
    const data = await res.json();
    _cache = new Map(
      (data['england-and-wales']?.events ?? []).map((e) => [e.date, e.title])
    );
  } catch {
    return new Map(); // graceful degradation — don't cache so next load retries
  }
  return _cache;
}
