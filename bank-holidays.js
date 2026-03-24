// Fetches UK bank holidays from the official gov.uk API and caches them for
// the session. Returns a Map<dateStr (YYYY-MM-DD), holidayName> for England & Wales.

let _cache = null;

export async function getBankHolidays() {
  if (_cache) return _cache;
  try {
    const res = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!res.ok) { _cache = new Map(); return _cache; }
    const data = await res.json();
    _cache = new Map(
      (data['england-and-wales']?.events ?? []).map((e) => [e.date, e.title])
    );
  } catch {
    _cache = new Map(); // graceful degradation — treat all days as normal
  }
  return _cache;
}
