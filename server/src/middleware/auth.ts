import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';
import type { UserTokenPayload } from '../types/index.js';

// Verifies the bearer token, then loads the account it names. Returns the
// account, or writes a 401 and returns null. The lookup means a deleted
// account stops working at once (instead of when its token expires) and the
// role is always the current one, not the one frozen into the token.
async function authenticate(req: Request, res: Response): Promise<UserTokenPayload | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return null;
  }

  let payload: UserTokenPayload;
  try {
    payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as UserTokenPayload;
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return null;
  }

  const user = await dbTrace('findUnique User (auth)', () =>
    prisma.user.findUnique({ where: { id: String(payload.id) }, select: { id: true, email: true, role: true } })
  );
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Account no longer exists' });
    return null;
  }
  return user;
}

function gate(adminOnly: boolean) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await authenticate(req, res);
      if (!user) return;
      if (adminOnly && user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: Admins only' });
        return;
      }
      req.user = user;
      next();
    } catch (err) {
      console.error('Auth check failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Any logged-in account (member or admin), e.g. the per-user workout endpoints.
export const requireAuth = gate(false);

// Admin-only tooling (health/traffic/traces/users).
export const requireAdmin = gate(true);
