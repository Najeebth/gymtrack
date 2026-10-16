import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import {
  fetchWorkoutsApi,
  createWorkoutApi,
  deleteWorkoutApi,
  updateWorkoutApi,
  deleteSetApi,
  createSetApi,
  updateSetApi,
} from '../api/workouts';
import type { Workout, WorkoutDraft } from '../types';

export interface RoutineResult {
  saved: number;
  queued: number;
  failed: number;
}

/**
 * Modern React Query hook for managing Workouts.
 * Provides caching, background revalidation, and optimistic updates.
 */
export function useWorkoutsQuery(filterDate?: string) {
  const { authToken } = useAppData();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = filterDate ? ['workouts', { date: filterDate }] : ['workouts'];

  // 1. Fetching workouts with intelligent caching
  const {
    data: workouts = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<Workout[]>({
    queryKey,
    queryFn: async () => {
      if (!authToken) return [];
      return fetchWorkoutsApi(authToken, filterDate);
    },
    enabled: Boolean(authToken),
  });

  // 2. Optimistic Mutation: Delete Workout
  const deleteMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      if (!authToken) throw new Error('Not authenticated');
      const res = await deleteWorkoutApi(authToken, workoutId);
      if (!res.ok) throw new Error('Failed to delete workout');
      return workoutId;
    },
    onMutate: async (deletedId: string) => {
      await queryClient.cancelQueries({ queryKey: ['workouts'] });
      const previousWorkouts = queryClient.getQueryData<Workout[]>(queryKey);

      queryClient.setQueryData<Workout[]>(queryKey, (old = []) =>
        old.filter((w) => w.id !== deletedId)
      );

      return { previousWorkouts };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousWorkouts) {
        queryClient.setQueryData(queryKey, context.previousWorkouts);
      }
      showToast('Failed to delete workout. Restored.', 'error');
    },
    onSuccess: () => {
      showToast('Workout deleted', 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });

  // 3. Optimistic Mutation: Create Workout
  const createMutation = useMutation({
    mutationFn: async (draft: WorkoutDraft) => {
      if (!authToken) throw new Error('Not authenticated');
      const res = await createWorkoutApi(authToken, draft);
      if (!res.ok) throw new Error('Failed to create workout');
      return res.json() as Promise<Workout>;
    },
    onMutate: async (draft: WorkoutDraft) => {
      await queryClient.cancelQueries({ queryKey: ['workouts'] });
      const previousWorkouts = queryClient.getQueryData<Workout[]>(queryKey);

      const tempId = `temp-${Date.now()}`;
      const optimisticWorkout: Workout = {
        id: tempId,
        date: draft.date,
        muscleGroup: draft.muscleGroup,
        exercise: draft.exercise,
        notes: draft.notes,
        sets: draft.sets.map((s, idx) => ({
          id: `temp-set-${idx}`,
          reps: Number(s.reps) || 0,
          weightKg: Number(s.weightKg) || 0,
          setNumber: idx + 1,
        })),
      };

      queryClient.setQueryData<Workout[]>(queryKey, (old = []) => [optimisticWorkout, ...old]);

      return { previousWorkouts };
    },
    onError: (_err, _draft, context) => {
      if (context?.previousWorkouts) {
        queryClient.setQueryData(queryKey, context.previousWorkouts);
      }
      showToast('Failed to save workout', 'error');
    },
    onSuccess: () => {
      showToast('Workout saved', 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });

  // 4. Optimistic Mutation: Edit Workout & Sets
  const editMutation = useMutation({
    mutationFn: async ({ workout, editDraft }: { workout: Workout; editDraft: WorkoutDraft }) => {
      if (!authToken) throw new Error('Not authenticated');

      await updateWorkoutApi(authToken, workout.id, {
        date: editDraft.date,
        muscleGroup: editDraft.muscleGroup,
        exercise: editDraft.exercise,
        notes: editDraft.notes,
      });

      const originalIds = (workout.sets || []).map((s) => s.id);
      const keptIds = editDraft.sets.filter((s) => s.id).map((s) => s.id as string);
      const removedIds = originalIds.filter((id) => !keptIds.includes(id));
      await Promise.all(removedIds.map((setId) => deleteSetApi(authToken, workout.id, setId)));

      await Promise.all(
        editDraft.sets.map((s) =>
          s.id
            ? updateSetApi(authToken, workout.id, s.id, s.reps, s.weightKg)
            : createSetApi(authToken, workout.id, s.reps, s.weightKg)
        )
      );

      return { workoutId: workout.id, editDraft };
    },
    onMutate: async ({ workout, editDraft }) => {
      await queryClient.cancelQueries({ queryKey: ['workouts'] });
      const previousWorkouts = queryClient.getQueryData<Workout[]>(queryKey);

      const updatedWorkout: Workout = {
        ...workout,
        date: editDraft.date,
        muscleGroup: editDraft.muscleGroup,
        exercise: editDraft.exercise,
        notes: editDraft.notes,
        sets: editDraft.sets.map((s, i) => ({
          id: s.id || `local-set-${i}`,
          reps: Number(s.reps),
          weightKg: Number(s.weightKg),
        })),
      };

      queryClient.setQueryData<Workout[]>(queryKey, (old = []) =>
        old.map((w) => (w.id === workout.id ? updatedWorkout : w))
      );

      return { previousWorkouts };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousWorkouts) {
        queryClient.setQueryData(queryKey, context.previousWorkouts);
      }
      showToast('Failed to update workout', 'error');
    },
    onSuccess: () => {
      showToast('Workout updated', 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });

  // 5. Batch Routine Logging
  const logRoutine = async (drafts: WorkoutDraft[]): Promise<RoutineResult> => {
    const result: RoutineResult = { saved: 0, queued: 0, failed: 0 };
    if (!authToken) return result;

    for (const draft of drafts) {
      try {
        const res = await createWorkoutApi(authToken, draft);
        if (res.ok) {
          result.saved++;
        } else {
          result.failed++;
        }
      } catch {
        result.failed++;
      }
    }

    if (result.saved > 0) {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    }

    const plural = (n: number) => `${n} exercise${n === 1 ? '' : 's'}`;
    if (result.failed > 0) {
      showToast(`Logged ${result.saved} of ${plural(drafts.length)} — ${result.failed} failed`, 'error');
    } else {
      showToast(`Logged routine: ${plural(result.saved)}`, 'success');
    }

    return result;
  };

  const saveEditWorkout = async (workout: Workout, editDraft: WorkoutDraft): Promise<'saved' | 'queued'> => {
    await editMutation.mutateAsync({ workout, editDraft });
    return 'saved';
  };

  return {
    workouts,
    isLoading,
    isFetching,
    error,
    refetch,
    deleteWorkout: deleteMutation.mutateAsync,
    createWorkout: createMutation.mutateAsync,
    saveEditWorkout,
    logRoutine,
    isDeleting: deleteMutation.isPending,
    isCreating: createMutation.isPending,
    isEditing: editMutation.isPending,
  };
}
