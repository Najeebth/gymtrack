import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import ToastStack from '../components/ToastStack';
import { useAppData } from '../context/AppDataContext';
import type { Workout } from '../types';

type AppData = ReturnType<typeof useAppData>;

/**
 * Sets what `useAppData()` returns. The test file must replace the module first:
 *
 *   vi.mock('../context/AppDataContext', () => ({ useAppData: vi.fn() }));
 *
 * (The real provider talks to the API, IndexedDB and localStorage, none of
 * which a component test should depend on.) Defaults to a logged-in member.
 */
export function mockAppData(overrides: Partial<AppData> = {}): AppData {
  const value = {
    authToken: 'test-token',
    role: 'MEMBER',
    email: 'member@gymtrack.io',
    isAdmin: false,
    avatarUrl: null,
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  } as unknown as AppData;
  vi.mocked(useAppData).mockReturnValue(value);
  return value;
}

/** Shows the router's current path, so a test can assert where a redirect or click went. */
function LocationDisplay() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

interface RenderOptions {
  /** Where the in-memory router starts. */
  route?: string;
}

/**
 * Renders with the same wrappers the app has: React Query (retries off so
 * failures surface immediately), router, toasts and the confirm dialog.
 */
export function renderWithProviders(ui: ReactElement, { route = '/' }: RenderOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <MemoryRouter initialEntries={[route]}>
              {ui}
              <LocationDisplay />
            </MemoryRouter>
            <ToastStack />
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    ),
  };
}

let nextId = 0;
/** A workout fixture: `makeWorkout('2026-11-12', 'Bench Press', 'Chest', [[10, 60], [8, 70]])`. */
export function makeWorkout(
  date: string,
  exercise: string,
  muscleGroup: string,
  sets: [reps: number, weightKg: number][],
  extra: Partial<Workout> = {}
): Workout {
  const id = `w${nextId++}`;
  return {
    id,
    date,
    exercise,
    muscleGroup,
    notes: null,
    sets: sets.map(([reps, weightKg], i) => ({ id: `${id}-s${i}`, setNumber: i + 1, reps, weightKg })),
    ...extra,
  };
}
