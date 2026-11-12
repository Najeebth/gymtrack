import { getWeekdayName, localToday } from './date.ts';

describe('localToday', () => {
  it('should format the local calendar date with zero padding', () => {
    // Built from local components, so this holds in every timezone
    expect(localToday(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05');
    expect(localToday(new Date(2026, 9, 23, 23, 59))).toBe('2026-10-23');
  });
});

describe('Date Utilities (Frontend)', () => {
  it('should return correct weekday name for standard ISO date strings', () => {
    // 2026-10-18 was a Sunday
    expect(getWeekdayName('2026-10-18')).toBe('Sunday');
    // 2026-10-19 was a Monday
    expect(getWeekdayName('2026-10-19')).toBe('Monday');
    // 2026-10-24 was a Saturday
    expect(getWeekdayName('2026-10-24')).toBe('Saturday');
  });

  it('should return empty string for empty, null, or invalid date strings', () => {
    expect(getWeekdayName('')).toBe('');
    expect(getWeekdayName(null as any)).toBe('');
    expect(getWeekdayName(undefined as any)).toBe('');
    expect(getWeekdayName('invalid-date-format')).toBe('');
  });
});
