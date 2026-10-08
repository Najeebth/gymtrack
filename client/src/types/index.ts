// Shared domain types for the GymTrack client. These mirror the shapes
// returned by the Express/Prisma API (server/) — kept in sync by hand since
// the client and server are separate packages with no shared schema.

export type MuscleGroup = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core';

export interface WorkoutSet {
  id: string;
  setNumber?: number;
  reps: number;
  weightKg: number;
}

export interface Workout {
  id: string;
  date: string;
  muscleGroup: string;
  exercise: string;
  notes?: string | null;
  sets?: WorkoutSet[];
}

// Draft shape used by the create form and the edit form. Reps/weight are
// kept as whatever the <input> gives us (string while typing, coerced to
// number on submit) — mirrors the pre-existing untyped behavior.
export interface SetDraft {
  id?: string;
  reps: number | string;
  weightKg: number | string;
}

export interface WorkoutDraft {
  date: string;
  muscleGroup: string;
  exercise: string;
  notes: string;
  sets: SetDraft[];
}

export interface TrafficLogEntry {
  id: string;
  method: string;
  url: string;
  status: number;
  httpDurationMs: number;
  timestamp: string;
  dbQuery?: {
    durationMs: number;
    query: string;
  } | null;
}

export interface HealthData {
  status: string;
  uptimeSeconds: number;
  nodeVersion: string;
  memoryUsageMB: {
    rss: number;
    [key: string]: number;
  };
}

// One account as the admin Users page sees it.
export interface AdminUser {
  id: string;
  email: string;
  role: 'MEMBER' | 'ADMIN';
  createdAt: string;
  workoutCount: number;
  templateCount: number;
  lastWorkoutDate: string | null;
}

// A saved routine: an ordered list of exercises with their default sets.
export interface TemplateExercise {
  id: string;
  muscleGroup: string;
  exercise: string;
  sets: { reps: number; weightKg: number }[];
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
}

// Template as edited in the builder form (inputs hold strings while typing).
export interface TemplateDraft {
  name: string;
  exercises: { muscleGroup: string; exercise: string; sets: SetDraft[] }[];
}

export type SaveStatus = 'saving' | 'queued' | null;

// Offline queue entry shapes (IndexedDB), as produced by offlineStore.ts
export type PendingOperation =
  | { type: 'create'; payload: WorkoutDraft }
  | { type: 'update'; workoutId: string; editDraft: WorkoutDraft; originalSetIds: string[] }
  | { type: 'delete'; workoutId: string };

export interface PendingRecord {
  localId: string;
  createdAt: number;
  // Whose queue this entry belongs to. Entries queued before accounts
  // existed have none.
  userId?: string;
  type?: 'create' | 'update' | 'delete';
  payload?: WorkoutDraft;
  workoutId?: string;
  editDraft?: WorkoutDraft;
  originalSetIds?: string[];
}
