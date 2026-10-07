import { useEffect, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import WorkoutCard from '../components/WorkoutCard';
import { getWeekdayName } from '../utils/date';
import type { SaveStatus, Workout, WorkoutDraft } from '../types';

export default function ByDatePage() {
  const { workoutsByDate, fetchWorkoutsByDate, deleteWorkout, saveEditWorkout } = useAppData();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<WorkoutDraft>({
    date: '',
    muscleGroup: '',
    exercise: '',
    notes: '',
    sets: []
  });
  const [editSaveStatus, setEditSaveStatus] = useState<SaveStatus>(null);

  useEffect(() => {
    fetchWorkoutsByDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const startEditWorkout = (w: Workout) => {
    setEditingWorkoutId(w.id);
    setEditDraft({
      date: w.date,
      muscleGroup: w.muscleGroup,
      exercise: w.exercise,
      notes: w.notes || '',
      sets: (w.sets || []).map((s) => ({ id: s.id, reps: s.reps, weightKg: s.weightKg }))
    });
  };

  const cancelEditWorkout = () => setEditingWorkoutId(null);

  const addEditSetRow = () => {
    setEditDraft((prev) => {
      const last = prev.sets[prev.sets.length - 1] || { reps: 10, weightKg: 60 };
      return { ...prev, sets: [...prev.sets, { reps: last.reps, weightKg: last.weightKg }] };
    });
  };

  const removeEditSetRow = (index: number) => {
    setEditDraft((prev) => ({
      ...prev,
      sets: prev.sets.length > 1 ? prev.sets.filter((_, i) => i !== index) : prev.sets
    }));
  };

  const updateEditSetRow = (index: number, field: 'reps' | 'weightKg', value: string) => {
    setEditDraft((prev) => ({
      ...prev,
      sets: prev.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    }));
  };

  const saveEdit = async (workout: Workout) => {
    if (!editDraft.exercise.trim() || editDraft.sets.length === 0) return;
    setEditSaveStatus('saving');
    const result = await saveEditWorkout(workout, editDraft);
    setEditingWorkoutId(null);
    if (result === 'queued') {
      setEditSaveStatus('queued');
      setTimeout(() => setEditSaveStatus(null), 2500);
    } else {
      setEditSaveStatus(null);
    }
  };

  const setsForSelectedDate = workoutsByDate.reduce((acc, w) => acc + (w.sets?.length || 0), 0);
  const volumeForSelectedDate = workoutsByDate.reduce(
    (sum, w) => sum + (w.sets || []).reduce((s, set) => s + set.reps * set.weightKg, 0),
    0
  );

  return (
    <div>
      <div className="bg-white p-[18px] rounded-xl border border-brand-border mb-5">
        <label className="text-xs text-brand-muted block mb-1.5">Choose a date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-500 rounded-md text-slate-800 text-[0.95rem]"
        />
        <div className="text-sm text-brand-orange mt-2">{getWeekdayName(selectedDate)}</div>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="bg-white p-3.5 rounded-[10px] border border-brand-border">
          <div className="text-sm text-brand-muted">Exercises Logged</div>
          <div className="text-xl font-bold mt-1">{workoutsByDate.length}</div>
        </div>
        <div className="bg-white p-3.5 rounded-[10px] border border-brand-border">
          <div className="text-sm text-brand-muted">Sets Logged</div>
          <div className="text-xl font-bold mt-1">{setsForSelectedDate}</div>
        </div>
        <div className="bg-white p-3.5 rounded-[10px] border border-brand-border">
          <div className="text-sm text-brand-muted">Tonnage Moved</div>
          <div className="text-xl font-bold mt-1 text-brand-orange">
            {(volumeForSelectedDate / 1000).toFixed(1)} <span className="text-sm">tonnes</span>
          </div>
        </div>
      </div>

      {workoutsByDate.length === 0 ? (
        <div className="text-center p-[30px] bg-white rounded-[10px] text-brand-muted">
          No workouts logged on {selectedDate} ({getWeekdayName(selectedDate)}).
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {workoutsByDate.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              isEditing={editingWorkoutId === w.id}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              addEditSetRow={addEditSetRow}
              removeEditSetRow={removeEditSetRow}
              updateEditSetRow={updateEditSetRow}
              onSave={() => saveEdit(w)}
              onCancel={cancelEditWorkout}
              saveStatus={editSaveStatus}
              onEdit={() => startEditWorkout(w)}
              onDelete={() => deleteWorkout(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
