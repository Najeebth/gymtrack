import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Workout, WorkoutDraft, TrafficLogEntry, HealthData } from '../types';
import { fetchWorkoutsApi, createWorkoutApi, deleteWorkoutApi, deleteSetApi, updateSetApi, createSetApi, updateWorkoutApi } from '../api/workouts';
import { fetchTrafficApi, fetchHealthApi } from '../api/admin';
import { loginApi, signupApi } from '../api/auth';
import { setUnauthorizedHandler } from '../api/http';
import { addPendingWorkout, addPendingOperation, getAllPending, removePending, countPending } from '../offlineStore';
import type { PendingRecord } from '../types';
import { useToast } from './ToastContext';

type Role = 'MEMBER' | 'ADMIN';

interface TokenPayload {
  id: string;
  email: string;
  role: Role;
  // Expiry as seconds since the epoch, as set by the server.
  exp?: number;
}

// setTimeout can't wait longer than this (about 24.8 days).
const MAX_TIMER_MS = 2_147_483_647;

// JWTs are already signed/verified server-side; decoding the payload here
// is just so the UI knows the role/email without a round trip, not a
// security check.
function decodeToken(token: string | null): TokenPayload | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (!json || typeof json.id !== 'string' || typeof json.role !== 'string') return null;
    return { id: json.id, email: json.email, role: json.role, exp: typeof json.exp === 'number' ? json.exp : undefined };
  } catch {
    return null;
  }
}

function clearStoredToken(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('adminToken');
}

// A token that is unreadable or already expired is dropped here, so the app
// starts at the login screen instead of opening and then failing every request.
function readStoredToken(): string | null {
  const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken');
  const payload = decodeToken(token);
  if (!token || !payload || (payload.exp !== undefined && payload.exp * 1000 <= Date.now())) {
    clearStoredToken();
    return null;
  }
  return token;
}

export interface RoutineResult {
  saved: number;
  queued: number;
  failed: number;
}

interface AppDataContextValue {
  // Auth
  authToken: string | null;
  role: Role | null;
  email: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;

