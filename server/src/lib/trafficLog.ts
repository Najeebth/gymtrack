import type { DbQueryInfo, TrafficLogEntry } from '../types/index.js';

const MAX_LOGS = 50;

const requestLogs: TrafficLogEntry[] = [];
let lastDbQuery: DbQueryInfo | null = null;

export function recordDbQuery(info: DbQueryInfo): void {
  lastDbQuery = info;
}

export function resetLastDbQuery(): void {
  lastDbQuery = null;
}

export function getLastDbQuery(): DbQueryInfo | null {
  return lastDbQuery;
}

export function addRequestLog(entry: TrafficLogEntry): void {
  requestLogs.unshift(entry);
  if (requestLogs.length > MAX_LOGS) requestLogs.pop();
}

export function getRequestLogs(): TrafficLogEntry[] {
  return requestLogs;
}
