import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekdayName, localToday } from './date.ts';

describe('localToday', () => {
  it('should format the local calendar date with zero padding', () => {
    // Built from local components, so this holds in every timezone
    assert.equal(localToday(new Date(2026, 0, 5, 1, 30)), '2026-01-05');
    assert.equal(localToday(new Date(2026, 9, 23, 23, 59)), '2026-10-23');
  });
});

describe('Date Utilities (Frontend)', () => {
  it('should return correct weekday name for standard ISO date strings', () => {
    // 2026-10-18 was a Sunday
    assert.equal(getWeekdayName('2026-10-18'), 'Sunday');
    // 2026-10-19 was a Monday
    assert.equal(getWeekdayName('2026-10-19'), 'Monday');
    // 2026-10-24 was a Saturday
    assert.equal(getWeekdayName('2026-10-24'), 'Saturday');
  });

  it('should return empty string for empty, null, or invalid date strings', () => {
    assert.equal(getWeekdayName(''), '');
    assert.equal(getWeekdayName(null as any), '');
    assert.equal(getWeekdayName(undefined as any), '');
    assert.equal(getWeekdayName('invalid-date-format'), '');
  });
});
