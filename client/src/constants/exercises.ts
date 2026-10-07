import type { MuscleGroup } from '../types';

// Common exercises offered as suggestions per muscle group (free text still allowed)
export const COMMON_EXERCISES: Record<MuscleGroup, string[]> = {
  Chest: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Flat Dumbbell Press', 'Chest Fly', 'Push-Up', 'Dips'],
  Back: ['Deadlift', 'Pull-Up', 'Lat Pulldown', 'Seated Cable Row', 'Barbell Row', 'T-Bar Row'],
  Legs: ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Lunges', 'Leg Curl', 'Leg Extension', 'Calf Raise'],
  Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Face Pull', 'Arnold Press', 'Rear Delt Fly'],
  Arms: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skull Crusher', 'Preacher Curl', 'Close-Grip Bench Press'],
  Core: ['Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Russian Twist', 'Ab Wheel Rollout', 'Sit-Up']
};
