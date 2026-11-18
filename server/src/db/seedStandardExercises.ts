import { prisma } from './prisma.js';

export const STANDARD_EXERCISES = [
  // Chest
  { name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { name: 'Flat Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { name: 'Cable Chest Fly', muscleGroup: 'Chest', equipment: 'Cable' },
  { name: 'Push-Up', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { name: 'Chest Dips', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  // Back
  { name: 'Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'Pull-Up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { name: 'Seated Cable Row', muscleGroup: 'Back', equipment: 'Cable' },
  { name: 'Barbell Bent-Over Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'T-Bar Row', muscleGroup: 'Back', equipment: 'Machine' },
  // Legs
  { name: 'Barbell Squat', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Walking Lunges', muscleGroup: 'Legs', equipment: 'Dumbbell' },
  { name: 'Hamstring Leg Curl', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Leg Extension', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Standing Calf Raise', muscleGroup: 'Legs', equipment: 'Machine' },
  // Shoulders
  { name: 'Overhead Barbell Press', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { name: 'Dumbbell Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Face Pull', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { name: 'Arnold Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Rear Delt Fly', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  // Arms
  { name: 'Barbell Bicep Curl', muscleGroup: 'Arms', equipment: 'Barbell' },
  { name: 'Dumbbell Hammer Curl', muscleGroup: 'Arms', equipment: 'Dumbbell' },
  { name: 'Tricep Rope Pushdown', muscleGroup: 'Arms', equipment: 'Cable' },
  { name: 'Skull Crusher', muscleGroup: 'Arms', equipment: 'Barbell' },
  { name: 'Preacher Curl', muscleGroup: 'Arms', equipment: 'Machine' },
  { name: 'Close-Grip Bench Press', muscleGroup: 'Arms', equipment: 'Barbell' },
  // Core
  { name: 'Plank', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { name: 'Cable Woodchopper', muscleGroup: 'Core', equipment: 'Cable' },
  { name: 'Ab Wheel Rollout', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { name: 'Russian Twist', muscleGroup: 'Core', equipment: 'Bodyweight' },
];

/**
 * Checks if the database has any standard (public) exercises.
 * If none exist (e.g. freshly deployed instance on Render where seed was not run),
 * auto-populates the standard exercise library.
 */
export async function ensureStandardExercises(): Promise<void> {
  try {
    const standardCount = await prisma.exercise.count({
      where: { isCustom: false },
    });

    if (standardCount > 0) {
      return;
    }

    console.log('No standard exercises found in database. Auto-seeding standard exercises...');
    for (const ex of STANDARD_EXERCISES) {
      const existing = await prisma.exercise.findFirst({
        where: { name: ex.name, isCustom: false },
      });
      if (!existing) {
        await prisma.exercise.create({
          data: {
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            equipment: ex.equipment,
            isCustom: false,
          },
        });
      }
    }
    console.log(`Auto-seeded ${STANDARD_EXERCISES.length} standard exercises.`);
  } catch (err) {
    console.warn('Could not verify or auto-seed standard exercises:', err);
  }
}
