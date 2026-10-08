import { useState, type FormEvent } from 'react';
import { ClipboardList, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useTemplates } from '../hooks/useTemplates';
import ExerciseAutocomplete from '../components/ExerciseAutocomplete';
import { COMMON_EXERCISES } from '../constants/exercises';
import type { Template, TemplateDraft } from '../types';

const MUSCLE_GROUPS = Object.keys(COMMON_EXERCISES);
const fieldInput = 'w-full px-2.5 py-2 bg-slate-50 border border-slate-500 rounded-md text-slate-800';
const fieldLabel = 'text-xs text-brand-muted block mb-1';
const today = () => new Date().toISOString().split('T')[0];

const emptyExercise = () => ({ muscleGroup: 'Chest', exercise: '', sets: [{ reps: 10, weightKg: 60 }] });
const emptyDraft = (): TemplateDraft => ({ name: '', exercises: [emptyExercise()] });

function toDraft(template: Template): TemplateDraft {
  return {
    name: template.name,
    exercises: template.exercises.map((e) => ({
      muscleGroup: e.muscleGroup,
      exercise: e.exercise,
      sets: e.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg }))
    }))
  };
}

export default function TemplatesPage() {
  const { templates, loading, loadError, saveTemplate, removeTemplate } = useTemplates();
  // null = builder closed, 'new' = creating, otherwise the id being edited
  const [editing, setEditing] = useState<string | null>(null);

  const editingTemplate = templates.find((t) => t.id === editing);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-1.5">
            <ClipboardList size={20} className="text-brand-orange" /> Workout Templates
          </h1>
          <p className="text-sm text-brand-muted">Save a routine once, then log the whole session in one click.</p>
        </div>
        {editing === null && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 bg-brand-navy text-white border-none rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer"
          >
            <Plus size={16} /> New template
          </button>
        )}
      </div>

      {editing !== null && (
        <TemplateEditor
          key={editing}
          initial={editingTemplate ? toDraft(editingTemplate) : emptyDraft()}
          isNew={!editingTemplate}
          onCancel={() => setEditing(null)}
          onSave={async (draft) => {
            const error = await saveTemplate(draft, editingTemplate?.id);
            if (!error) setEditing(null);
            return error;
          }}
        />
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-brand-danger rounded-lg p-3 text-sm mb-4">{loadError}</div>
      )}

      {loading ? (
        <div className="text-brand-muted text-sm">Loading templates…</div>
      ) : templates.length === 0 && editing === null && !loadError ? (
        <div className="text-center p-[30px] bg-white rounded-[10px] text-brand-muted">
          No templates yet. Create one for a session you repeat, like "Push Day".
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates
            .filter((t) => t.id !== editing)
            .map((t) => (
              <TemplateCard key={t.id} template={t} onEdit={() => setEditing(t.id)} onDelete={() => removeTemplate(t.id)} />
            ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onEdit, onDelete }: { template: Template; onEdit: () => void; onDelete: () => void }) {
  const { logRoutine } = useAppData();
  const [date, setDate] = useState(today);
  const [logging, setLogging] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const totalSets = template.exercises.reduce((n, e) => n + e.sets.length, 0);

  const handleLog = async () => {
    setLogging(true);
    await logRoutine(
      template.exercises.map((e) => ({
        date,
        muscleGroup: e.muscleGroup,
        exercise: e.exercise,
        notes: '',
        sets: e.sets
      }))
    );
    setLogging(false);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-brand-border">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <h2 className="text-base font-semibold">{template.name}</h2>
          <div className="text-xs text-brand-muted">
            {template.exercises.length} exercise{template.exercises.length === 1 ? '' : 's'} · {totalSets} set
            {totalSets === 1 ? '' : 's'}
          </div>
        </div>
        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-brand-muted">Delete this template?</span>
            <button
              onClick={onDelete}
              className="bg-brand-danger text-white border-none rounded-md px-2.5 py-1 font-semibold cursor-pointer"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="bg-transparent border border-brand-border text-brand-muted rounded-md px-2.5 py-1 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              title="Edit template"
              aria-label={`Edit ${template.name}`}
              className="bg-transparent border-none text-brand-muted cursor-pointer p-1.5"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              title="Delete template"
              aria-label={`Delete ${template.name}`}
              className="bg-transparent border-none text-red-400 cursor-pointer p-1.5"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-1.5 mb-4 list-none">
        {template.exercises.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs uppercase bg-brand-navy text-sky-100 px-2 py-0.5 rounded font-bold">{e.muscleGroup}</span>
            <span className="font-medium">{e.exercise}</span>
            <span className="text-brand-muted">{e.sets.map((s) => `${s.reps}×${s.weightKg}kg`).join(', ')}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date to log this routine on"
          className="px-2.5 py-2 bg-slate-50 border border-slate-500 rounded-md text-slate-800 text-sm"
        />
        <button
          onClick={handleLog}
          disabled={logging || !date}
          className="flex items-center gap-1.5 bg-brand-orange text-white border-none rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Play size={15} /> {logging ? 'Logging…' : 'Log this routine'}
        </button>
      </div>
    </div>
  );
}

function TemplateEditor({
  initial,
  isNew,
  onSave,
  onCancel
}: {
  initial: TemplateDraft;
  isNew: boolean;
  onSave: (draft: TemplateDraft) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TemplateDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateExercise = (index: number, change: Partial<TemplateDraft['exercises'][number]>) =>
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e, i) => (i === index ? { ...e, ...change } : e))
    }));

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weightKg', value: string) =>
    updateExercise(exerciseIndex, {
      sets: draft.exercises[exerciseIndex].sets.map((s, i) => (i === setIndex ? { ...s, [field]: value } : s))
    });

  const addSet = (exerciseIndex: number) => {
    const sets = draft.exercises[exerciseIndex].sets;
    const last = sets[sets.length - 1];
    updateExercise(exerciseIndex, { sets: [...sets, { reps: last.reps, weightKg: last.weightKg }] });
  };

  const removeSet = (exerciseIndex: number, setIndex: number) =>
    updateExercise(exerciseIndex, { sets: draft.exercises[exerciseIndex].sets.filter((_, i) => i !== setIndex) });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const saveError = await onSave(draft);
    setSaving(false);
    if (saveError) setError(saveError);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-[18px] rounded-xl border border-brand-orange mb-5">
      <h2 className="text-base font-semibold mb-3.5">{isNew ? 'New template' : 'Edit template'}</h2>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-brand-danger rounded-lg p-2.5 text-sm mb-3">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className={fieldLabel} htmlFor="template-name">
          Template name
        </label>
        <input
          id="template-name"
          type="text"
          required
          maxLength={60}
          placeholder="e.g. Push Day"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className={fieldInput}
        />
      </div>

      <div className="flex flex-col gap-3 mb-3">
        {draft.exercises.map((exercise, exerciseIndex) => (
          <div key={exerciseIndex} className="border border-brand-border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-brand-muted uppercase tracking-wide">Exercise {exerciseIndex + 1}</span>
              {draft.exercises.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((_, i) => i !== exerciseIndex) })}
                  className="bg-transparent border-none text-red-400 text-xs cursor-pointer"
                >
                  Remove exercise
                </button>
              )}
            </div>

            <div className="grid grid-cols-[160px_1fr] gap-2.5 mb-2.5">
              <div>
                <label className={fieldLabel}>Muscle group</label>
                <select
                  value={exercise.muscleGroup}
                  onChange={(e) => updateExercise(exerciseIndex, { muscleGroup: e.target.value })}
                  className={fieldInput}
                >
                  {MUSCLE_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Exercise name</label>
                <ExerciseAutocomplete
                  value={exercise.exercise}
                  onChange={(value) => updateExercise(exerciseIndex, { exercise: value })}
                  muscleGroup={exercise.muscleGroup}
                  placeholder="e.g. Barbell Bench Press"
                  required
                  className={fieldInput}
                />
              </div>
            </div>

            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-brand-muted">Sets (reps × weight in kg)</span>
              <button
                type="button"
                onClick={() => addSet(exerciseIndex)}
                className="flex items-center gap-1 bg-transparent border border-slate-500 text-brand-orange rounded-md px-2 py-1 text-xs cursor-pointer"
              >
                <Plus size={12} /> Add set
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {exercise.sets.map((set, setIndex) => (
                <div key={setIndex} className="grid grid-cols-[28px_1fr_1fr_28px] gap-2 items-center">
                  <span className="text-xs text-brand-muted text-center">#{setIndex + 1}</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="Reps"
                    aria-label={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} reps`}
                    value={set.reps}
                    onChange={(e) => updateSet(exerciseIndex, setIndex, 'reps', e.target.value)}
                    className={fieldInput}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    placeholder="Weight (kg)"
                    aria-label={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} weight in kg`}
                    value={set.weightKg}
                    onChange={(e) => updateSet(exerciseIndex, setIndex, 'weightKg', e.target.value)}
                    className={fieldInput}
                  />
                  <button
                    type="button"
                    onClick={() => removeSet(exerciseIndex, setIndex)}
                    disabled={exercise.sets.length === 1}
                    title="Remove set"
                    className={`bg-transparent border-none flex justify-center ${
                      exercise.sets.length === 1 ? 'text-slate-500 cursor-not-allowed' : 'text-red-400 cursor-pointer'
                    }`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDraft({ ...draft, exercises: [...draft.exercises, emptyExercise()] })}
        className="flex items-center gap-1 bg-transparent border border-dashed border-slate-400 text-brand-muted rounded-lg px-3 py-2 text-sm cursor-pointer w-full justify-center mb-4"
      >
        <Plus size={14} /> Add exercise
      </button>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-lg border-none font-semibold bg-brand-navy text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : isNew ? 'Save template' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg border border-brand-border bg-transparent text-brand-muted font-semibold cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
