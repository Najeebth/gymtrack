import type { Request, Response } from 'express';
import path from 'path';
import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';
import {
  uploadAvatarToStorage,
  deleteAvatarFromStorage,
  getSignedAvatarUrl,
} from '../lib/storage.js';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await dbTrace('getProfile', () =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, avatarUrl: true, createdAt: true },
    })
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Generate signed URL for private Backblaze B2 bucket access
  const signedAvatarUrl = await getSignedAvatarUrl(user.avatarUrl);

  res.json({
    ...user,
    avatarUrl: signedAvatarUrl,
  });
}

export async function updateAvatar(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No image file uploaded' });
    return;
  }

  try {
    // 1. Fetch current avatar to delete it later if it exists
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // 2. Generate unique filename with extension
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const fileName = `${userId}-${Date.now()}${ext}`;

    // 3. Upload in-memory buffer straight to Backblaze B2 (zero disk writes!)
    const key = await uploadAvatarToStorage(
      req.file.buffer,
      fileName,
      req.file.mimetype
    );

    // 4. Update avatarUrl in database with the key
    await dbTrace('update avatarUrl', () =>
      prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: key },
      })
    );

    // 5. Delete previous avatar from cloud if there was one
    if (currentUser?.avatarUrl) {
      deleteAvatarFromStorage(currentUser.avatarUrl).catch((err) =>
        console.warn('Old avatar cleanup failed:', err)
      );
    }

    // 6. Generate temporary signed URL to return to client
    const signedAvatarUrl = await getSignedAvatarUrl(key);

    res.json({
      message: 'Avatar updated successfully',
      avatarUrl: signedAvatarUrl,
    });
  } catch (err: any) {
    console.error('Failed to upload avatar to Backblaze B2:', err);
    res.status(500).json({
      error: 'Failed to upload avatar to cloud storage',
      message: err?.message,
    });
  }
}

export async function removeAvatar(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl) {
      await deleteAvatarFromStorage(user.avatarUrl);
    }

    await dbTrace('remove avatarUrl', () =>
      prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      })
    );

    res.json({ message: 'Avatar removed successfully', avatarUrl: null });
  } catch (err: any) {
    console.error('Failed to remove avatar:', err);
    res.status(500).json({ error: 'Failed to remove avatar' });
  }
}
