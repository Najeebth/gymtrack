import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Workout, WorkoutDraft, TrafficLogEntry, HealthData } from '../types';
import { fetchWorkoutsApi, createWorkoutApi, deleteWorkoutApi, deleteSetApi, updateSetApi, createSetApi, updateWorkoutApi } from '../api/workouts';
import { fetchTrafficApi, fetchHealthApi, loginApi } from '../api/admin';
import { addPendingWorkout, addPendingOperation, getAllPending, removePending, countPending } from '../offlineStore';
import type { PendingRecord } from '../types';
import { useToast } from './ToastContext';

interface AppDataContextValue {
  // Admin / auth
  adminToken: string | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;

  // Workouts (global list)
  workouts: Workout[];
  loading: boolean;
  lastApiLatency: string | null;
  fetchWorkouts: () => Promise<void>;
  createWorkout: (payload: WorkoutDraft) => Promise<'saved' | 'queued' | 'error'>;
  deleteWorkout: (id: string) => Promise<void>;
  saveEditWorkout: (workout: Workout, draft: WorkoutDraft) => Promise<'saved' | 'queued'>;

  // By-date workouts
  workoutsByDate: Workout[];
  fetchWorkoutsByDate: (date: string) => Promise<void>;

  // Offline state
  isOnline: boolean;
  pendingCount: number;

