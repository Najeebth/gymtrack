import { API_BASE } from './config';
import type { Workout, WorkoutDraft } from '../types';

export async function fetchWorkoutsApi(date?: string): Promise<Workout[]> {
  const url = date ? `${API_BASE}/api/workouts?date=${encodeURIComponent(date)}` : `${API_BASE}/api/workouts`;
  const res = await fetch(url);
  return res.json();
}

export function createWorkoutApi(payload: WorkoutDraft): Promise<Response> {
  return fetch(`${API_BASE}/api/workouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function updateWorkoutApi(workoutId: string, fields: Pick<WorkoutDraft, 'date' | 'muscleGroup' | 'exercise' | 'notes'>): Promise<Response> {
  return fetch(`${API_BASE}/api/workouts/${workoutId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
}

export function deleteWorkoutApi(id: string): Promise<Response> {
  return fetch(`${API_BASE}/api/workouts/${id}`, { method: 'DELETE' });
}

export function deleteSetApi(workoutId: string, setId: string): Promise<Response> {
  return fetch(`${API_BASE}/api/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' });
}

export function updateSetApi(workoutId: string, setId: string, reps: number | string, weightKg: number | string): Promise<Response> {
  return fetch(`${API_BASE}/api/workouts/${workoutId}/sets/${setId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reps, weightKg })
  });
}

export function createSetApi(workoutId: string, reps: number | string, weightKg: number | string): Promise<Response> {
  return fetch(`${API_BASE}/api/workouts/${workoutId}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reps, weightKg })
  });
}
