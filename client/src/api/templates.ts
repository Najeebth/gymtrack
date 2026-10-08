import { authFetch, errorMessage } from './http';
import type { Template, TemplateDraft } from '../types';

export async function fetchTemplatesApi(token: string): Promise<Template[]> {
  const res = await authFetch(token, '/api/templates');
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load templates'));
  return res.json();
}

// Creates the template, or replaces it when `id` is given.
export async function saveTemplateApi(token: string, draft: TemplateDraft, id?: string): Promise<Template> {
  const res = await authFetch(token, id ? `/api/templates/${id}` : '/api/templates', {
    method: id ? 'PUT' : 'POST',
    json: draft
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to save template'));
  return res.json();
}

export async function deleteTemplateApi(token: string, id: string): Promise<void> {
  const res = await authFetch(token, `/api/templates/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to delete template'));
}
