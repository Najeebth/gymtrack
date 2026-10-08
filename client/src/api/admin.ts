import { authFetch, errorMessage } from './http';
import type { AdminUser, TrafficLogEntry, HealthData } from '../types';

// Admin-only tooling (traffic/health/users). Login/signup live in api/auth.ts
// since those endpoints aren't admin-specific.
export async function fetchTrafficApi(authToken: string): Promise<TrafficLogEntry[]> {
  const res = await authFetch(authToken, '/api/traffic');
  if (!res.ok) return [];
  const data = await res.json();
  return data.requests || [];
}

export async function fetchHealthApi(authToken: string): Promise<HealthData | null> {
  const res = await authFetch(authToken, '/api/health');
  if (!res.ok) return null;
  return res.json();
}

export async function fetchUsersApi(authToken: string): Promise<AdminUser[]> {
  const res = await authFetch(authToken, '/api/users');
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load users'));
  return res.json();
}

export async function deleteUserApi(authToken: string, id: string): Promise<void> {
  const res = await authFetch(authToken, `/api/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to delete user'));
}
