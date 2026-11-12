import {
  recordDbQuery,
  resetLastDbQuery,
  getLastDbQuery,
  addRequestLog,
  getRequestLogs,
} from './trafficLog.js';
import type { DbQueryInfo, TrafficLogEntry } from '../types/index.js';

describe('Traffic & Telemetry In-Memory Log Buffer', () => {
  beforeEach(() => {
    resetLastDbQuery();
    // clear request logs array
    const logs = getRequestLogs();
    logs.length = 0;
  });

  it('should record, retrieve, and reset last DB query', () => {
    expect(getLastDbQuery()).toBe(null);

    const sampleQuery: DbQueryInfo = {
      query: 'findMany Workout (ordered by createdAt desc)',
      durationMs: 14.5,
      timestamp: '2026-10-18T10:00:00.000Z',
    };

    recordDbQuery(sampleQuery);
    expect(getLastDbQuery()).toEqual(sampleQuery);

    resetLastDbQuery();
    expect(getLastDbQuery()).toBe(null);
  });

  it('should store requests in reverse chronological order (newest first)', () => {
    const entry1: TrafficLogEntry = {
      id: 'trace-1',
      method: 'GET',
      url: '/api/workouts',
      status: 200,
      httpDurationMs: 12,
      dbQuery: null,
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      timestamp: '2026-10-18T10:00:00Z',
    };

    const entry2: TrafficLogEntry = {
      id: 'trace-2',
      method: 'POST',
      url: '/api/workouts',
      status: 201,
      httpDurationMs: 25,
      dbQuery: null,
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      timestamp: '2026-10-18T10:01:00Z',
    };

    addRequestLog(entry1);
    addRequestLog(entry2);

    const logs = getRequestLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].id).toBe('trace-2'); // newest is at index 0
    expect(logs[1].id).toBe('trace-1');
  });

  it('should cap log buffer at 50 entries and drop oldest entries', () => {
    for (let i = 1; i <= 60; i++) {
      addRequestLog({
        id: `trace-${i}`,
        method: 'GET',
        url: `/api/test/${i}`,
        status: 200,
        httpDurationMs: i,
        dbQuery: null,
        ip: '127.0.0.1',
        userAgent: 'test',
        timestamp: new Date().toISOString(),
      });
    }

    const logs = getRequestLogs();
    expect(logs.length).toBe(50); // MAX_LOGS
    expect(logs[0].id).toBe('trace-60'); // most recent
    expect(logs[49].id).toBe('trace-11'); // oldest retained (1-10 were dropped)
  });
});
