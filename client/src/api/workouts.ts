import { authFetch } from './http';
import type { Workout, WorkoutDraft } from '../types';

export async function fetchWorkoutsApi(token: string, date?: string): Promise<Workout[]> {
  const res = await authFetch(token, date ? `/api/workouts?date=${encodeURIComponent(date)}` : '/api/workouts');
  if (!res.ok) throw new Error(`Failed to load workouts (${res.status})`);
  return res.json();
}

export function createWorkoutApi(token: string, payload: WorkoutDraft): Promise<Response> {
  return authFetch(token, '/api/workouts', { method: 'POST', json: payload });
}

export function updateWorkoutApi(token: string, workoutId: string, fields: Pick<WorkoutDraft, 'date' | 'muscleGroup' | 'exercise' | 'notes'>): Promise<Response> {
  return authFetch(token, `/api/workouts/${workoutId}`, { method: 'PUT', json: fields });
}

export function deleteWorkoutApi(token: string, id: string): Promise<Response> {
  return authFetch(token, `/api/workouts/${id}`, { method: 'DELETE' });
}

export function deleteSetApi(token: string, workoutId: string, setId: string): Promise<Response> {
  return authFetch(token, `/api/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' });
}

export function updateSetApi(token: string, workoutId: string, setId: string, reps: number | string, weightKg: number | string): Promise<Response> {
  return authFetch(token, `/api/workouts/${workoutId}/sets/${setId}`, { method: 'PUT', json: { reps, weightKg } });
}

export function createSetApi(token: string, workoutId: string, reps: number | string, weightKg: number | string): Promise<Response> {
  return authFetch(token, `/api/workouts/${workoutId}/sets`, { method: 'POST', json: { reps, weightKg } });
}
