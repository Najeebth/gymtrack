// Returns just the weekday name for a 'YYYY-MM-DD' date string (e.g. "Sunday")
export function getWeekdayName(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}
