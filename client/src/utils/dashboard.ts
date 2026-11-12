import type { Workout } from '../types';

// Pure number-crunching for the dashboard page. Everything is derived from the
// workouts list the app already loads, so the dashboard needs no API of its own
// and stays live through the same Socket.IO cache invalidation as other pages.
//
// Dates are 'YYYY-MM-DD' strings handled as *local* calendar days (never via
// toISOString, which is UTC and shifts the day for users east of Greenwich).

export interface WeekBucket {
  /** Monday of the week, 'YYYY-MM-DD'. */
  weekStart: string;
  /** Short label for the chart axis, e.g. "Nov 10". */
  label: string;
  volumeKg: number;
}

export interface MuscleShare {
  muscleGroup: string;
  sets: number;
  /** Whole-number percentage of all sets in the window. */
  percent: number;
}

export interface PersonalRecord {
  exercise: string;
  date: string;
  weightKg: number;
  /** The previous best for this exercise, before this session. */
  previousKg: number;
}

export interface DashboardStats {
  weekSessions: number;
  weekSets: number;
  weekVolumeKg: number;
  lastWeekVolumeKg: number;
  streakDays: number;
  weeklyVolume: WeekBucket[];
  muscleSplit: MuscleShare[];
  recentPRs: PersonalRecord[];
  recentWorkouts: Workout[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** The Monday on or before the given day. */
export function weekStartOf(key: string): string {
  const d = parseKey(key);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return toKey(d);
}

function dayOf(w: Workout): string {
  return (w.date || '').slice(0, 10);
}

export function workoutVolume(w: Workout): number {
  return (w.sets || []).reduce((sum, s) => sum + (s.reps || 0) * (s.weightKg || 0), 0);
}

function topWeight(w: Workout): number {
  return (w.sets || []).reduce((m, s) => Math.max(m, s.weightKg || 0), 0);
}

/**
 * Consecutive days with at least one workout. A streak is still alive if you
 * trained yesterday but haven't yet today, so it only breaks once a full day
 * is missed.
 */
function computeStreak(days: Set<string>, today: string): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * A PR is a session whose heaviest set beats everything the user lifted for
 * that exercise on earlier days. The first time an exercise is ever logged is
 * a baseline, not a PR.
 */
function computeRecentPRs(workouts: Workout[], sinceKey: string, limit: number): PersonalRecord[] {
  const byExercise = new Map<string, Workout[]>();
  for (const w of workouts) {
    if (!w.exercise) continue;
    const list = byExercise.get(w.exercise) ?? [];
    list.push(w);
    byExercise.set(w.exercise, list);
  }

  const prs: PersonalRecord[] = [];
  for (const [exercise, list] of byExercise) {
    const sorted = [...list].sort((a, b) => dayOf(a).localeCompare(dayOf(b)));
    let best = 0;
    let i = 0;
    while (i < sorted.length) {
      // Treat all sessions on one day together so same-day entries can't beat each other.
      const day = dayOf(sorted[i]);
      let dayTop = 0;
      while (i < sorted.length && dayOf(sorted[i]) === day) {
        dayTop = Math.max(dayTop, topWeight(sorted[i]));
        i++;
      }
      if (best > 0 && dayTop > best && day >= sinceKey) {
        prs.push({ exercise, date: day, weightKg: dayTop, previousKg: best });
      }
      best = Math.max(best, dayTop);
    }
  }

  return prs.sort((a, b) => b.date.localeCompare(a.date) || b.weightKg - a.weightKg).slice(0, limit);
}

export function computeDashboardStats(workouts: Workout[], today: string): DashboardStats {
  const thisWeekStart = weekStartOf(today);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const lastWeekStart = addDays(thisWeekStart, -7);

  const volumeByWeek = new Map<string, number>();
  const trainingDays = new Set<string>();
  const weekDays = new Set<string>();
  let weekSets = 0;
  let weekVolumeKg = 0;

  for (const w of workouts) {
    const day = dayOf(w);
    if (!day) continue;
    const volume = workoutVolume(w);
    trainingDays.add(day);
    const start = weekStartOf(day);
    volumeByWeek.set(start, (volumeByWeek.get(start) ?? 0) + volume);

    if (day >= thisWeekStart && day < nextWeekStart) {
      weekDays.add(day);
      weekSets += (w.sets || []).length;
      weekVolumeKg += volume;
    }
  }

  const weeklyVolume: WeekBucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = addDays(thisWeekStart, -7 * i);
    const d = parseKey(weekStart);
    weeklyVolume.push({
      weekStart,
      label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      volumeKg: volumeByWeek.get(weekStart) ?? 0,
    });
  }

  // Muscle-group balance over the last 30 days, by set count (volume would
  // always crown legs).
  const windowStart = addDays(today, -29);
  const setsByGroup = new Map<string, number>();
  let windowSets = 0;
  for (const w of workouts) {
    const day = dayOf(w);
    if (day < windowStart || day > today) continue;
    const count = (w.sets || []).length;
    if (count === 0) continue;
    const group = w.muscleGroup || 'Other';
    setsByGroup.set(group, (setsByGroup.get(group) ?? 0) + count);
    windowSets += count;
  }
  const muscleSplit: MuscleShare[] = [...setsByGroup.entries()]
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets, percent: Math.round((sets / windowSets) * 100) }))
    .sort((a, b) => b.sets - a.sets);

  const recentWorkouts = [...workouts]
    .filter((w) => dayOf(w))
    .sort((a, b) => dayOf(b).localeCompare(dayOf(a)))
    .slice(0, 5);

  return {
    weekSessions: weekDays.size,
    weekSets,
    weekVolumeKg,
    lastWeekVolumeKg: volumeByWeek.get(lastWeekStart) ?? 0,
    streakDays: computeStreak(trainingDays, today),
    weeklyVolume,
    muscleSplit,
    recentPRs: computeRecentPRs(workouts, windowStart, 5),
    recentWorkouts,
  };
}
