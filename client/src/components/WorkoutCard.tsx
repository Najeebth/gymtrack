import { Pencil, Trash2 } from 'lucide-react';
import type { Workout } from '../types';
import { getWeekdayName } from '../utils/date';
import EditWorkoutForm from './EditWorkoutForm';
import type { WorkoutDraft, SaveStatus } from '../types';

interface WorkoutCardProps {
  workout: Workout;
  isEditing: boolean;
  editDraft: WorkoutDraft;
  setEditDraft: (draft: WorkoutDraft) => void;
  addEditSetRow: () => void;
  removeEditSetRow: (index: number) => void;
  updateEditSetRow: (index: number, field: 'reps' | 'weightKg', value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveStatus: SaveStatus;
  onEdit: () => void;
  onDelete: () => void;
}

export default function WorkoutCard({
  workout: w,
  isEditing,
  editDraft,
  setEditDraft,
  addEditSetRow,
  removeEditSetRow,
  updateEditSetRow,
  onSave,
  onCancel,
  saveStatus,
  onEdit,
  onDelete
}: WorkoutCardProps) {
  return (
    <div
      className={`bg-white px-4 py-3 rounded-xl border ${
        isEditing ? 'border-brand-orange' : 'border-brand-border'
      }`}
    >
      {isEditing ? (
        <EditWorkoutForm
          editDraft={editDraft}
          setEditDraft={setEditDraft}
          addEditSetRow={addEditSetRow}
          removeEditSetRow={removeEditSetRow}
          updateEditSetRow={updateEditSetRow}
          onSave={onSave}
          onCancel={onCancel}
          saveStatus={saveStatus}
        />
      ) : (
        <>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase bg-brand-navy text-sky-100 px-2 py-0.5 rounded font-bold">
                  {w.muscleGroup}
                </span>
                <strong className="text-base text-brand-navy">{w.exercise}</strong>
              </div>
              <div className="text-sm text-brand-muted mt-1">
                {w.sets?.length || 0} sets &nbsp;·&nbsp; {w.date} ({getWeekdayName(w.date)})
              </div>
              {w.notes && <div className="text-[0.78rem] text-brand-muted mt-1 italic">"{w.notes}"</div>}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={onEdit}
                title="Edit record"
                className="bg-brand-border border-none rounded-md text-brand-navy p-2 cursor-pointer flex items-center gap-1 text-xs font-semibold"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={onDelete}
                title="Delete workout"
                className="bg-red-900 border-none rounded-md text-red-300 p-2 cursor-pointer flex"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {(w.sets || []).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 bg-slate-50 border border-brand-border rounded-md px-2 py-1 text-sm"
              >
                <span className="text-brand-muted">#{s.setNumber}</span>
                <span className="text-brand-navy">{s.reps} reps</span>
                <span className="text-brand-orange font-semibold">@ {s.weightKg} kg</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
