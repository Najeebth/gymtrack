import { useState, type FormEvent } from 'react';
import { PlusCircle, Plus, X, RefreshCw } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import WorkoutCard from '../components/WorkoutCard';
import type { SaveStatus, SetDraft, Workout, WorkoutDraft } from '../types';

const fieldInput = 'w-full px-2.5 py-2 bg-slate-50 border border-slate-500 rounded-md text-slate-800';
const fieldLabel = 'text-xs text-brand-muted block mb-1';

export default function WorkoutsPage() {
  const { workouts, createWorkout, deleteWorkout, saveEditWorkout, fetchWorkouts } = useAppData();

  const [formData, setFormData] = useState<WorkoutDraft>({
    date: new Date().toISOString().split('T')[0],
    muscleGroup: 'Chest',
    exercise: '',
    notes: '',
    sets: [{ reps: 10, weightKg: 60 }]
  });
  const [submitStatus, setSubmitStatus] = useState<SaveStatus>(null);

  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<WorkoutDraft>({
    date: '',
    muscleGroup: '',
    exercise: '',
    notes: '',
    sets: []
  });
  const [editSaveStatus, setEditSaveStatus] = useState<SaveStatus>(null);

  const addSetRow = () => {
    setFormData((prev) => {
      const last = prev.sets[prev.sets.length - 1] || { reps: 10, weightKg: 60 };
      return { ...prev, sets: [...prev.sets, { reps: last.reps, weightKg: last.weightKg }] };
    });
  };

  const removeSetRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sets: prev.sets.length > 1 ? prev.sets.filter((_, i) => i !== index) : prev.sets
    }));
  };

  const updateSetRow = (index: number, field: 'reps' | 'weightKg', value: string) => {
    setFormData((prev) => ({
      ...prev,
      sets: prev.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.exercise.trim()) return;

    const payload = { ...formData };
    setSubmitStatus('saving');
    const result = await createWorkout(payload);
    setFormData({ ...formData, exercise: '', notes: '', sets: [{ reps: 10, weightKg: 60 }] });
    if (result === 'queued') {
      setSubmitStatus('queued');
      setTimeout(() => setSubmitStatus(null), 2500);
    } else {
      setSubmitStatus(null);
    }
  };

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

  const totalLoggedSets = workouts.reduce((acc, w) => acc + (w.sets?.length || 0), 0);
  const totalVolume = workouts.reduce(
    (sum, w) => sum + (w.sets || []).reduce((s, set) => s + set.reps * set.weightKg, 0),
    0
  );

  return (
    <div>
      {/* Quick Metrics Bar */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="bg-white p-3.5 rounded-[10px] border border-brand-border">
          <div className="text-sm text-brand-muted">Total Logged Sets</div>
          <div className="text-xl font-bold mt-1">{totalLoggedSets}</div>
        </div>
        <div className="bg-white p-3.5 rounded-[10px] border border-brand-border">
          <div className="text-sm text-brand-muted">Total Tonnage Moved</div>
          <div className="text-xl font-bold mt-1 text-brand-orange">
            {(totalVolume / 1000).toFixed(1)} <span className="text-sm">tonnes</span>
          </div>
        </div>
      </div>

      {/* Log New Workout Form */}
      <form onSubmit={handleSubmit} className="bg-white p-[18px] rounded-xl border border-brand-border mb-6">
        <h2 className="text-base font-semibold mb-3.5 flex items-center gap-1.5">
          <PlusCircle size={18} className="text-brand-orange" /> Log Session Exercise
        </h2>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div>
            <label className={fieldLabel}>Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>Muscle Group</label>
            <select
              value={formData.muscleGroup}
              onChange={(e) => setFormData({ ...formData, muscleGroup: e.target.value })}
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

        <div className="mb-3">
          <label className={fieldLabel}>Exercise Name</label>
          <input
            type="text"
            placeholder="e.g. Barbell Incline Press, Romanian Deadlift"
            value={formData.exercise}
            onChange={(e) => setFormData({ ...formData, exercise: e.target.value })}
            required
            className={fieldInput}
          />
        </div>

        <div className="mb-3.5">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs text-brand-muted">Sets (reps × weight per set)</label>
            <button
              type="button"
              onClick={addSetRow}
              className="flex items-center gap-1 bg-transparent border border-slate-500 text-brand-orange rounded-md px-2 py-1 text-xs cursor-pointer"
            >
              <Plus size={12} /> Add Set
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {formData.sets.map((s: SetDraft, idx) => (
              <div key={idx} className="grid grid-cols-[28px_1fr_1fr_28px] gap-2 items-center">
                <span className="text-xs text-brand-muted text-center">#{idx + 1}</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Reps"
                  value={s.reps}
                  onChange={(e) => updateSetRow(idx, 'reps', e.target.value)}
                  className={fieldInput}
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Weight (kg)"
                  value={s.weightKg}
                  onChange={(e) => updateSetRow(idx, 'weightKg', e.target.value)}
                  className={fieldInput}
                />
                <button
                  type="button"
                  onClick={() => removeSetRow(idx)}
                  disabled={formData.sets.length === 1}
                  title="Remove set"
                  className={`bg-transparent border-none flex justify-center ${
                    formData.sets.length === 1 ? 'text-slate-500 cursor-not-allowed' : 'text-red-400 cursor-pointer'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitStatus === 'saving'}
          className={`w-full py-2.5 rounded-lg border-none font-semibold ${
            submitStatus === 'saving' ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
          } ${submitStatus === 'queued' ? 'bg-orange-900 text-orange-200' : 'bg-brand-navy text-white'}`}
        >
          {submitStatus === 'saving'
            ? 'Saving…'
            : submitStatus === 'queued'
            ? 'Offline — saved locally, will sync later'
            : 'Save Entry & Broadcast API Call'}
        </button>
      </form>

      {/* Workout History List */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold">Recent Exercises</h2>
          <button
            onClick={() => fetchWorkouts()}
            className="bg-transparent border-none text-brand-muted cursor-pointer flex items-center gap-1 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {workouts.length === 0 ? (
          <div className="text-center p-[30px] bg-white rounded-[10px] text-brand-muted">
            No workouts logged yet. Add your first set above!
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {workouts.map((w) => (
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
    </div>
  );
}
