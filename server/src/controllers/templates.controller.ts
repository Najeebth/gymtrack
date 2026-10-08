import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { dbTrace } from '../lib/dbTrace.js';

const MAX_NAME_LENGTH = 60;
const MAX_EXERCISES = 20;
const MAX_SETS = 20;

interface TemplateExerciseInput {
  position: number;
  muscleGroup: string;
  exercise: string;
  sets: { reps: number; weightKg: number }[];
}

const withExercises = { exercises: { orderBy: { position: 'asc' as const } } };

// Validates a template body. Returns the cleaned values, or an error message.
function parseTemplate(body: unknown): { name: string; exercises: TemplateExerciseInput[] } | string {
  const { name, exercises } = (body ?? {}) as { name?: unknown; exercises?: unknown };

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) return 'Template name is required.';
  if (cleanName.length > MAX_NAME_LENGTH) return `Template name must be ${MAX_NAME_LENGTH} characters or fewer.`;

  if (!Array.isArray(exercises) || exercises.length === 0) return 'Add at least one exercise.';
  if (exercises.length > MAX_EXERCISES) return `A template can have at most ${MAX_EXERCISES} exercises.`;

  const cleanExercises: TemplateExerciseInput[] = [];
  for (const [index, raw] of exercises.entries()) {
    const { muscleGroup, exercise, sets } = (raw ?? {}) as { muscleGroup?: unknown; exercise?: unknown; sets?: unknown };
    const cleanExercise = typeof exercise === 'string' ? exercise.trim() : '';
    if (!cleanExercise) return `Exercise ${index + 1} needs a name.`;
    if (!Array.isArray(sets) || sets.length === 0) return `"${cleanExercise}" needs at least one set.`;
    if (sets.length > MAX_SETS) return `"${cleanExercise}" can have at most ${MAX_SETS} sets.`;

    const cleanSets = sets.map((s) => ({ reps: Number(s?.reps), weightKg: Number(s?.weightKg) }));
    if (cleanSets.some((s) => !Number.isInteger(s.reps) || s.reps < 1 || !Number.isFinite(s.weightKg) || s.weightKg < 0)) {
      return `"${cleanExercise}" needs whole-number reps of at least 1 and a weight of 0 or more for every set.`;
    }

    cleanExercises.push({
      position: index,
      muscleGroup: typeof muscleGroup === 'string' && muscleGroup.trim() ? muscleGroup.trim() : 'General',
      exercise: cleanExercise,
      sets: cleanSets,
    });
  }

  return { name: cleanName, exercises: cleanExercises };
}

// GET the authenticated user's templates
export async function listTemplates(req: Request, res: Response): Promise<void> {
  try {
    const templates = await dbTrace('findMany Template', () =>
      prisma.template.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'asc' },
        include: withExercises,
      })
    );
    res.json(templates);
  } catch (err) {
    console.error('Error listing templates:', err);
    res.status(500).json({ error: 'Failed to load templates' });
  }
}

// POST a new template owned by the authenticated user
export async function createTemplate(req: Request, res: Response): Promise<void> {
  const parsed = parseTemplate(req.body);
  if (typeof parsed === 'string') {
    res.status(400).json({ error: parsed });
    return;
  }

  try {
    const template = await dbTrace('create Template (with exercises)', () =>
      prisma.template.create({
        data: { name: parsed.name, userId: req.user!.id, exercises: { create: parsed.exercises } },
        include: withExercises,
      })
    );
    res.status(201).json(template);
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
}

// PUT replaces a template's name and its whole exercise list
export async function updateTemplate(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const parsed = parseTemplate(req.body);
  if (typeof parsed === 'string') {
    res.status(400).json({ error: parsed });
    return;
  }

  try {
    const owned = await prisma.template.findFirst({ where: { id, userId: req.user!.id }, select: { id: true } });
    if (!owned) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const template = await dbTrace(`update Template id:${id}`, () =>
      prisma.template.update({
        where: { id },
        data: { name: parsed.name, exercises: { deleteMany: {}, create: parsed.exercises } },
        include: withExercises,
      })
    );
    res.json(template);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
}

// DELETE a template (its exercises go with it via cascade)
export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const result = await dbTrace(`delete Template id:${id}`, () =>
      prisma.template.deleteMany({ where: { id, userId: req.user!.id } })
    );
    if (result.count === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
}
