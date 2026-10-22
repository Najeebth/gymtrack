import type { ChatActionStatus, ChatMessage, ChatWorkoutDraft, WorkoutDraft } from '../types';

/** The bot's draft in the shape the normal create-workout path expects. */
export function toWorkoutDraft(draft: ChatWorkoutDraft): WorkoutDraft {
  return {
    date: draft.date,
    muscleGroup: draft.muscleGroup,
    exercise: draft.exercise,
    notes: '',
    sets: draft.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
  };
}

/**
 * Only the newest draft can be confirmed. Older ones are stale (the user moved
 * on), and history reloads from the server, so re-arming them would invite
 * logging the same workout twice.
 */
export function latestActionableId(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].action) return messages[i].id;
  }
  return null;
}

// Which drafts were already confirmed/dismissed, remembered per device so a
// reload doesn't re-arm them. localStorage can throw (private mode, blocked
// storage), so every access is guarded and the chat still works without it.
const STORAGE_KEY = 'gymtrack:chat:action-status';
const MAX_REMEMBERED = 100;

type StatusMap = Record<string, ChatActionStatus>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readActionStatuses(storage: StorageLike | null = defaultStorage()): StatusMap {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeActionStatus(
  id: string,
  status: ChatActionStatus,
  storage: StorageLike | null = defaultStorage()
): StatusMap {
  // Re-insert so the newest entry is last, then keep only the most recent ones
  const { [id]: _previous, ...rest } = readActionStatuses(storage);
  const entries = Object.entries({ ...rest, [id]: status }).slice(-MAX_REMEMBERED);
  const next = Object.fromEntries(entries) as StatusMap;
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the in-memory map still applies for this session
  }
  return next;
}
