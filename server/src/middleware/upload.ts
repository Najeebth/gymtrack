import multer from 'multer';

/**
 * Memory storage keeps the uploaded file as a Buffer in RAM (req.file.buffer).
 * ZERO files are written to local disk.
 *
 * In NestJS, this is equivalent to:
 * @UseInterceptors(FileInterceptor('avatar', { storage: multer.memoryStorage() }))
 */
const storage = multer.memoryStorage();

export const uploadAvatar = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
  },
});

