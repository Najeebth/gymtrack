import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ExerciseAutocomplete from './ExerciseAutocomplete';
import { useExercisesQuery } from '../hooks/useExercisesQuery';
import { renderWithProviders } from '../test/render';
import type { Exercise } from '../types';

vi.mock('../hooks/useExercisesQuery', () => ({
  useExercisesQuery: vi.fn(),
}));

function mockDbExercises(exercises: Partial<Exercise>[]) {
  vi.mocked(useExercisesQuery).mockReturnValue({
    exercises: exercises as Exercise[],
    isLoading: false,
    error: null,
    pagination: { total: exercises.length, page: 1, limit: 50, totalPages: 1 },
    createExercise: vi.fn(),
    deleteExercise: vi.fn(),
    isCreating: false,
    isDeleting: false,
  });
}

describe('ExerciseAutocomplete', () => {
  it('shows built-in common exercises when database has no exercises for the muscle group', async () => {
    mockDbExercises([]);
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithProviders(
      <ExerciseAutocomplete
        value=""
        onChange={onChange}
        muscleGroup="Back"
        placeholder="Select exercise"
      />
    );

    const input = screen.getByPlaceholderText('Select exercise');
    await user.click(input);

    expect(screen.getByText('Deadlift')).toBeInTheDocument();
    expect(screen.getByText('Pull-Up')).toBeInTheDocument();
    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();
  });

  it('keeps common exercises and shows custom exercises when custom exercise is added', async () => {
    mockDbExercises([
      {
        id: 'cust-1',
        name: 'Meadows Row',
        muscleGroup: 'Back',
        equipment: 'Barbell',
        isCustom: true,
      },
    ]);
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithProviders(
      <ExerciseAutocomplete
        value=""
        onChange={onChange}
        muscleGroup="Back"
        placeholder="Select exercise"
      />
    );

    const input = screen.getByPlaceholderText('Select exercise');
    await user.click(input);

    // Custom exercise is shown with Custom badge
    expect(screen.getByText('Meadows Row')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();

    // Standard common exercises are NOT wiped out
    expect(screen.getByText('Deadlift')).toBeInTheDocument();
    expect(screen.getByText('Pull-Up')).toBeInTheDocument();
    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();
  });

  it('deduplicates common exercises if they already exist in database exercises', async () => {
    mockDbExercises([
      {
        id: 'std-1',
        name: 'Deadlift',
        muscleGroup: 'Back',
        equipment: 'Barbell',
        isCustom: false,
      },
    ]);
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithProviders(
      <ExerciseAutocomplete
        value=""
        onChange={onChange}
        muscleGroup="Back"
        placeholder="Select exercise"
      />
    );

    const input = screen.getByPlaceholderText('Select exercise');
    await user.click(input);

    const deadliftElements = screen.getAllByText('Deadlift');
    expect(deadliftElements).toHaveLength(1);
  });

  it('calls onChange with selected exercise name when clicked', async () => {
    mockDbExercises([]);
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithProviders(
      <ExerciseAutocomplete
        value=""
        onChange={onChange}
        muscleGroup="Back"
        placeholder="Select exercise"
      />
    );

    const input = screen.getByPlaceholderText('Select exercise');
    await user.click(input);

    await user.click(screen.getByText('Deadlift'));
    expect(onChange).toHaveBeenCalledWith('Deadlift');
  });
});
