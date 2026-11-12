import jwt from 'jsonwebtoken';

// Shared fixtures for the HTTP-level (supertest) tests.

export interface TestUser {
  id: string;
  email: string;
  role: 'MEMBER' | 'ADMIN';
  avatarUrl: string | null;
}

export const MEMBER: TestUser = { id: 'user-1', email: 'member@gymtrack.io', role: 'MEMBER', avatarUrl: null };
export const OTHER_MEMBER: TestUser = { id: 'user-2', email: 'other@gymtrack.io', role: 'MEMBER', avatarUrl: null };
export const ADMIN: TestUser = { id: 'admin-1', email: 'admin@gymtrack.io', role: 'ADMIN', avatarUrl: null };

/** A real signed JWT, the same shape the login endpoint issues. */
export function tokenFor(user: TestUser): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

/** Authorization header for supertest: `.set(bearer(MEMBER))`. */
export function bearer(user: TestUser): { Authorization: string } {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

/**
 * Implementation for a mocked `prisma.user.findUnique` as the auth middleware
 * uses it (lookup by id). Unknown ids resolve to null, like a deleted account.
 */
export function userLookup(...users: TestUser[]) {
  return async ({ where }: { where: { id?: string } }) => users.find((u) => u.id === where.id) ?? null;
}

/** Keeps the request logger and controller error logs out of the test output. */
export function silenceConsole(): void {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
}
