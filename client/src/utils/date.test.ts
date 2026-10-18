import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getWeekdayName } from './date.ts';

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
