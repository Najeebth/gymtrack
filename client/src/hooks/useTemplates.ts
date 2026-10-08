import { useCallback, useEffect, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { deleteTemplateApi, fetchTemplatesApi, saveTemplateApi } from '../api/templates';
import type { Template, TemplateDraft } from '../types';

// The logged-in user's workout templates, plus save/delete. Loading problems
// are reported through `loadError` so each page decides how loudly to show them.
export function useTemplates() {
  const { authToken } = useAppData();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!authToken) return;
    try {
      setTemplates(await fetchTemplatesApi(authToken));
      setLoadError(null);
    } catch (err) {
      setLoadError(navigator.onLine ? (err as Error).message : "You're offline — templates will load when you reconnect.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Returns an error message, or null when the save went through.
  const saveTemplate = useCallback(async (draft: TemplateDraft, id?: string): Promise<string | null> => {
    if (!authToken) return 'Not logged in';
    try {
      const saved = await saveTemplateApi(authToken, draft, id);
      setTemplates((prev) => (id ? prev.map((t) => (t.id === id ? saved : t)) : [...prev, saved]));
      showToast(id ? 'Template updated' : 'Template saved', 'success');
      return null;
    } catch (err) {
      return navigator.onLine ? (err as Error).message : "You're offline — try again when you reconnect.";
    }
  }, [authToken, showToast]);

  const removeTemplate = useCallback(async (id: string) => {
    if (!authToken) return;
    try {
      await deleteTemplateApi(authToken, id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      showToast('Template deleted', 'success');
    } catch (err) {
      showToast(navigator.onLine ? (err as Error).message : "You're offline — can't delete right now", 'error');
    }
  }, [authToken, showToast]);

  return { templates, loading, loadError, saveTemplate, removeTemplate };
}
