import { Plus, X, Check } from 'lucide-react';
import type { WorkoutDraft, SaveStatus } from '../types';

interface EditWorkoutFormProps {
  editDraft: WorkoutDraft;
  setEditDraft: (draft: WorkoutDraft) => void;
  addEditSetRow: () => void;
  removeEditSetRow: (index: number) => void;
  updateEditSetRow: (index: number, field: 'reps' | 'weightKg', value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveStatus: SaveStatus;
}

const fieldInput =
  'w-full px-2.5 py-1.5 bg-slate-50 border border-slate-500 rounded-md text-slate-800';
const fieldLabel = 'text-xs text-brand-muted block mb-1';

// A single consolidated edit form for a workout record: date, muscle group,
// exercise, notes, and every set (editable, addable, removable) — all behind
// one "Edit" button and one "Save" action, instead of separate per-field controls.
export default function EditWorkoutForm({
  editDraft,
  setEditDraft,
  addEditSetRow,
  removeEditSetRow,
  updateEditSetRow,
  onSave,
  onCancel,
  saveStatus
}: EditWorkoutFormProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={fieldLabel}>Date</label>
          <input
            type="date"
            value={editDraft.date}
            onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Muscle Group</label>
          <select
            value={editDraft.muscleGroup}
            onChange={(e) => setEditDraft({ ...editDraft, muscleGroup: e.target.value })}
            className={fieldInput}
          >
            <option value="Chest">Chest</option>
            <option value="Back">Back</option>
            <option value="Legs">Legs</option>
            <option value="Shoulders">Shoulders</option>
            <option value="Arms">Arms</option>
            <option value="Core">Core</option>
          </select>
        </div>
      </div>

      <div>
        <label className={fieldLabel}>Exercise Name</label>
        <input
          type="text"
          value={editDraft.exercise}
          onChange={(e) => setEditDraft({ ...editDraft, exercise: e.target.value })}
          placeholder="Exercise name"
          className={fieldInput}
        />
      </div>

      <div>
        <label className={fieldLabel}>Notes</label>
        <input
          type="text"
          value={editDraft.notes}
          onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
          placeholder="Notes"
          className={fieldInput}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs text-brand-muted">Sets (reps × weight per set)</label>
          <button
            type="button"
            onClick={addEditSetRow}
            className="flex items-center gap-1 bg-transparent border border-slate-500 text-brand-orange rounded-md px-2 py-1 text-xs cursor-pointer"
          >
            <Plus size={12} /> Add Set
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {editDraft.sets.map((s, idx) => (
            <div key={idx} className="grid grid-cols-[28px_1fr_1fr_28px] gap-2 items-center">
              <span className="text-xs text-brand-muted text-center">#{idx + 1}</span>
              <input
                type="number"
                min="1"
                placeholder="Reps"
                value={s.reps}
                onChange={(e) => updateEditSetRow(idx, 'reps', e.target.value)}
                className={fieldInput}
              />
              <input
                type="number"
                step="0.5"
                placeholder="Weight (kg)"
                value={s.weightKg}
                onChange={(e) => updateEditSetRow(idx, 'weightKg', e.target.value)}
                className={fieldInput}
              />
              <button
                type="button"
                onClick={() => removeEditSetRow(idx)}
                disabled={editDraft.sets.length === 1}
                title="Remove set"
                className={`bg-transparent border-none flex justify-center ${
                  editDraft.sets.length === 1 ? 'text-slate-500 cursor-not-allowed' : 'text-red-400 cursor-pointer'
                }`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 justify-end">
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className={`border-none rounded-md px-3.5 py-2 flex items-center gap-1 font-semibold ${
            saveStatus === 'saving' ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
          } ${saveStatus === 'queued' ? 'bg-orange-900 text-orange-200' : 'bg-brand-navy text-sky-100'}`}
        >
          <Check size={14} />
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'queued' ? 'Offline — queued' : 'Save Record'}
        </button>
        <button
          onClick={onCancel}
          className="bg-transparent border border-slate-500 rounded-md text-brand-muted px-3.5 py-2 flex items-center gap-1 cursor-pointer"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
