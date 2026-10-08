import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { JWT_SECRET } from '../config/env.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    let admin = await prisma.admin.findUnique({ where: { username } });

    // Auto-create default admin if no admins exist at all
    if (!admin) {
      const adminCount = await prisma.admin.count();
      if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash(password, 10);
        admin = await prisma.admin.create({
          data: { username, password: hashedPassword },
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
