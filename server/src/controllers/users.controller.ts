import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';

// GET every account with how much it has logged. Never returns password hashes.
export async function listUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await dbTrace('findMany User (with activity)', () =>
      prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { workouts: true, templates: true } },
          workouts: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
        },
      })
    );
    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        workoutCount: u._count.workouts,
        templateCount: u._count.templates,
        lastWorkoutDate: u.workouts[0]?.date ?? null,
      }))
    );
  } catch (err) {
    console.error('Error listing users:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
}

// DELETE an account and, via cascade, everything it owns. An admin cannot
// delete their own account, which also guarantees one admin always remains.
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (id === req.user!.id) {
    res.status(400).json({ error: "You can't delete your own account." });
    return;
  }

  try {
    const result = await dbTrace(`delete User id:${id}`, () => prisma.user.deleteMany({ where: { id } }));
    if (result.count === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}