  // Admin data
  trafficLogs: TrafficLogEntry[];
  fetchTraffic: () => Promise<void>;
  healthData: HealthData | null;
  fetchHealth: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsByDate, setWorkoutsByDate] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastApiLatency, setLastApiLatency] = useState<string | null>(null);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLogEntry[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const data = await fetchWorkoutsApi();
      setWorkouts(data);
      setLastApiLatency((performance.now() - start).toFixed(1));
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkoutsByDate = useCallback(async (date: string) => {
    setLoading(true);
    const start = performance.now();
    try {
      const data = await fetchWorkoutsApi(date);
      setWorkoutsByDate(data);
      setLastApiLatency((performance.now() - start).toFixed(1));
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTraffic = useCallback(async () => {
    if (!adminToken) return;
    try {
      setTrafficLogs(await fetchTrafficApi(adminToken));
    } catch (err) {
      console.error('Traffic fetch error:', err);
    }
  }, [adminToken]);

  const fetchHealth = useCallback(async () => {
    if (!adminToken) return;
    try {
      setHealthData(await fetchHealthApi(adminToken));
    } catch (err) {
      console.error('Health fetch error:', err);
    }
  }, [adminToken]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const replayUpdate = async (item: PendingRecord) => {
    const { workoutId, editDraft, originalSetIds } = item;
    if (!workoutId || !editDraft || !originalSetIds) throw new Error('Malformed pending update');
    const res = await updateWorkoutApi(workoutId, {
      date: editDraft.date,
      muscleGroup: editDraft.muscleGroup,
      exercise: editDraft.exercise,
      notes: editDraft.notes
    });

    const keptIds = editDraft.sets.filter((s) => s.id).map((s) => s.id as string);
    const removedIds = originalSetIds.filter((id) => !keptIds.includes(id));
    await Promise.all(removedIds.map((setId) => deleteSetApi(workoutId, setId)));
    await Promise.all(
      editDraft.sets.map((s) =>
        s.id ? updateSetApi(workoutId, s.id, s.reps, s.weightKg) : createSetApi(workoutId, s.reps, s.weightKg)
      )
    );
    return res;
  };

  const syncPendingWorkouts = useCallback(async () => {
    const pending = await getAllPending();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        let res: Response;
        if (item.type === 'delete' && item.workoutId) {
          res = await deleteWorkoutApi(item.workoutId);
        } else if (item.type === 'update') {
          res = await replayUpdate(item);
        } else if (item.payload) {
          res = await createWorkoutApi(item.payload);
        } else {
          continue;
        }
        if (res.ok) {
          await removePending(item.localId);
        }
      } catch (err) {
        console.error('Sync error, will retry later:', err);
        break;
      }
    }
    setPendingCount(await countPending());
    fetchWorkouts();
  }, [fetchWorkouts]);

  useEffect(() => {
    countPending().then(setPendingCount);

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingWorkouts();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) syncPendingWorkouts();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createWorkout = useCallback(async (payload: WorkoutDraft): Promise<'saved' | 'queued' | 'error'> => {
    try {
      const res = await createWorkoutApi(payload);
      if (res.ok) {
        fetchWorkouts();
        showToast('Workout saved', 'success');
        return 'saved';
      }
      showToast('Failed to save workout', 'error');
      return 'error';
    } catch (err) {
      console.warn('Offline: queuing workout to sync later.', err);
      await addPendingWorkout(payload);
      setPendingCount(await countPending());
      showToast('Offline — workout queued to sync later', 'info');
      return 'queued';
    }
  }, [fetchWorkouts, showToast]);

  const deleteWorkout = useCallback(async (id: string) => {
    try {
      const res = await deleteWorkoutApi(id);
      if (res.ok) {
        fetchWorkouts();
        showToast('Workout deleted', 'success');
      } else {
        showToast('Failed to delete workout', 'error');
      }
    } catch (err) {
      console.warn('Offline: queuing delete to sync later.', err);
      await addPendingOperation({ type: 'delete', workoutId: id });
      setPendingCount(await countPending());
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
      setWorkoutsByDate((prev) => prev.filter((w) => w.id !== id));
      showToast('Offline — delete queued to sync later', 'info');
    }
  }, [fetchWorkouts, showToast]);

  const saveEditWorkout = useCallback(async (workout: Workout, editDraft: WorkoutDraft): Promise<'saved' | 'queued'> => {
    try {
      await updateWorkoutApi(workout.id, {
        date: editDraft.date,
        muscleGroup: editDraft.muscleGroup,
        exercise: editDraft.exercise,
        notes: editDraft.notes
      });

      const originalIds = (workout.sets || []).map((s) => s.id);
      const keptIds = editDraft.sets.filter((s) => s.id).map((s) => s.id as string);
      const removedIds = originalIds.filter((id) => !keptIds.includes(id));
      await Promise.all(removedIds.map((setId) => deleteSetApi(workout.id, setId)));

      await Promise.all(
        editDraft.sets.map((s) =>
          s.id ? updateSetApi(workout.id, s.id, s.reps, s.weightKg) : createSetApi(workout.id, s.reps, s.weightKg)
        )
      );

      fetchWorkouts();
      showToast('Workout updated', 'success');
      return 'saved';
    } catch (err) {
      console.warn('Offline: queuing edit to sync later.', err);
      const originalSetIds = (workout.sets || []).map((s) => s.id);
      await addPendingOperation({ type: 'update', workoutId: workout.id, editDraft, originalSetIds });
      setPendingCount(await countPending());

      const updatedWorkout: Workout = {
        ...workout,
        date: editDraft.date,
        muscleGroup: editDraft.muscleGroup,
        exercise: editDraft.exercise,
        notes: editDraft.notes,
        sets: editDraft.sets.map((s, i) => ({
          id: s.id || `local-set-${i}`,
          reps: Number(s.reps),
          weightKg: Number(s.weightKg)
        }))
      };
      const applyLocal = (list: Workout[]) => list.map((w) => (w.id === workout.id ? updatedWorkout : w));
      setWorkouts((prev) => applyLocal(prev));
      setWorkoutsByDate((prev) => applyLocal(prev));
      showToast('Offline — edit queued to sync later', 'info');
      return 'queued';
    }
  }, [fetchWorkouts, showToast]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginApi(username, password);
    if (result.ok && result.token) {
      localStorage.setItem('adminToken', result.token);
      setAdminToken(result.token);
      showToast('Logged in as Admin', 'success');
      return { ok: true };
    }
    showToast(result.error || 'Login failed', 'error');
    return { ok: false, error: result.error };
  }, [showToast]);

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
  }, []);

  const value: AppDataContextValue = {
    adminToken,
    login,
    logout,
    workouts,
    loading,
    lastApiLatency,
    fetchWorkouts,
    createWorkout,
    deleteWorkout,
    saveEditWorkout,
    workoutsByDate,
    fetchWorkoutsByDate,
    isOnline,
    pendingCount,
    trafficLogs,
    fetchTraffic,
    healthData,
    fetchHealth
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
