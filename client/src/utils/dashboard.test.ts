import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, computeDashboardStats, weekStartOf } from './dashboard.ts';
import type { Workout } from '../types';

// 2026-11-12 is a Thursday, so its week starts Monday 2026-11-09.
const TODAY = '2026-11-12';

let nextId = 0;
function workout(date: string, exercise: string, muscleGroup: string, sets: [number, number][]): Workout {
  return {
    id: `w${nextId++}`,
    date,
    exercise,
    muscleGroup,
    sets: sets.map(([reps, weightKg], i) => ({ id: `s${nextId}-${i}`, reps, weightKg })),
  };
}

describe('week helpers', () => {
  it('finds the Monday on or before a date', () => {
    assert.equal(weekStartOf('2026-11-12'), '2026-11-09'); // Thursday
    assert.equal(weekStartOf('2026-11-09'), '2026-11-09'); // Monday itself
    assert.equal(weekStartOf('2026-11-15'), '2026-11-09'); // Sunday belongs to the week before
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-11-30', 1), '2026-12-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  });
});

describe('computeDashboardStats', () => {
  it('returns zeros for no workouts', () => {
    const s = computeDashboardStats([], TODAY);
    assert.equal(s.weekSessions, 0);
    assert.equal(s.weekVolumeKg, 0);
    assert.equal(s.streakDays, 0);
    assert.equal(s.weeklyVolume.length, 8);
    assert.deepEqual(s.muscleSplit, []);
    assert.deepEqual(s.recentPRs, []);
  });

  it('totals this week only and compares with last week', () => {
    const s = computeDashboardStats(
      [
        workout('2026-11-09', 'Bench Press', 'Chest', [[10, 60], [10, 60]]), // 1200, this week
        workout('2026-11-11', 'Squat', 'Legs', [[5, 100]]), // 500, this week
        workout('2026-11-05', 'Bench Press', 'Chest', [[10, 50]]), // 500, last week
        workout('2026-11-08', 'Row', 'Back', [[10, 40]]), // Sunday, last week: 400
      ],
      TODAY
    );
    assert.equal(s.weekSessions, 2);
    assert.equal(s.weekSets, 3);
    assert.equal(s.weekVolumeKg, 1700);
    assert.equal(s.lastWeekVolumeKg, 900);
    assert.equal(s.weeklyVolume[7].weekStart, '2026-11-09');
    assert.equal(s.weeklyVolume[7].volumeKg, 1700);
    assert.equal(s.weeklyVolume[6].volumeKg, 900);
  });

  it('counts two exercises on one day as a single session', () => {
    const s = computeDashboardStats(
      [workout('2026-11-10', 'Bench Press', 'Chest', [[10, 60]]), workout('2026-11-10', 'Fly', 'Chest', [[12, 20]])],
      TODAY
    );
    assert.equal(s.weekSessions, 1);
    assert.equal(s.weekSets, 2);
  });

  it('ignores a time suffix on the date', () => {
    const s = computeDashboardStats([workout('2026-11-10T00:00:00.000Z', 'Bench Press', 'Chest', [[10, 60]])], TODAY);
    assert.equal(s.weekSessions, 1);
  });
});

describe('streak', () => {
  const day = (d: string) => workout(d, 'Bench Press', 'Chest', [[10, 60]]);

  it('counts consecutive days ending today', () => {
    const s = computeDashboardStats([day('2026-11-12'), day('2026-11-11'), day('2026-11-10')], TODAY);
    assert.equal(s.streakDays, 3);
  });

  it('stays alive when you trained yesterday but not yet today', () => {
    const s = computeDashboardStats([day('2026-11-11'), day('2026-11-10')], TODAY);
    assert.equal(s.streakDays, 2);
  });

  it('breaks after a missed day', () => {
    const s = computeDashboardStats([day('2026-11-10'), day('2026-11-09')], TODAY);
    assert.equal(s.streakDays, 0);
  });

  it('stops at the first gap', () => {
    const s = computeDashboardStats([day('2026-11-12'), day('2026-11-11'), day('2026-11-09')], TODAY);
    assert.equal(s.streakDays, 2);
  });
});

describe('muscle split', () => {
  it('uses set counts over the last 30 days, biggest first', () => {
    const s = computeDashboardStats(
      [
        workout('2026-11-10', 'Bench Press', 'Chest', [[10, 60], [10, 60], [10, 60]]),
        workout('2026-11-11', 'Squat', 'Legs', [[5, 100]]),
        workout('2026-09-01', 'Row', 'Back', [[10, 40]]), // outside the window
      ],
      TODAY
    );
    assert.deepEqual(s.muscleSplit, [
      { muscleGroup: 'Chest', sets: 3, percent: 75 },
      { muscleGroup: 'Legs', sets: 1, percent: 25 },
    ]);
  });
});

describe('personal records', () => {
  it('flags a session that beats every earlier top set', () => {
    const s = computeDashboardStats(
      [
        workout('2026-10-01', 'Bench Press', 'Chest', [[5, 80]]),
        workout('2026-11-10', 'Bench Press', 'Chest', [[5, 85]]),
      ],
      TODAY
    );
    assert.deepEqual(s.recentPRs, [{ exercise: 'Bench Press', date: '2026-11-10', weightKg: 85, previousKg: 80 }]);
  });

  it('does not treat the first logged session as a PR', () => {
    const s = computeDashboardStats([workout('2026-11-10', 'Bench Press', 'Chest', [[5, 85]])], TODAY);
    assert.deepEqual(s.recentPRs, []);
  });

  it('does not flag ties or lighter sessions', () => {
    const s = computeDashboardStats(
      [
        workout('2026-10-01', 'Bench Press', 'Chest', [[5, 80]]),
        workout('2026-11-09', 'Bench Press', 'Chest', [[5, 80]]),
        workout('2026-11-10', 'Bench Press', 'Chest', [[5, 70]]),
      ],
      TODAY
    );
    assert.deepEqual(s.recentPRs, []);
  });

  it('leaves out PRs set before the 30-day window', () => {
    const s = computeDashboardStats(
      [
        workout('2026-08-01', 'Bench Press', 'Chest', [[5, 80]]),
        workout('2026-09-01', 'Bench Press', 'Chest', [[5, 90]]),
      ],
      TODAY
    );
    assert.deepEqual(s.recentPRs, []);
  });

  it('does not let same-day entries beat each other', () => {
    const s = computeDashboardStats(
      [
        workout('2026-10-01', 'Bench Press', 'Chest', [[5, 80]]),
        workout('2026-11-10', 'Bench Press', 'Chest', [[5, 70]]),
        workout('2026-11-10', 'Bench Press', 'Chest', [[5, 75]]),
      ],
      TODAY
    );
    assert.deepEqual(s.recentPRs, []);
  });
});

describe('recent workouts', () => {
  it('returns the five most recent, newest first', () => {
    const list = ['01', '02', '03', '04', '05', '06', '07'].map((d) =>
      workout(`2026-11-${d}`, 'Bench Press', 'Chest', [[10, 60]])
    );
    const s = computeDashboardStats(list, TODAY);
    assert.deepEqual(
      s.recentWorkouts.map((w) => w.date),
      ['2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03']
    );
  });
});
