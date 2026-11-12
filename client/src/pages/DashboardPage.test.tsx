import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { fetchWorkoutsApi } from '../api/workouts';
import { makeWorkout, mockAppData, renderWithProviders } from '../test/render';
import type { Workout } from '../types';

vi.mock('../context/AppDataContext', () => ({ useAppData: vi.fn() }));
vi.mock('../api/workouts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/workouts')>()),
  fetchWorkoutsApi: vi.fn(),
}));

const fetchWorkouts = vi.mocked(fetchWorkoutsApi);

// Only Date is faked, so React Query and user-event keep their real timers.
// 2026-11-12 is a Thursday: this week runs Mon Nov 9 to Sun Nov 15.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 0));
  mockAppData();
});

afterEach(() => {
  vi.useRealTimers();
});

const sampleWorkouts: Workout[] = [
  makeWorkout('2026-11-12', 'Bench Press', 'Chest', [[10, 60], [10, 60]]), // 1200 kg
  makeWorkout('2026-11-11', 'Squat', 'Legs', [[5, 100]]), // 500 kg
  makeWorkout('2026-11-10', 'Barbell Row', 'Back', [[8, 50]]), // 400 kg
  makeWorkout('2026-11-05', 'Bench Press', 'Chest', [[10, 50]]), // 500 kg, last week
];

/** The card for a stat label, e.g. statCard('Day streak'). */
const statCard = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe('loading and empty states', () => {
  it('shows a loading message while workouts are being fetched', () => {
    fetchWorkouts.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/loading your dashboard/i)).toBeInTheDocument();
  });

  it('shows an empty state with a way to log the first workout', async () => {
    fetchWorkouts.mockResolvedValue([]);
    const user = userEvent.setup();

    renderWithProviders(<DashboardPage />, { route: '/dashboard' });

    expect(await screen.findByText('Your dashboard is empty')).toBeInTheDocument();
    expect(screen.queryByText('Sessions this week')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /log first workout/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/workouts');
  });

  it('requests the signed-in user’s workouts with their token', async () => {
    fetchWorkouts.mockResolvedValue([]);
    mockAppData({ authToken: 'my-token' });

    renderWithProviders(<DashboardPage />);
    await screen.findByText('Your dashboard is empty');

    expect(fetchWorkouts).toHaveBeenCalledWith('my-token', undefined);
  });
});