  // Workouts (per logged-in user)
  workouts: Workout[];
  loading: boolean;
  lastApiLatency: string | null;
  fetchWorkouts: () => Promise<void>;
  createWorkout: (payload: WorkoutDraft) => Promise<'saved' | 'queued' | 'error'>;
  logRoutine: (drafts: WorkoutDraft[]) => Promise<RoutineResult>;
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
  const [authToken, setAuthToken] = useState<string | null>(readStoredToken);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsByDate, setWorkoutsByDate] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastApiLatency, setLastApiLatency] = useState<string | null>(null);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLogEntry[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const tokenPayload = useMemo(() => decodeToken(authToken), [authToken]);
  const userId = tokenPayload?.id ?? null;
  const role = tokenPayload?.role ?? null;
  const email = tokenPayload?.email ?? null;
  const isAdmin = role === 'ADMIN';

  // Ends the session locally. The route guards then send the user to the
  // login screen for whatever page they were on.
  const endSession = useCallback((message?: string) => {
    clearStoredToken();
    setAuthToken(null);
    if (message) showToast(message, 'info');
  }, [showToast]);

  // Backstop: the server rejected the token (expired, or the account was
  // deleted). The ref keeps several failing requests from each logging out.
  const hasSession = useRef(false);
  useEffect(() => {
    hasSession.current = !!authToken;
  }, [authToken]);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!hasSession.current) return;
      hasSession.current = false;
      endSession('Your session has ended. Please log in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // Log out at the moment the token expires, rather than on the next failed request.
  useEffect(() => {
    const exp = tokenPayload?.exp;
    if (exp === undefined) return;
    const remaining = exp * 1000 - Date.now();
    if (remaining > MAX_TIMER_MS) return;
    const timer = window.setTimeout(
      () => endSession('Your session has expired. Please log in again.'),
      Math.max(remaining, 0)
    );
    return () => window.clearTimeout(timer);
  }, [tokenPayload, endSession]);

  const fetchWorkouts = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    const start = performance.now();
    try {
      const data = await fetchWorkoutsApi(authToken);
      setWorkouts(data);
      setLastApiLatency((performance.now() - start).toFixed(1));
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const fetchWorkoutsByDate = useCallback(async (date: string) => {
    if (!authToken) return;
    setLoading(true);
    const start = performance.now();
    try {
      const data = await fetchWorkoutsApi(authToken, date);
      setWorkoutsByDate(data);
      setLastApiLatency((performance.now() - start).toFixed(1));
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const fetchTraffic = useCallback(async () => {
    if (!authToken) return;
    try {
      setTrafficLogs(await fetchTrafficApi(authToken));
    } catch (err) {
      console.error('Traffic fetch error:', err);
    }
  }, [authToken]);

  const fetchHealth = useCallback(async () => {
    if (!authToken) return;
    try {
      setHealthData(await fetchHealthApi(authToken));
    } catch (err) {
      console.error('Health fetch error:', err);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchWorkouts();
    } else {
      setWorkouts([]);
      setWorkoutsByDate([]);
    }
  }, [authToken, fetchWorkouts]);

  const replayUpdate = async (token: string, item: PendingRecord) => {
    const { workoutId, editDraft, originalSetIds } = item;
    if (!workoutId || !editDraft || !originalSetIds) throw new Error('Malformed pending update');
    const res = await updateWorkoutApi(token, workoutId, {
      date: editDraft.date,
      muscleGroup: editDraft.muscleGroup,
      exercise: editDraft.exercise,
      notes: editDraft.notes
    });

    const keptIds = editDraft.sets.filter((s) => s.id).map((s) => s.id as string);
    const removedIds = originalSetIds.filter((id) => !keptIds.includes(id));
    await Promise.all(removedIds.map((setId) => deleteSetApi(token, workoutId, setId)));
    await Promise.all(
      editDraft.sets.map((s) =>
        s.id ? updateSetApi(token, workoutId, s.id, s.reps, s.weightKg) : createSetApi(token, workoutId, s.reps, s.weightKg)
      )
    );
    return res;
  };

  const syncPendingWorkouts = useCallback(async () => {
    if (!authToken || !userId) return;
    const pending = await getAllPending(userId);
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        let res: Response;
        if (item.type === 'delete' && item.workoutId) {
          res = await deleteWorkoutApi(authToken, item.workoutId);
        } else if (item.type === 'update') {
          res = await replayUpdate(authToken, item);
        } else if (item.payload) {
          res = await createWorkoutApi(authToken, item.payload);
        } else {
          continue;
        }
        if (res.ok) {
          await removePending(item.localId);
        } else if (res.status === 401) {
          // Session is gone; the rest stays queued for the next login.
          return;
        }
      } catch (err) {
        console.error('Sync error, will retry later:', err);
        break;
      }
    }
    setPendingCount(await countPending(userId));
    fetchWorkouts();
  }, [authToken, userId, fetchWorkouts]);

  useEffect(() => {
    if (userId) {
      countPending(userId).then(setPendingCount);
    } else {
      setPendingCount(0);
    }

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
  }, [authToken]);

  const createWorkout = useCallback(async (payload: WorkoutDraft): Promise<'saved' | 'queued' | 'error'> => {
    if (!authToken || !userId) return 'error';
    try {
      const res = await createWorkoutApi(authToken, payload);
      if (res.ok) {
        fetchWorkouts();
        showToast('Workout saved', 'success');
        return 'saved';
      }
      if (res.status !== 401) showToast('Failed to save workout', 'error');
      return 'error';
    } catch (err) {
      console.warn('Offline: queuing workout to sync later.', err);
      await addPendingWorkout(userId, payload);
      setPendingCount(await countPending(userId));
      showToast('Offline — workout queued to sync later', 'info');
      return 'queued';
    }
  }, [authToken, userId, fetchWorkouts, showToast]);

  // Logs several exercises in one go (a template's routine), in order, with
  // a single summary toast instead of one per exercise.
  const logRoutine = useCallback(async (drafts: WorkoutDraft[]): Promise<RoutineResult> => {
    const result: RoutineResult = { saved: 0, queued: 0, failed: 0 };
    if (!authToken || !userId) return result;

    for (const draft of drafts) {
      try {
        const res = await createWorkoutApi(authToken, draft);
        if (res.ok) {
          result.saved++;
        } else if (res.status === 401) {
          return result;
        } else {
          result.failed++;
        }
      } catch {
        await addPendingWorkout(userId, draft);
        result.queued++;
      }
    }

    if (result.queued > 0) setPendingCount(await countPending(userId));
    if (result.saved > 0) fetchWorkouts();

    const plural = (n: number) => `${n} exercise${n === 1 ? '' : 's'}`;
    if (result.failed > 0) {
      showToast(`Logged ${result.saved} of ${plural(drafts.length)} — ${result.failed} failed`, 'error');
    } else if (result.queued > 0) {
      showToast(`Offline — ${plural(result.queued)} queued to sync later`, 'info');
    } else {
      showToast(`Logged ${plural(result.saved)}`, 'success');
    }
    return result;
  }, [authToken, userId, fetchWorkouts, showToast]);

  const deleteWorkout = useCallback(async (id: string) => {
    if (!authToken || !userId) return;
    try {
      const res = await deleteWorkoutApi(authToken, id);
      if (res.ok) {
        fetchWorkouts();
        showToast('Workout deleted', 'success');
      } else if (res.status !== 401) {
        showToast('Failed to delete workout', 'error');
      }
    } catch (err) {
      console.warn('Offline: queuing delete to sync later.', err);
      await addPendingOperation(userId, { type: 'delete', workoutId: id });
      setPendingCount(await countPending(userId));
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
      setWorkoutsByDate((prev) => prev.filter((w) => w.id !== id));
      showToast('Offline — delete queued to sync later', 'info');
    }
  }, [authToken, userId, fetchWorkouts, showToast]);

  const saveEditWorkout = useCallback(async (workout: Workout, editDraft: WorkoutDraft): Promise<'saved' | 'queued'> => {
    if (!authToken || !userId) return 'queued';
    try {
      await updateWorkoutApi(authToken, workout.id, {
        date: editDraft.date,
        muscleGroup: editDraft.muscleGroup,
        exercise: editDraft.exercise,
        notes: editDraft.notes
      });

      const originalIds = (workout.sets || []).map((s) => s.id);
      const keptIds = editDraft.sets.filter((s) => s.id).map((s) => s.id as string);
      const removedIds = originalIds.filter((id) => !keptIds.includes(id));
      await Promise.all(removedIds.map((setId) => deleteSetApi(authToken, workout.id, setId)));

      await Promise.all(
        editDraft.sets.map((s) =>
          s.id ? updateSetApi(authToken, workout.id, s.id, s.reps, s.weightKg) : createSetApi(authToken, workout.id, s.reps, s.weightKg)
        )
      );

      fetchWorkouts();
      showToast('Workout updated', 'success');
      return 'saved';
    } catch (err) {
      console.warn('Offline: queuing edit to sync later.', err);
      const originalSetIds = (workout.sets || []).map((s) => s.id);
      await addPendingOperation(userId, { type: 'update', workoutId: workout.id, editDraft, originalSetIds });
      setPendingCount(await countPending(userId));

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
  }, [authToken, userId, fetchWorkouts, showToast]);

  const applyAuthResult = useCallback((token: string) => {
    localStorage.setItem('authToken', token);
    localStorage.removeItem('adminToken');
    setAuthToken(token);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginApi(email, password);
    if (result.ok && result.token) {
      applyAuthResult(result.token);
      showToast('Logged in', 'success');
      return { ok: true };
    }
    showToast(result.error || 'Login failed', 'error');
    return { ok: false, error: result.error };
  }, [applyAuthResult, showToast]);

  const signup = useCallback(async (email: string, password: string) => {
    const result = await signupApi(email, password);
    if (result.ok && result.token) {
      applyAuthResult(result.token);
      showToast('Account created', 'success');
      return { ok: true };
    }
    showToast(result.error || 'Signup failed', 'error');
    return { ok: false, error: result.error };
  }, [applyAuthResult, showToast]);

  const logout = useCallback(() => endSession(), [endSession]);

  const value: AppDataContextValue = {
    authToken,
    role,
    email,
    isAdmin,
    login,
    signup,
    logout,
    workouts,
    loading,
    lastApiLatency,
    fetchWorkouts,
    createWorkout,
    logRoutine,
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
