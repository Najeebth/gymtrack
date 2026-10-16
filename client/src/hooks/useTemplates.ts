import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { deleteTemplateApi, fetchTemplatesApi, saveTemplateApi } from '../api/templates';
import type { Template, TemplateDraft } from '../types';

/**
 * Modern TanStack Query hook for workout templates.
 * Provides shared in-memory caching between TemplatesPage and WorkoutsPage,
 * background revalidation, and optimistic updates for deletion and creation.
 */
export function useTemplates() {
  const { authToken } = useAppData();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['templates'];

  // 1. Intelligent cached fetch for templates
  const {
    data: templates = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<Template[]>({
    queryKey,
    queryFn: async () => {
      if (!authToken) return [];
      return fetchTemplatesApi(authToken);
    },
    enabled: Boolean(authToken),
  });

  // User-friendly error message format matching previous behavior
  const loadError = error
    ? navigator.onLine
      ? (error as Error).message
      : "You're offline — templates will load when you reconnect."
    : null;

  // 2. Save mutation (handles both create and update)
  const saveMutation = useMutation({
    mutationFn: async ({ draft, id }: { draft: TemplateDraft; id?: string }) => {
      if (!authToken) throw new Error('Not logged in');
      return saveTemplateApi(authToken, draft, id);
    },
    onSuccess: (_saved, variables) => {
      showToast(variables.id ? 'Template updated' : 'Template saved', 'success');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 3. Optimistic Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!authToken) throw new Error('Not logged in');
      await deleteTemplateApi(authToken, id);
      return id;
    },
    onMutate: async (deletedId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousTemplates = queryClient.getQueryData<Template[]>(queryKey);

      // Optimistically filter out the template
      queryClient.setQueryData<Template[]>(queryKey, (old = []) =>
        old.filter((t) => t.id !== deletedId)
      );

      return { previousTemplates };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(queryKey, context.previousTemplates);
      }
      showToast(
        navigator.onLine ? 'Failed to delete template' : "You're offline — can't delete right now",
        'error'
      );
    },
    onSuccess: () => {
      showToast('Template deleted', 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Preserve backwards-compatible helper signatures
  const saveTemplate = async (draft: TemplateDraft, id?: string): Promise<string | null> => {
    try {
      await saveMutation.mutateAsync({ draft, id });
      return null;
    } catch (err) {
      return navigator.onLine
        ? (err as Error).message
        : "You're offline — try again when you reconnect.";
    }
  };

  const removeTemplate = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // Error handled in onError callback
    }
  };

  return {
    templates,
    loading,
    loadError,
    saveTemplate,
    removeTemplate,
    refetch,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
