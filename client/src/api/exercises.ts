import { authFetch, errorMessage } from './http';
import type { Exercise, ExerciseFilters, PaginatedResponse } from '../types';

export async function fetchExercises(
  token: string,
  filters: ExerciseFilters = {}
): Promise<PaginatedResponse<Exercise>> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.search) params.set('search', filters.search);
  if (filters.muscleGroup) params.set('muscleGroup', filters.muscleGroup);
  if (filters.equipment) params.set('equipment', filters.equipment);

  const qs = params.toString();
  const path = `/api/exercises${qs ? `?${qs}` : ''}`;
  const res = await authFetch(token, path);

  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Failed to fetch exercises'));
  }
  return res.json();
}

export async function createExercise(
  token: string,
  data: { name: string; muscleGroup: string; equipment: string; notes?: string }
): Promise<Exercise> {
  const res = await authFetch(token, '/api/exercises', {
    method: 'POST',
    json: data,
  });

  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Failed to create exercise'));
  }
  return res.json();
}

export async function deleteExercise(token: string, id: string): Promise<void> {
  const res = await authFetch(token, `/api/exercises/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Failed to delete exercise'));
  }
}

