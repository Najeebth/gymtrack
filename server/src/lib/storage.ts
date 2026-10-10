import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  B2_ACCESS_KEY_ID,
  B2_SECRET_ACCESS_KEY,
  B2_REGION,
  B2_BUCKET,
  B2_ENDPOINT,
} from '../config/env.js';

/**
 * S3 Client configured for Backblaze B2.
 * Backblaze B2 is 100% S3-compatible, using the official AWS SDK v3.
 */
export const s3Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_ACCESS_KEY_ID,
    secretAccessKey: B2_SECRET_ACCESS_KEY,
  },
});

/**
 * Uploads an in-memory buffer directly to Backblaze B2 (zero local disk writes).
 * Returns the storage key (e.g. "avatars/userId-1234.png").
 */
export async function uploadAvatarToStorage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `avatars/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

/**
 * Generates a temporary signed URL for a private bucket file.
 * Valid for 24 hours (86,400 seconds).
 * Matches the Laravel ImageUploadService temporaryUrl() pattern!
 */
export async function getSignedAvatarUrl(
  keyOrUrl: string | null | undefined
): Promise<string | null> {
  if (!keyOrUrl) return null;

  try {
    let key = keyOrUrl;
    if (keyOrUrl.includes('/avatars/')) {
      key = 'avatars/' + keyOrUrl.split('/avatars/')[1].split('?')[0];
    }

    const command = new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 86400 });
  } catch (err) {
    console.error('Failed to generate signed avatar URL:', err);
    return null;
  }
}

/**
 * Deletes an old avatar from cloud storage to keep the bucket tidy.
 */
export async function deleteAvatarFromStorage(keyOrUrl: string): Promise<void> {
  try {
    let key = keyOrUrl;
    if (keyOrUrl.includes('/avatars/')) {
      key = 'avatars/' + keyOrUrl.split('/avatars/')[1].split('?')[0];
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: B2_BUCKET,
        Key: key,
      })
    );
  } catch (err) {
    console.warn('Could not delete old avatar from storage (non-fatal):', err);
  }
}
