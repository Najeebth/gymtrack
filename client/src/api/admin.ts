import { API_BASE } from './config';
import type { TrafficLogEntry, HealthData } from '../types';

export async function fetchTrafficApi(adminToken: string): Promise<TrafficLogEntry[]> {
  const res = await fetch(`${API_BASE}/api/traffic`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.requests || [];
}

export async function fetchHealthApi(adminToken: string): Promise<HealthData | null> {
  const res = await fetch(`${API_BASE}/api/health`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (!res.ok) return null;
  return res.json();
}

export interface LoginResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export async function loginApi(username: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) return { ok: true, token: data.token };
    return { ok: false, error: data.error || 'Login failed' };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
