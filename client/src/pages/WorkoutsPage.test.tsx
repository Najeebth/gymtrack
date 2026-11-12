import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkoutsPage from './WorkoutsPage';
import { useWorkoutsQuery } from '../hooks/useWorkoutsQuery';
import { useTemplates } from '../hooks/useTemplates';
import { makeWorkout, mockAppData, renderWithProviders } from '../test/render';
import type { Template, Workout } from '../types';

vi.mock('../context/AppDataContext', () => ({ useAppData: vi.fn() }));
vi.mock('../hooks/useWorkoutsQuery', () => ({ useWorkoutsQuery: vi.fn() }));
vi.mock('../hooks/useTemplates', () => ({ useTemplates: vi.fn() }));
// The autocomplete reads the exercise library; with none, it falls back to the built-in suggestions
vi.mock('../hooks/useExercisesQuery', () => ({ useExercisesQuery: () => ({ exercises: [] }) }));
vi.mock('motion', () => ({ animate: vi.fn() }));

const createWorkout = vi.fn();
const deleteWorkout = vi.fn();
const saveEditWorkout = vi.fn();
const refetch = vi.fn();

function setWorkouts(workouts: Workout[], { isFetching = false } = {}) {
  vi.mocked(useWorkoutsQuery).mockReturnValue({
    workouts,
    isLoading: false,
    isFetching,
    createWorkout,
    deleteWorkout,
    saveEditWorkout,
    refetch,
  } as unknown as ReturnType<typeof useWorkoutsQuery>);
}

function setTemplates(templates: Template[]) {
  vi.mocked(useTemplates).mockReturnValue({ templates } as unknown as ReturnType<typeof useTemplates>);
}

beforeEach(() => {
  // Date only, so user-event and React Query keep real timers. The form defaults to "today".
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 0));
  mockAppData();
  setWorkouts([]);
  setTemplates([]);
  createWorkout.mockReset().mockResolvedValue({ id: 'new' });
  deleteWorkout.mockReset().mockResolvedValue(undefined);
  saveEditWorkout.mockReset().mockResolvedValue('saved');
  refetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const exerciseInput = () => screen.getByPlaceholderText(/barbell incline press/i);
const repsInputs = () => screen.getAllByPlaceholderText('Reps') as HTMLInputElement[];
const weightInputs = () => screen.getAllByPlaceholderText('Weight (kg)') as HTMLInputElement[];
const saveButton = () => screen.getByRole('button', { name: /save entry/i });

describe('summary cards', () => {
  it('totals logged sets and tonnage across all workouts', () => {
    setWorkouts([
      makeWorkout('2026-11-12', 'Bench Press', 'Chest', [[10, 60], [10, 60]]), // 1200 kg, 2 sets
      makeWorkout('2026-11-11', 'Squat', 'Legs', [[5, 100], [5, 100], [5, 100]]), // 1500 kg, 3 sets
    ]);

    renderWithProviders(<WorkoutsPage />);

    expect(screen.getByText('Total Logged Sets').nextElementSibling).toHaveTextContent('5');
    expect(screen.getByText('Total Tonnage Moved').nextElementSibling).toHaveTextContent(/^2\.7 tonnes$/);
  });

  it('shows zeros with no workouts', () => {
    renderWithProviders(<WorkoutsPage />);

    expect(screen.getByText('Total Logged Sets').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText('Total Tonnage Moved').nextElementSibling).toHaveTextContent(/^0\.0 tonnes$/);
  });
});

