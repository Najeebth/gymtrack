import { latestActionableId, readActionStatuses, toWorkoutDraft, writeActionStatus } from './chat.ts';
import type { ChatMessage } from '../types/index.ts';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const draft = { date: '2026-10-23', exercise: 'Barbell Squat', muscleGroup: 'Legs', sets: [{ reps: 5, weightKg: 100 }] };

function msg(id: string, withAction: boolean): ChatMessage {
  return {
    id,
    role: 'ASSISTANT',
    content: '',
    source: 'RULE',
    action: withAction ? { type: 'CREATE_WORKOUT', draft } : null,
    createdAt: '2026-10-23T10:00:00Z',
  };
}

describe('Chat utilities (Frontend)', () => {
  it('should convert a bot draft into the create-workout payload', () => {
    expect(toWorkoutDraft(draft)).toEqual({
      date: '2026-10-23',
      muscleGroup: 'Legs',
      exercise: 'Barbell Squat',
      notes: '',
      sets: [{ reps: 5, weightKg: 100 }],
    });
  });

  it('should only treat the newest draft as actionable', () => {
    expect(latestActionableId([msg('a', true), msg('b', false), msg('c', true), msg('d', false)])).toBe('c');
    expect(latestActionableId([msg('a', false)])).toBe(null);
  });

  it('should remember action statuses across reads', () => {
    const storage = memoryStorage();
    writeActionStatus('m1', 'saved', storage);
    writeActionStatus('m2', 'dismissed', storage);
    expect(readActionStatuses(storage)).toEqual({ m1: 'saved', m2: 'dismissed' });
  });

  it('should keep only the most recent 100 statuses', () => {
    const storage = memoryStorage();
    for (let i = 0; i < 105; i++) writeActionStatus(`m${i}`, 'saved', storage);
    const statuses = readActionStatuses(storage);
    expect(Object.keys(statuses).length).toBe(100);
    expect(statuses.m0).toBe(undefined);
    expect(statuses.m104).toBe('saved');
  });

  it('should survive corrupt or unavailable storage', () => {
    const corrupt = { getItem: () => '{not json', setItem: () => {} };
    expect(readActionStatuses(corrupt)).toEqual({});

    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readActionStatuses(throwing)).toEqual({});
    expect(writeActionStatus('m1', 'saved', throwing)).toEqual({ m1: 'saved' });
    expect(readActionStatuses(null)).toEqual({});
  });
});
