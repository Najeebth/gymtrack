import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { fetchExercises, createExercise, deleteExercise } from '../api/exercises';
import type { ExerciseFilters, PaginatedResponse, Exercise } from '../types';

/**
 * Modern TanStack Query hook for exercises directory & autocomplete.
 * Features:
 * - Parameterized query keys: cached per filter combination
 * - keepPreviousData: smooth page transitions without flashing empty states
 * - Invalidation when adding or removing custom exercises
 */
export function useExercisesQuery(filters: ExerciseFilters = {}) {
  const { authToken } = useAppData();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['exercises', filters];

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<PaginatedResponse<Exercise>>({
    queryKey,
    queryFn: async () => {
      if (!authToken) throw new Error('Not authenticated');
      return fetchExercises(authToken, filters);
    },
    enabled: Boolean(authToken),
    // Keeps previous page data while fetching next page for smooth pagination
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; muscleGroup: string; equipment: string; notes?: string }) => {
      if (!authToken) throw new Error('Not authenticated');
      return createExercise(authToken, payload);
    },
    onSuccess: (newExercise) => {
      showToast(`Added "${newExercise.name}" to exercise library`, 'success');
      // Invalidate all exercise queries (regardless of filter variations)
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    onError: (err: Error) => {
      showToast(err.message || 'Failed to create exercise', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!authToken) throw new Error('Not authenticated');
      return deleteExercise(authToken, id);
    },
    onSuccess: () => {
      showToast('Exercise removed', 'success');
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    onError: (err: Error) => {
      showToast(err.message || 'Failed to delete exercise', 'error');
    },
  });

  return {
    exercises: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    isFetching,
    error: error ? (error as Error).message : null,
    refetch,
    createExercise: createMutation.mutateAsync,
    deleteExercise: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