describe('the log form', () => {
  it('starts with today, Chest and one 10 × 60 set', () => {
    renderWithProviders(<WorkoutsPage />);

    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-12');
    expect(screen.getByLabelText('Muscle Group')).toHaveValue('Chest');
    expect(exerciseInput()).toHaveValue('');
    expect(repsInputs()).toHaveLength(1);
    expect(repsInputs()[0]).toHaveValue(10);
    expect(weightInputs()[0]).toHaveValue(60);
  });

  it('does not save without an exercise name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.click(saveButton());

    expect(createWorkout).not.toHaveBeenCalled();
  });

  it('does not save a name made only of spaces', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.type(exerciseInput(), '   ');
    await user.click(saveButton());

    expect(createWorkout).not.toHaveBeenCalled();
  });

  it('saves the entered workout', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.type(exerciseInput(), 'Cable Fly');
    await user.clear(repsInputs()[0]);
    await user.type(repsInputs()[0], '12');
    await user.clear(weightInputs()[0]);
    await user.type(weightInputs()[0], '22.5');
    await user.click(saveButton());

    expect(createWorkout).toHaveBeenCalledTimes(1);
    expect(createWorkout).toHaveBeenCalledWith({
      date: '2026-11-12',
      muscleGroup: 'Chest',
      exercise: 'Cable Fly',
      notes: '',
      sets: [{ reps: '12', weightKg: '22.5' }],
    });
  });

  it('clears the exercise name after saving, ready for the next one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.type(exerciseInput(), 'Cable Fly');
    await user.click(saveButton());

    expect(exerciseInput()).toHaveValue('');
  });

  it('lets the user pick another day and muscle group', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.selectOptions(screen.getByLabelText('Muscle Group'), 'Legs');
    await user.type(exerciseInput(), 'Leg Press');
    await user.click(saveButton());

    expect(createWorkout).toHaveBeenCalledWith(expect.objectContaining({ muscleGroup: 'Legs', exercise: 'Leg Press' }));
  });

  it('clears the exercise name when the muscle group changes, since it may not belong to the new group', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);
    await user.type(exerciseInput(), 'Bench Press');

    await user.selectOptions(screen.getByLabelText('Muscle Group'), 'Back');

    expect(exerciseInput()).toHaveValue('');
  });

  it('offers suggestions for the chosen muscle group', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.click(exerciseInput());

    // The built-in suggestions for Chest appear, and picking one fills the field
    const option = screen.getAllByText(/press|fly|push/i)[0];
    await user.pointer({ keys: '[MouseLeft>]', target: option });

    expect(exerciseInput()).not.toHaveValue('');
  });
});

describe('set rows', () => {
  it('"Add Set" copies the previous row’s reps and weight', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);
    await user.clear(repsInputs()[0]);
    await user.type(repsInputs()[0], '8');
    await user.clear(weightInputs()[0]);
    await user.type(weightInputs()[0], '75');

    await user.click(screen.getByRole('button', { name: /add set/i }));

    expect(repsInputs()).toHaveLength(2);
    expect(repsInputs()[1]).toHaveValue(8);
    expect(weightInputs()[1]).toHaveValue(75);
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('removes a set', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);
    await user.click(screen.getByRole('button', { name: /add set/i }));
    await user.click(screen.getByRole('button', { name: /add set/i }));
    expect(repsInputs()).toHaveLength(3);

    await user.click(screen.getAllByTitle('Remove set')[1]);

    expect(repsInputs()).toHaveLength(2);
  });

  it('will not remove the last remaining set', () => {
    renderWithProviders(<WorkoutsPage />);

    expect(screen.getByTitle('Remove set')).toBeDisabled();
  });

  it('saves every set, in order', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);
    await user.type(exerciseInput(), 'Cable Fly');
    await user.click(screen.getByRole('button', { name: /add set/i }));
    await user.clear(weightInputs()[1]);
    await user.type(weightInputs()[1], '70');

    await user.click(saveButton());

    expect(createWorkout.mock.calls[0][0].sets).toEqual([
      { reps: 10, weightKg: 60 },
      { reps: 10, weightKg: '70' },
    ]);
  });
});

