import { API_BASE } from './config';

let unauthorizedHandler: (() => void) | null = null;

// The app registers what to do when the server rejects the session (expired
// token, deleted account): log out and send the user to the login screen.
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface AuthFetchInit {
  method?: string;
  json?: unknown;
}

// fetch() for endpoints that need a logged-in user. Login/signup don't use
// this: a 401 there just means wrong credentials.
export async function authFetch(token: string, path: string, { method, json }: AuthFetchInit = {}): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined
  });
  if (res.status === 401) unauthorizedHandler?.();
  return res;
}

// Reads the server's `{ error }` message from a failed response.
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === 'string' ? data.error : fallback;
  } catch {
    return fallback;
  }
}
