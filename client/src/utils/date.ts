// The device's local date as 'YYYY-MM-DD'. Not toISOString(), which is UTC:
// at 2am in India that would still be "yesterday".
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Returns just the weekday name for a 'YYYY-MM-DD' date string (e.g. "Sunday")
export function getWeekdayName(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}
