// Tiny IndexedDB-backed queue for workout operations (create/update/delete)
// made while offline. Uses the `idb` package for a promise-based wrapper
// around IndexedDB.
import { openDB } from 'idb';

const DB_NAME = 'gymtrack-offline';
const DB_VERSION = 1;
const STORE = 'pendingWorkouts';

let dbPromise = null;

function getDb() {
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
export async function addPendingWorkout(payload) {
  return addPendingOperation({ type: 'create', payload });
}

// Generic queue entry for an operation that couldn't reach the server
// (create/update/delete). `op` holds everything syncPendingWorkouts needs
// to replay it later: { type, payload } for create, { type, workoutId,
// editDraft, originalSets } for update, { type, workoutId } for delete.
export async function addPendingOperation(op) {
  const db = await getDb();
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = { localId, createdAt: Date.now(), ...op };
  await db.put(STORE, record);
  return record;
}

// Returns all workouts queued while offline, oldest first.
export async function getAllPending() {
  const db = await getDb();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

// Remove a queued workout once it has been successfully synced to the server.
export async function removePending(localId) {
  const db = await getDb();
  await db.delete(STORE, localId);
}

export async function countPending() {
  const db = await getDb();
  return db.count(STORE);
}
