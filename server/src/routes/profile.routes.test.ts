import request from 'supertest';

jest.mock('../db/prisma.js', () => ({ prisma: { user: { findUnique: jest.fn(), update: jest.fn() } } }));
jest.mock('../lib/redis.js', () => ({
  redis: null,
  isRedisConnected: () => false,
  cacheAside: (_key: string, _ttl: number, fetcher: () => unknown) => fetcher(),
  invalidateCachePattern: async () => {},
}));
jest.mock('../middleware/rateLimit.js', () => {
  const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return { loginRateLimit: passThrough, apiRateLimit: passThrough, chatRateLimit: passThrough };
});
// No real calls to Backblaze B2
jest.mock('../lib/storage.js', () => ({
  uploadAvatarToStorage: jest.fn(),
  deleteAvatarFromStorage: jest.fn(),
  getSignedAvatarUrl: jest.fn(),
}));

import { app } from '../app.js';
import { prisma } from '../db/prisma.js';
import { deleteAvatarFromStorage, getSignedAvatarUrl, uploadAvatarToStorage } from '../lib/storage.js';
import { MEMBER, bearer, silenceConsole, userLookup } from '../test/helpers.js';

const user = prisma.user as unknown as { findUnique: jest.Mock; update: jest.Mock };
const upload = uploadAvatarToStorage as unknown as jest.Mock;
const remove = deleteAvatarFromStorage as unknown as jest.Mock;
const sign = getSignedAvatarUrl as unknown as jest.Mock;

// A tiny but real PNG header is enough: multer only looks at the declared mimetype.
const png = Buffer.from('89504e470d0a1a0a', 'hex');

beforeEach(() => {
  silenceConsole();
  user.findUnique.mockReset().mockImplementation(userLookup(MEMBER));
  user.update.mockReset().mockResolvedValue({});
  upload.mockReset().mockResolvedValue('avatars/user-1-123.png');
  remove.mockReset().mockResolvedValue(undefined);
  sign.mockReset().mockImplementation(async (key: string | null) => (key ? `https://signed.example/${key}` : null));
});

describe('authentication', () => {
  it('requires a token on every route', async () => {
    expect((await request(app).get('/api/profile')).status).toBe(401);
    expect((await request(app).post('/api/profile/avatar')).status).toBe(401);
    expect((await request(app).delete('/api/profile/avatar')).status).toBe(401);
  });
});

describe('GET /api/profile', () => {
  it('returns the profile with a signed avatar URL', async () => {
    user.findUnique.mockImplementation(async () => ({ ...MEMBER, avatarUrl: 'avatars/old.png', createdAt: '2026-01-01' }));

    const res = await request(app).get('/api/profile').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: MEMBER.email, avatarUrl: 'https://signed.example/avatars/old.png' });
  });
});

describe('POST /api/profile/avatar', () => {
  it('uploads the image, stores its key and returns a signed URL', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .set(bearer(MEMBER))
      .attach('avatar', png, { filename: 'me.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe('https://signed.example/avatars/user-1-123.png');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][1]).toMatch(/^user-1-\d+\.png$/);
    expect(upload.mock.calls[0][2]).toBe('image/png');
    expect(user.update).toHaveBeenCalledWith({ where: { id: MEMBER.id }, data: { avatarUrl: 'avatars/user-1-123.png' } });
  });

  it('deletes the previous avatar from storage', async () => {
    // First call is the auth lookup, the second is the controller reading the old avatar.
    user.findUnique
      .mockImplementationOnce(userLookup(MEMBER))
      .mockResolvedValueOnce({ avatarUrl: 'avatars/previous.png' });

    await request(app)
      .post('/api/profile/avatar')
      .set(bearer(MEMBER))
      .attach('avatar', png, { filename: 'me.png', contentType: 'image/png' });

    expect(remove).toHaveBeenCalledWith('avatars/previous.png');
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/profile/avatar').set(bearer(MEMBER));

    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects a non-image upload without storing anything', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .set(bearer(MEMBER))
      .attach('avatar', Buffer.from('#!/bin/sh'), { filename: 'evil.sh', contentType: 'application/x-sh' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(upload).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it('rejects a file over 5 MB without storing anything', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .set(bearer(MEMBER))
      .attach('avatar', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns 500 when storage fails, without updating the database', async () => {
    upload.mockRejectedValue(new Error('B2 unreachable'));

    const res = await request(app)
      .post('/api/profile/avatar')
      .set(bearer(MEMBER))
      .attach('avatar', png, { filename: 'me.png', contentType: 'image/png' });

    expect(res.status).toBe(500);
    expect(user.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/profile/avatar', () => {
  it('removes the stored file and clears the avatar', async () => {
    user.findUnique.mockImplementationOnce(userLookup(MEMBER)).mockResolvedValueOnce({ avatarUrl: 'avatars/old.png' });

    const res = await request(app).delete('/api/profile/avatar').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeNull();
    expect(remove).toHaveBeenCalledWith('avatars/old.png');
    expect(user.update).toHaveBeenCalledWith({ where: { id: MEMBER.id }, data: { avatarUrl: null } });
  });

  it('is fine when there was no avatar', async () => {
    user.findUnique.mockImplementationOnce(userLookup(MEMBER)).mockResolvedValueOnce({ avatarUrl: null });

    const res = await request(app).delete('/api/profile/avatar').set(bearer(MEMBER));

    expect(res.status).toBe(200);
    expect(remove).not.toHaveBeenCalled();
  });
});
