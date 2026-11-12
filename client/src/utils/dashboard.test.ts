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
    expect(weekStartOf('2026-11-12')).toBe('2026-11-09'); // Thursday
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09'); // Monday itself
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09'); // Sunday belongs to the week before
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('computeDashboardStats', () => {
  it('returns zeros for no workouts', () => {
    const s = computeDashboardStats([], TODAY);
    expect(s.weekSessions).toBe(0);
    expect(s.weekVolumeKg).toBe(0);
    expect(s.streakDays).toBe(0);
    expect(s.weeklyVolume.length).toBe(8);
    expect(s.muscleSplit).toEqual([]);
    expect(s.recentPRs).toEqual([]);
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
    expect(s.weekSessions).toBe(2);
    expect(s.weekSets).toBe(3);
    expect(s.weekVolumeKg).toBe(1700);
    expect(s.lastWeekVolumeKg).toBe(900);
    expect(s.weeklyVolume[7].weekStart).toBe('2026-11-09');
    expect(s.weeklyVolume[7].volumeKg).toBe(1700);
    expect(s.weeklyVolume[6].volumeKg).toBe(900);
  });

  it('counts two exercises on one day as a single session', () => {
    const s = computeDashboardStats(
      [workout('2026-11-10', 'Bench Press', 'Chest', [[10, 60]]), workout('2026-11-10', 'Fly', 'Chest', [[12, 20]])],
      TODAY
    );
    expect(s.weekSessions).toBe(1);
    expect(s.weekSets).toBe(2);
  });

  it('ignores a time suffix on the date', () => {
    const s = computeDashboardStats([workout('2026-11-10T00:00:00.000Z', 'Bench Press', 'Chest', [[10, 60]])], TODAY);
    expect(s.weekSessions).toBe(1);
  });
});

describe('streak', () => {
  const day = (d: string) => workout(d, 'Bench Press', 'Chest', [[10, 60]]);

  it('counts consecutive days ending today', () => {
    const s = computeDashboardStats([day('2026-11-12'), day('2026-11-11'), day('2026-11-10')], TODAY);
    expect(s.streakDays).toBe(3);
  });

  it('stays alive when you trained yesterday but not yet today', () => {
    const s = computeDashboardStats([day('2026-11-11'), day('2026-11-10')], TODAY);
    expect(s.streakDays).toBe(2);
  });

  it('breaks after a missed day', () => {
    const s = computeDashboardStats([day('2026-11-10'), day('2026-11-09')], TODAY);
    expect(s.streakDays).toBe(0);
  });

  it('stops at the first gap', () => {
    const s = computeDashboardStats([day('2026-11-12'), day('2026-11-11'), day('2026-11-09')], TODAY);
    expect(s.streakDays).toBe(2);
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
    expect(s.muscleSplit).toEqual([
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
    expect(s.recentPRs).toEqual([{ exercise: 'Bench Press', date: '2026-11-10', weightKg: 85, previousKg: 80 }]);
  });

  it('does not treat the first logged session as a PR', () => {
    const s = computeDashboardStats([workout('2026-11-10', 'Bench Press', 'Chest', [[5, 85]])], TODAY);
    expect(s.recentPRs).toEqual([]);
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
    expect(s.recentPRs).toEqual([]);
  });

  it('leaves out PRs set before the 30-day window', () => {
    const s = computeDashboardStats(
      [
        workout('2026-08-01', 'Bench Press', 'Chest', [[5, 80]]),
        workout('2026-09-01', 'Bench Press', 'Chest', [[5, 90]]),
      ],
      TODAY
    );
    expect(s.recentPRs).toEqual([]);
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
    expect(s.recentPRs).toEqual([]);
  });
});

describe('recent workouts', () => {
  it('returns the five most recent, newest first', () => {
    const list = ['01', '02', '03', '04', '05', '06', '07'].map((d) =>
      workout(`2026-11-${d}`, 'Bench Press', 'Chest', [[10, 60]])
    );
    const s = computeDashboardStats(list, TODAY);
    expect(s.recentWorkouts.map((w) => w.date)).toEqual(['2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03']);
  });
});
