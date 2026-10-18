import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.equal(getLastDbQuery(), null);

    const sampleQuery: DbQueryInfo = {
      query: 'findMany Workout (ordered by createdAt desc)',
      durationMs: 14.5,
      timestamp: '2026-10-18T10:00:00.000Z',
    };

    recordDbQuery(sampleQuery);
    assert.deepEqual(getLastDbQuery(), sampleQuery);

    resetLastDbQuery();
    assert.equal(getLastDbQuery(), null);
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
    assert.equal(logs.length, 2);
    assert.equal(logs[0].id, 'trace-2'); // newest is at index 0
    assert.equal(logs[1].id, 'trace-1');
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
    assert.equal(logs.length, 50); // MAX_LOGS
    assert.equal(logs[0].id, 'trace-60'); // most recent
    assert.equal(logs[49].id, 'trace-11'); // oldest retained (1-10 were dropped)
  });
});
