import { API_BASE } from './config';

export interface AuthResult {
  ok: boolean;
  token?: string;
  error?: string;
}

async function postCredentials(path: 'login' | 'signup', email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) return { ok: true, token: data.token };
    return { ok: false, error: data.error || (path === 'login' ? 'Login failed' : 'Signup failed') };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

// Shared by both the member login/signup page and the admin login form —
// the server doesn't distinguish the endpoint by role, only the account's
// own `role` field (carried back in the JWT) does.
export function loginApi(email: string, password: string): Promise<AuthResult> {
  return postCredentials('login', email, password);
}

export function signupApi(email: string, password: string): Promise<AuthResult> {
  return postCredentials('signup', email, password);
}