describe('with workouts', () => {
  beforeEach(() => {
    fetchWorkouts.mockResolvedValue(sampleWorkouts);
  });

  it('totals this week’s sessions, sets and volume', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Sessions this week');

    expect(statCard('Sessions this week')).toHaveTextContent(/^Sessions this week3$/);
    expect(statCard('Sets this week')).toHaveTextContent(/^Sets this week4$/);
    expect(statCard('Volume this week')).toHaveTextContent(/^Volume this week2\.1tonnes/);
  });

  it('compares volume with last week', async () => {
    renderWithProviders(<DashboardPage />);

    // 2100 kg this week against 500 kg last week
    expect(await screen.findByText('+320% vs last week')).toBeInTheDocument();
  });

  it('says so when there is no data from last week to compare with', async () => {
    fetchWorkouts.mockResolvedValue([makeWorkout('2026-11-12', 'Squat', 'Legs', [[5, 100]])]);

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('No data last week')).toBeInTheDocument();
  });

  it('shows a negative change when this week is lighter', async () => {
    fetchWorkouts.mockResolvedValue([
      makeWorkout('2026-11-12', 'Squat', 'Legs', [[5, 100]]), // 500 kg
      makeWorkout('2026-11-05', 'Squat', 'Legs', [[10, 100]]), // 1000 kg last week
    ]);

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('-50% vs last week')).toBeInTheDocument();
  });

  it('shows the day streak', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Day streak');

    // trained on the 10th, 11th and 12th
    expect(statCard('Day streak')).toHaveTextContent(/^Day streak3days$/);
  });

  it('uses the singular for a one-day streak', async () => {
    fetchWorkouts.mockResolvedValue([makeWorkout('2026-11-12', 'Squat', 'Legs', [[5, 100]])]);

    renderWithProviders(<DashboardPage />);
    await screen.findByText('Day streak');

    expect(statCard('Day streak')).toHaveTextContent(/^Day streak1day$/);
  });

  it('shows a zero streak after a missed day', async () => {
    fetchWorkouts.mockResolvedValue([makeWorkout('2026-11-09', 'Squat', 'Legs', [[5, 100]])]);

    renderWithProviders(<DashboardPage />);
    await screen.findByText('Day streak');

    expect(statCard('Day streak')).toHaveTextContent(/^Day streak0days$/);
  });

  it('plots one bar per week for the last 8 weeks', async () => {
    renderWithProviders(<DashboardPage />);

    const chart = await screen.findByRole('img', { name: /weekly training volume/i });

    expect(within(chart).getAllByText(/^[A-Z][a-z]{2} \d{1,2}$/)).toHaveLength(8);
    // The current week starts Monday Nov 9
    expect(within(chart).getByText('Nov 9')).toBeInTheDocument();
    expect(chart.querySelector('title')?.textContent).toMatch(/^Week of /);
  });

  it('breaks the last 30 days down by muscle group, by set count', async () => {
    renderWithProviders(<DashboardPage />);

    const section = await screen.findByRole('region', { name: /muscle groups/i });

    // 5 sets: 3 chest, 1 legs, 1 back
    expect(within(section).getByText('3 sets · 60%')).toBeInTheDocument();
    expect(within(section).getAllByText('1 set · 20%')).toHaveLength(2);
    const labels = within(section).getAllByRole('listitem').map((li) => li.textContent);
    expect(labels[0]).toContain('Chest');
  });

  it('lists personal records with the previous best', async () => {
    renderWithProviders(<DashboardPage />);

    const section = await screen.findByRole('region', { name: /recent personal records/i });

    // Bench went from 50 kg (Nov 5) to 60 kg (Nov 12)
    expect(within(section).getByText('Bench Press')).toBeInTheDocument();
    expect(within(section).getByText('60 kg')).toBeInTheDocument();
    expect(within(section).getByText('2026-11-12 · was 50 kg')).toBeInTheDocument();
  });

  it('explains when there are no recent records', async () => {
    fetchWorkouts.mockResolvedValue([makeWorkout('2026-11-12', 'Squat', 'Legs', [[5, 100]])]);

    renderWithProviders(<DashboardPage />);

    const section = await screen.findByRole('region', { name: /recent personal records/i });
    expect(within(section).getByText(/no new records in the last 30 days/i)).toBeInTheDocument();
  });

  it('lists the most recent workouts with their set counts and volume', async () => {
    renderWithProviders(<DashboardPage />);

    const section = await screen.findByRole('region', { name: /recent workouts/i });
    const rows = within(section).getAllByRole('listitem');

    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Bench Press');
    expect(rows[0]).toHaveTextContent('2026-11-12 · Chest');
    expect(rows[0]).toHaveTextContent('2 sets');
    expect(rows[0]).toHaveTextContent('1200 kg');
    expect(rows[1]).toHaveTextContent('Squat');
    expect(rows[1]).toHaveTextContent('1 set');
  });

  it('shows at most five recent workouts', async () => {
    fetchWorkouts.mockResolvedValue(
      ['01', '02', '03', '04', '05', '06', '07'].map((d) => makeWorkout(`2026-11-${d}`, 'Squat', 'Legs', [[5, 100]]))
    );

    renderWithProviders(<DashboardPage />);

    const section = await screen.findByRole('region', { name: /recent workouts/i });
    expect(within(section).getAllByRole('listitem')).toHaveLength(5);
  });
});

describe('navigation', () => {
  beforeEach(() => {
    fetchWorkouts.mockResolvedValue(sampleWorkouts);
  });

  it('links to the workout form', async () => {
    renderWithProviders(<DashboardPage />);

    const link = await screen.findByRole('link', { name: /log a workout/i });

    expect(link).toHaveAttribute('href', '/workouts');
  });

  it('links to the by-date browser', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />, { route: '/dashboard' });

    await user.click(await screen.findByRole('link', { name: /browse by date/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/by-date');
  });
});