describe('templates', () => {
  const push: Template = {
    id: 't1',
    name: 'Push Day',
    exercises: [
      { id: 'te1', muscleGroup: 'Chest', exercise: 'Bench Press', sets: [{ reps: 8, weightKg: 80 }, { reps: 6, weightKg: 85 }] },
      { id: 'te2', muscleGroup: 'Shoulders', exercise: 'Overhead Press', sets: [{ reps: 10, weightKg: 40 }] },
    ],
  };

  it('hides the template picker when there are no templates', () => {
    renderWithProviders(<WorkoutsPage />);

    expect(screen.queryByLabelText(/fill the form from a template/i)).not.toBeInTheDocument();
  });

  it('fills the form from a template exercise', async () => {
    setTemplates([push]);
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.selectOptions(screen.getByLabelText(/fill the form from a template/i), 'Overhead Press');

    expect(screen.getByLabelText('Muscle Group')).toHaveValue('Shoulders');
    expect(exerciseInput()).toHaveValue('Overhead Press');
    expect(repsInputs()).toHaveLength(1);
    expect(weightInputs()[0]).toHaveValue(40);
  });

  it('copies all of the template exercise’s sets', async () => {
    setTemplates([push]);
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.selectOptions(screen.getByLabelText(/fill the form from a template/i), 'Bench Press');

    expect(repsInputs().map((i) => i.value)).toEqual(['8', '6']);
    expect(weightInputs().map((i) => i.value)).toEqual(['80', '85']);
  });

  it('groups the exercises under the template name', () => {
    setTemplates([push]);
    renderWithProviders(<WorkoutsPage />);

    const group = screen.getByRole('group', { name: 'Push Day' });

    expect(within(group).getAllByRole('option').map((o) => o.textContent)).toEqual(['Bench Press', 'Overhead Press']);
  });
});

describe('recent exercises', () => {
  it('shows an empty state when nothing is logged', () => {
    renderWithProviders(<WorkoutsPage />);

    expect(screen.getByText('No workouts logged yet')).toBeInTheDocument();
  });

  it('lists each logged workout', () => {
    setWorkouts([
      makeWorkout('2026-11-12', 'Bench Press', 'Chest', [[10, 60]]),
      makeWorkout('2026-11-11', 'Squat', 'Legs', [[5, 100]]),
    ]);

    renderWithProviders(<WorkoutsPage />);

    expect(screen.queryByText('No workouts logged yet')).not.toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
  });

  it('refreshes on demand', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows a syncing badge while fetching in the background', () => {
    setWorkouts([], { isFetching: true });

    renderWithProviders(<WorkoutsPage />);

    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  it('asks before deleting, and does nothing if the user cancels', async () => {
    setWorkouts([makeWorkout('2026-11-12', 'Bench Press', 'Chest', [[10, 60], [8, 70]], { id: 'w-bench' })]);
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.click(screen.getByRole('button', { name: 'Delete Bench Press on 2026-11-12' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Delete workout?' });
    expect(dialog).toHaveTextContent('Bench Press on 2026-11-12 and its 2 sets will be permanently deleted.');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(deleteWorkout).not.toHaveBeenCalled();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
  });

  it('deletes the workout once the user confirms', async () => {
    setWorkouts([makeWorkout('2026-11-12', 'Bench Press', 'Chest', [[10, 60]], { id: 'w-bench' })]);
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.click(screen.getByRole('button', { name: 'Delete Bench Press on 2026-11-12' }));
    await user.click(screen.getByRole('button', { name: 'Delete workout' }));

    expect(deleteWorkout).toHaveBeenCalledWith('w-bench');
  });

  it('opens an edit form for a workout', async () => {
    setWorkouts([makeWorkout('2026-11-12', 'Bench Press', 'Chest', [[10, 60]], { id: 'w-bench' })]);
    const user = userEvent.setup();
    renderWithProviders(<WorkoutsPage />);

    await user.click(screen.getByTitle('Edit record'));

    expect(screen.queryByTitle('Edit record')).not.toBeInTheDocument(); // the card switched to its form
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
