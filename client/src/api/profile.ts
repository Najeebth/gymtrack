import { authFetch, errorMessage } from './http';
import { API_BASE } from './config';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

export async function fetchProfileApi(token: string): Promise<UserProfile> {
  const res = await authFetch(token, '/api/profile');
  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Failed to load profile'));
  }
  return res.json();
}

export async function uploadAvatarApi(
  token: string,
  file: File
): Promise<{ avatarUrl: string; message: string }> {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Do not set Content-Type; browser automatically sets boundary for multipart/form-data
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Failed to upload avatar to cloud'));
  }
  return res.json();
}

export async function removeAvatarApi(token: string): Promise<void> {
  const res = await authFetch(token, '/api/profile/avatar', {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Failed to remove avatar'));
  }
}

