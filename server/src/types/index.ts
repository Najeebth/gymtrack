// Shared domain types for the GymTrack server.

export interface Step {
  name: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
  cpuStart: NodeJS.CpuUsage;
  cpuEnd?: NodeJS.CpuUsage;
  memStart: NodeJS.MemoryUsage;
  memEnd?: NodeJS.MemoryUsage;
}

export interface Trace {
  id: string;
  method: string;
  url: string;
  startTime: Date;
  steps: Step[];
  push?: (data: Trace) => void;
}

export interface DbQueryInfo {
  query: string;
  durationMs: number;
  timestamp: string;
}

export interface TrafficLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  httpDurationMs: number;
  dbQuery: DbQueryInfo | null;
  ip: string;
  userAgent: string;
}

export type Role = 'MEMBER' | 'ADMIN';

export interface UserTokenPayload {
  id: string;
  email: string;
  role: Role;
}

export interface SetInput {
  reps: number | string;
  weightKg: number | string;
}

export interface NormalizedSet {
  setNumber: number;
  reps: number;
  weightKg: number;
}

// Augment Express so route handlers/middleware can read the fields the
// tracker middleware and auth middleware attach to each request/response.
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      user?: UserTokenPayload;
    }
    interface Response {
      trace?: Trace;
    }
  }
}
