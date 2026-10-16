import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { fetchTrafficApi, fetchHealthApi, fetchUsersApi, deleteUserApi } from '../api/admin';
import type { TrafficLogEntry, HealthData, AdminUser } from '../types';

/**
 * Modern TanStack Query hooks for Admin operations:
 * - Real-time traffic polling with intelligent tab-focus pausing
 * - Health telemetry diagnostics
 * - Admin users management with optimistic deletion
 */

export function useTrafficQuery() {
  const { authToken, isAdmin } = useAppData();

  return useQuery<TrafficLogEntry[]>({
    queryKey: ['admin', 'traffic'],
    queryFn: async () => {
      if (!authToken) return [];
      return fetchTrafficApi(authToken);
    },
    enabled: Boolean(authToken && isAdmin),
    refetchInterval: 2500, // Poll every 2.5 seconds
    refetchIntervalInBackground: false, // Automatically pause when tab is in background!
  });
}

export function useHealthQuery() {
  const { authToken, isAdmin } = useAppData();

  return useQuery<HealthData | null>({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      if (!authToken) return null;
      return fetchHealthApi(authToken);
    },
    enabled: Boolean(authToken && isAdmin),
    refetchInterval: 10000, // Poll health telemetry every 10s
    refetchIntervalInBackground: false,
  });
}

export function useAdminUsersQuery() {
  const { authToken, isAdmin } = useAppData();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['admin', 'users'];

  const {
    data: users = null,
    isLoading,
    error,
    refetch,
  } = useQuery<AdminUser[]>({
    queryKey,
    queryFn: async () => {
      if (!authToken) return [];
      return fetchUsersApi(authToken);
    },
    enabled: Boolean(authToken && isAdmin),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!authToken) throw new Error('Not authenticated');
      await deleteUserApi(authToken, userId);
      return userId;
    },
    onMutate: async (deletedId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousUsers = queryClient.getQueryData<AdminUser[]>(queryKey);

      queryClient.setQueryData<AdminUser[]>(queryKey, (old = []) =>
        old.filter((u) => u.id !== deletedId)
      );

      return { previousUsers };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKey, context.previousUsers);
      }
      showToast('Failed to delete user', 'error');
    },
    onSuccess: () => {
      showToast('User deleted', 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    users,
    loading: isLoading,
    loadError: error ? (error as Error).message : null,
    refetch,
    deleteUser: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

