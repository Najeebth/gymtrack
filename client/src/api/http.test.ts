import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch, errorMessage, setUnauthorizedHandler } from './http';
import { API_BASE } from './config';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe('authFetch', () => {
  it('sends the bearer token to the API base URL', async () => {
    await authFetch('abc123', '/api/workouts');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/workouts`);
    expect(init.headers.Authorization).toBe('Bearer abc123');
  });

  it('sends no body or content type for a plain GET', async () => {
    await authFetch('t', '/api/workouts');

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('sends JSON with the right header and the chosen method', async () => {
    await authFetch('t', '/api/workouts', { method: 'POST', json: { exercise: 'Squat', sets: [{ reps: 5 }] } });

    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ exercise: 'Squat', sets: [{ reps: 5 }] });
  });

  it('still sends falsy JSON values such as 0 or an empty object', async () => {
    await authFetch('t', '/x', { method: 'PUT', json: 0 });
    await authFetch('t', '/x', { method: 'PUT', json: {} });

    expect(fetchMock.mock.calls[0][1].body).toBe('0');
    expect(fetchMock.mock.calls[1][1].body).toBe('{}');
  });

  it('returns the response untouched', async () => {
    const response = new Response('{"ok":true}', { status: 201 });
    fetchMock.mockResolvedValue(response);

    expect(await authFetch('t', '/x')).toBe(response);
  });

  it('lets network errors propagate to the caller', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(authFetch('t', '/x')).rejects.toThrow('Failed to fetch');
  });

  describe('when the server rejects the session', () => {
    it('calls the unauthorized handler on a 401', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

      const res = await authFetch('expired', '/api/workouts');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(401); // the caller still sees the response
    });

    it.each([200, 400, 403, 404, 500])('does not call it for a %i', async (status) => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      fetchMock.mockResolvedValue(new Response('{}', { status }));

      await authFetch('t', '/x');

      expect(handler).not.toHaveBeenCalled();
    });

    it('does nothing, and does not crash, when no handler is registered', async () => {
      fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

      await expect(authFetch('t', '/x')).resolves.toHaveProperty('status', 401);
    });

    it('stops calling a handler that was removed', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      setUnauthorizedHandler(null);
      fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

      await authFetch('t', '/x');

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('errorMessage', () => {
  it("returns the server's error message", async () => {
    const res = new Response(JSON.stringify({ error: 'Weight must be non-negative' }), { status: 400 });

    expect(await errorMessage(res, 'Something went wrong')).toBe('Weight must be non-negative');
  });

  it('falls back when the body has no error field', async () => {
    expect(await errorMessage(new Response('{"message":"hi"}'), 'Fallback')).toBe('Fallback');
  });

  it('falls back when the error is not a string', async () => {
    expect(await errorMessage(new Response('{"error":{"code":1}}'), 'Fallback')).toBe('Fallback');
  });

  it('falls back when the body is not JSON', async () => {
    expect(await errorMessage(new Response('<html>Bad gateway</html>', { status: 502 }), 'Fallback')).toBe('Fallback');
  });

  it('falls back when the body is empty', async () => {
    expect(await errorMessage(new Response(null, { status: 500 }), 'Fallback')).toBe('Fallback');
  });
});
