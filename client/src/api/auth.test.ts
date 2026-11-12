import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginApi, signupApi } from './auth';
import { API_BASE } from './config';

const fetchMock = vi.fn();

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  ['loginApi', loginApi, 'login', 'Login failed'],
  ['signupApi', signupApi, 'signup', 'Signup failed'],
] as const)('%s', (_name, call, path, genericError) => {
  it(`posts the credentials as JSON to /api/auth/${path}`, async () => {
    fetchMock.mockResolvedValue(reply(200, { token: 't' }));

    await call('a@b.co', 'secret');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/auth/${path}`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co', password: 'secret' });
  });

  it('does not send an Authorization header, since the user has no token yet', async () => {
    fetchMock.mockResolvedValue(reply(200, { token: 't' }));

    await call('a@b.co', 'secret');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('returns the token on success', async () => {
    fetchMock.mockResolvedValue(reply(200, { token: 'jwt-token', email: 'a@b.co' }));

    expect(await call('a@b.co', 'secret')).toEqual({ ok: true, token: 'jwt-token' });
  });

  it("returns the server's error message on failure", async () => {
    fetchMock.mockResolvedValue(reply(401, { error: 'Invalid credentials' }));

    expect(await call('a@b.co', 'wrong')).toEqual({ ok: false, error: 'Invalid credentials' });
  });

  it('uses a generic message when the server gives none', async () => {
    fetchMock.mockResolvedValue(reply(500, {}));

    expect(await call('a@b.co', 'secret')).toEqual({ ok: false, error: genericError });
  });

  it('reports a network error instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await call('a@b.co', 'secret')).toEqual({ ok: false, error: 'Network error' });
  });

  it('reports a network error when the response is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    expect(await call('a@b.co', 'secret')).toEqual({ ok: false, error: 'Network error' });
  });
});

describe('signupApi', () => {
  it('surfaces a duplicate-account conflict', async () => {
    fetchMock.mockResolvedValue(reply(409, { error: 'An account with that email already exists' }));

    expect(await signupApi('taken@b.co', 'secret')).toEqual({
      ok: false,
      error: 'An account with that email already exists',
    });
  });
});
