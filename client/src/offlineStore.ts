// Tiny IndexedDB-backed queue for workout operations (create/update/delete)
// made while offline. Uses the `idb` package for a promise-based wrapper
// around IndexedDB.
import { openDB, type IDBPDatabase } from 'idb';
import type { PendingOperation, PendingRecord, WorkoutDraft } from './types';

const DB_NAME = 'gymtrack-offline';
const DB_VERSION = 1;
const STORE = 'pendingWorkouts';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'localId' });
        }
      }
    });
  }
  return dbPromise;
}

// Save a workout payload that failed to POST due to being offline.
// Returns the generated localId so the UI can show/remove it later.
export async function addPendingWorkout(userId: string, payload: WorkoutDraft) {
  return addPendingOperation(userId, { type: 'create', payload });
}

// Generic queue entry for an operation that couldn't reach the server
// (create/update/delete). `op` holds everything syncPendingWorkouts needs
// to replay it later: { type, payload } for create, { type, workoutId,
// editDraft, originalSets } for update, { type, workoutId } for delete.
export async function addPendingOperation(userId: string, op: PendingOperation): Promise<PendingRecord> {
  const db = await getDb();
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: PendingRecord = { localId, createdAt: Date.now(), userId, ...op };
  await db.put(STORE, record);
  return record;
}

// Each account only ever sees its own queue, so a shared browser can't sync
// one person's offline entries under another's login. Entries from before
// accounts existed carry no owner and go to whoever syncs next.
function belongsTo(userId: string) {
  return (record: PendingRecord) => !record.userId || record.userId === userId;
}

// Returns this user's operations queued while offline, oldest first.
export async function getAllPending(userId: string): Promise<PendingRecord[]> {
  const db = await getDb();
  const all: PendingRecord[] = await db.getAll(STORE);
  return all.filter(belongsTo(userId)).sort((a, b) => a.createdAt - b.createdAt);
}

// Remove a queued workout once it has been successfully synced to the server.
export async function removePending(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, localId);
}

export async function countPending(userId: string): Promise<number> {
  const db = await getDb();
  const all: PendingRecord[] = await db.getAll(STORE);
  return all.filter(belongsTo(userId)).length;
}
