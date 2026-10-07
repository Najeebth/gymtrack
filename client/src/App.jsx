import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Dumbbell, PlusCircle, Trash2, RefreshCw, BarChart2, ShieldCheck, Zap, Map, Plus, X, CalendarDays, Pencil, Check, TrendingUp, Lock, Unlock, LogIn, User } from 'lucide-react';
import LiveTrafficMap from './LiveTrafficMap.jsx';
import { addPendingWorkout, addPendingOperation, getAllPending, removePending, countPending } from './offlineStore.js';

const API_BASE = import.meta.env.VITE_API_URL || 'https://gymtrack-prdf.onrender.com';

// Returns just the weekday name for a 'YYYY-MM-DD' date string (e.g. "Sunday")
function getWeekdayName(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

// A single consolidated edit form for a workout record: date, muscle group,
// exercise, notes, and every set (editable, addable, removable) — all behind
// one "Edit" button and one "Save" action, instead of separate per-field controls.
function EditWorkoutForm({ editDraft, setEditDraft, addEditSetRow, removeEditSetRow, updateEditSetRow, onSave, onCancel, saveStatus }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Date</label>
          <input
            type="date"
            value={editDraft.date}
            onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Muscle Group</label>
          <select
            value={editDraft.muscleGroup}
            onChange={(e) => setEditDraft({ ...editDraft, muscleGroup: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}>
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
        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Exercise Name</label>
        <input
          type="text"
          value={editDraft.exercise}
          onChange={(e) => setEditDraft({ ...editDraft, exercise: e.target.value })}
          placeholder="Exercise name"
          style={{ width: '100%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Notes</label>
        <input
          type="text"
          value={editDraft.notes}
          onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
          placeholder="Notes"
          style={{ width: '100%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
        />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Sets (reps × weight per set)</label>
          <button
            type="button"
            onClick={addEditSetRow}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid #475569', color: '#f97316', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
            <Plus size={12} /> Add Set
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {editDraft.sets.map((s, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 28px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>#{idx + 1}</span>
              <input
                type="number"
                min="1"
                placeholder="Reps"
                value={s.reps}
                onChange={(e) => updateEditSetRow(idx, 'reps', e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
              />
              <input
                type="number"
                step="0.5"
                placeholder="Weight (kg)"
                value={s.weightKg}
                onChange={(e) => updateEditSetRow(idx, 'weightKg', e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
              />
              <button
                type="button"
                onClick={() => removeEditSetRow(idx)}
                disabled={editDraft.sets.length === 1}
                title="Remove set"
                style={{ background: 'transparent', border: 'none', color: editDraft.sets.length === 1 ? '#475569' : '#f87171', cursor: editDraft.sets.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          style={{
            background: saveStatus === 'queued' ? '#7c2d12' : '#1e293b',
            border: 'none',
            borderRadius: 6,
            color: saveStatus === 'queued' ? '#fed7aa' : '#e0f2fe',
            padding: '8px 14px',
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 600,
            opacity: saveStatus === 'saving' ? 0.7 : 1
          }}>
          <Check size={14} />
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'queued' ? 'Offline — queued' : 'Save Record'}
        </button>
        <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid #475569', borderRadius: 6, color: '#64748b', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

// Lightweight SVG line chart (no charting library) showing a chosen exercise's
// trend over time: either heaviest set per session or total volume moved.
function ProgressChart({ workouts }) {
  const exercises = useMemo(
    () => Array.from(new Set(workouts.map((w) => w.exercise).filter(Boolean))).sort(),
    [workouts]
  );
  const [selectedExercise, setSelectedExercise] = useState('');
  const [metric, setMetric] = useState('maxWeight'); // 'maxWeight' | 'volume'

  useEffect(() => {
    if (!selectedExercise && exercises.length > 0) setSelectedExercise(exercises[0]);
    if (selectedExercise && !exercises.includes(selectedExercise) && exercises.length > 0) {
      setSelectedExercise(exercises[0]);
    }
  }, [exercises, selectedExercise]);

  const series = useMemo(() => {
    return workouts
      .filter((w) => w.exercise === selectedExercise)
      .map((w) => {
        const sets = w.sets || [];
        const maxWeight = sets.reduce((m, s) => Math.max(m, s.weightKg || 0), 0);
        const volume = sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weightKg || 0), 0);
        return { date: w.date, maxWeight, volume };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [workouts, selectedExercise]);

  const width = 600;
  const height = 220;
  const padX = 36;
  const padY = 24;

  const values = series.map((p) => p[metric]);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const points = series.map((p, i) => {
    const x = series.length === 1 ? width / 2 : padX + (i * (width - 2 * padX)) / (series.length - 1);
    const y = height - padY - ((p[metric] - minVal) / range) * (height - 2 * padY);
    return { x, y, ...p };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  if (exercises.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        Log a few workouts first — charts show up here once there's data to plot.
      </div>
    );
  }

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}>
          {exercises.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setMetric('maxWeight')}
            style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              background: metric === 'maxWeight' ? '#f97316' : '#e2e8f0', color: metric === 'maxWeight' ? '#ffffff' : '#1e293b'
            }}>
            Top Set (kg)
          </button>
          <button
            onClick={() => setMetric('volume')}
            style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              background: metric === 'volume' ? '#f97316' : '#e2e8f0', color: metric === 'volume' ? '#ffffff' : '#1e293b'
            }}>
            Session Volume (kg)
          </button>
        </div>
      </div>

      {series.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No logged sessions for this exercise yet.</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
          {/* Horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padX} x2={width - padX}
              y1={padY + f * (height - 2 * padY)} y2={padY + f * (height - 2 * padY)}
              stroke="#e2e8f0" strokeWidth="1"
            />
          ))}

          {points.length > 1 && <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2.5" />}

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#ea580c" stroke="#f8fafc" strokeWidth="1.5" />
              <title>{`${p.date}: ${p[metric]} ${metric === 'maxWeight' ? 'kg top set' : 'kg total volume'}`}</title>
            </g>
          ))}
        </svg>
      )}

      {series.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.75rem', color: '#64748b' }}>
          <span>{series[0].date}</span>
          {series.length > 1 && <span>{series[series.length - 1].date}</span>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('workouts'); // 'workouts' | 'byDate' | 'traffic' | 'health' | 'map' | 'admin'
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [workouts, setWorkouts] = useState([]);
  const [trafficLogs, setTrafficLogs] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastApiLatency, setLastApiLatency] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutsByDate, setWorkoutsByDate] = useState([]);

  // Offline-first state: whether the browser currently has connectivity, and
  // how many workouts are queued locally in IndexedDB waiting to sync.
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Save-button feedback: 'saving' while the API call is in flight, 'queued'
  // briefly after it falls back to the offline queue, so the button itself
  // tells the user what happened instead of looking like it silently worked.
  const [submitStatus, setSubmitStatus] = useState(null);
  const [editSaveStatus, setEditSaveStatus] = useState(null);

  // Inline-edit state: which workout is being edited (one "Edit" button per record),
  // and its full draft — workout fields plus every set (editable, addable, removable).
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [editDraft, setEditDraft] = useState({ date: '', muscleGroup: '', exercise: '', notes: '', sets: [] });

  // Form State — now holds an array of individual sets (reps + weight each)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    muscleGroup: 'Chest',
    exercise: '',
    notes: '',
    sets: [{ reps: 10, weightKg: 60 }]
  });

  // Add a blank set row to the form, pre-filled from the last set for convenience
  const addSetRow = () => {
    setFormData((prev) => {
      const last = prev.sets[prev.sets.length - 1] || { reps: 10, weightKg: 60 };
      return { ...prev, sets: [...prev.sets, { reps: last.reps, weightKg: last.weightKg }] };
    });
  };

  // Remove a set row by index (keeps at least 1 row)
  const removeSetRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      sets: prev.sets.length > 1 ? prev.sets.filter((_, i) => i !== index) : prev.sets
    }));
  };

  // Update one field (reps/weightKg) of a specific set row
  const updateSetRow = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      sets: prev.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    }));
  };

  // Fetch Workouts (optionally scoped server-side to a single date)
  const fetchWorkouts = async (date) => {
    setLoading(true);
    const start = performance.now();
    try {
      const url = date ? `${API_BASE}/api/workouts?date=${encodeURIComponent(date)}` : `${API_BASE}/api/workouts`;
      const res = await fetch(url);
      const data = await res.json();
      if (date) {
        setWorkoutsByDate(data);
      } else {
        setWorkouts(data);
      }
      setLastApiLatency((performance.now() - start).toFixed(1));
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Traffic
  const fetchTraffic = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/traffic`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrafficLogs(data.requests || []);
      }
    } catch (err) {
      console.error('Traffic fetch error:', err);
    }
  };

  // Fetch Health
  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error('Health fetch error:', err);
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  useEffect(() => {
    if (activeTab === 'traffic') {
      fetchTraffic();
      const interval = setInterval(fetchTraffic, 2500);
      return () => clearInterval(interval);
    } else if (activeTab === 'health') {
      fetchHealth();
    } else if (activeTab === 'byDate') {
      fetchWorkouts(selectedDate);
    }
  }, [activeTab]);

  // Re-fetch the date-scoped list whenever the chosen date changes while on that tab
  useEffect(() => {
    if (activeTab === 'byDate') {
      fetchWorkouts(selectedDate);
    }
  }, [selectedDate]);

  // Push any workouts queued in IndexedDB (logged while offline) to the server.
  // Called on reconnect ('online' event) and once on app load in case there
  // were leftovers from a previous offline session.
  const syncPendingWorkouts = async () => {
    const pending = await getAllPending();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        let res;
        if (item.type === 'delete') {
          res = await fetch(`${API_BASE}/api/workouts/${item.workoutId}`, { method: 'DELETE' });
        } else if (item.type === 'update') {
          res = await replayUpdate(item);
        } else {
          // 'create' (and legacy entries saved before `type` existed)
          res = await fetch(`${API_BASE}/api/workouts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
        }
        if (res.ok) {
          await removePending(item.localId);
        }
      } catch (err) {
        // Still offline or server unreachable — stop and retry on next trigger.
        console.error('Sync error, will retry later:', err);
        break;
      }
    }
    setPendingCount(await countPending());
    refreshWorkouts();
  };

  // Replays a queued edit: workout fields, removed sets, and updated/new
  // sets — same three-step sequence saveEditWorkout does live.
  const replayUpdate = async (item) => {
    const { workoutId, editDraft, originalSetIds } = item;
    const res = await fetch(`${API_BASE}/api/workouts/${workoutId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: editDraft.date,
        muscleGroup: editDraft.muscleGroup,
        exercise: editDraft.exercise,
        notes: editDraft.notes
      })
    });

    const keptIds = editDraft.sets.filter((s) => s.id).map((s) => s.id);
    const removedIds = originalSetIds.filter((id) => !keptIds.includes(id));
    await Promise.all(
      removedIds.map((setId) =>
        fetch(`${API_BASE}/api/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' })
      )
    );
    await Promise.all(
      editDraft.sets.map((s) =>
        s.id
          ? fetch(`${API_BASE}/api/workouts/${workoutId}/sets/${s.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reps: s.reps, weightKg: s.weightKg })
            })
          : fetch(`${API_BASE}/api/workouts/${workoutId}/sets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reps: s.reps, weightKg: s.weightKg })
            })
      )
    );
    return res;
  };

  // Track connectivity and sync queued workouts whenever we come back online.
  useEffect(() => {
    countPending().then(setPendingCount);

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingWorkouts();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Catch any workouts left queued from a previous offline session.
    if (navigator.onLine) syncPendingWorkouts();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.exercise.trim()) return;

    const payload = { ...formData };
    setSubmitStatus('saving');

    try {
      const res = await fetch(`${API_BASE}/api/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setFormData({ ...formData, exercise: '', notes: '', sets: [{ reps: 10, weightKg: 60 }] });
        refreshWorkouts();
        setSubmitStatus(null);
      } else {
        setSubmitStatus(null);
      }
    } catch (err) {
      // Network unavailable (offline) — queue it locally and sync later.
      console.warn('Offline: queuing workout to sync later.', err);
      await addPendingWorkout(payload);
      setPendingCount(await countPending());
      setFormData({ ...formData, exercise: '', notes: '', sets: [{ reps: 10, weightKg: 60 }] });
      setSubmitStatus('queued');
      setTimeout(() => setSubmitStatus(null), 2500);
    }
  };

  // Re-fetches whichever workout list(s) are currently relevant on screen
  const refreshWorkouts = () => {
    fetchWorkouts();
    if (activeTab === 'byDate') fetchWorkouts(selectedDate);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/workouts/${id}`, { method: 'DELETE' });
      if (res.ok) refreshWorkouts();
    } catch (err) {
      // Offline — queue the delete and remove it from view right away.
      console.warn('Offline: queuing delete to sync later.', err);
      await addPendingOperation({ type: 'delete', workoutId: id });
      setPendingCount(await countPending());
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
      setWorkoutsByDate((prev) => prev.filter((w) => w.id !== id));
    }
  };

  // Begin editing a workout — a single "Edit" button opens the full record:
  // date, muscle group, exercise, notes, AND every set (editable/addable/removable).
  const startEditWorkout = (w) => {
    setEditingWorkoutId(w.id);
    setEditDraft({
      date: w.date,
      muscleGroup: w.muscleGroup,
      exercise: w.exercise,
      notes: w.notes || '',
      sets: (w.sets || []).map((s) => ({ id: s.id, reps: s.reps, weightKg: s.weightKg }))
    });
  };

  const cancelEditWorkout = () => {
    setEditingWorkoutId(null);
  };

  const addEditSetRow = () => {
    setEditDraft((prev) => {
      const last = prev.sets[prev.sets.length - 1] || { reps: 10, weightKg: 60 };
      return { ...prev, sets: [...prev.sets, { reps: last.reps, weightKg: last.weightKg }] };
    });
  };

  const removeEditSetRow = (index) => {
    setEditDraft((prev) => ({
      ...prev,
      sets: prev.sets.length > 1 ? prev.sets.filter((_, i) => i !== index) : prev.sets
    }));
  };

  const updateEditSetRow = (index, field, value) => {
    setEditDraft((prev) => ({
      ...prev,
      sets: prev.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    }));
  };

  // Saves the entire record in one go: workout fields + set changes
  // (updates existing sets, creates new ones, deletes removed ones).
  const saveEditWorkout = async (workout) => {
    if (!editDraft.exercise.trim() || editDraft.sets.length === 0) return;
    setEditSaveStatus('saving');
    try {
      // 1. Update the workout's own fields
      await fetch(`${API_BASE}/api/workouts/${workout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editDraft.date,
          muscleGroup: editDraft.muscleGroup,
          exercise: editDraft.exercise,
          notes: editDraft.notes
        })
      });

      // 2. Delete sets that were removed in the editor
      const originalIds = (workout.sets || []).map((s) => s.id);
      const keptIds = editDraft.sets.filter((s) => s.id).map((s) => s.id);
      const removedIds = originalIds.filter((id) => !keptIds.includes(id));
      await Promise.all(
        removedIds.map((setId) =>
          fetch(`${API_BASE}/api/workouts/${workout.id}/sets/${setId}`, { method: 'DELETE' })
        )
      );

      // 3. Update existing sets, create any new ones added in the editor
      await Promise.all(
        editDraft.sets.map((s) =>
          s.id
            ? fetch(`${API_BASE}/api/workouts/${workout.id}/sets/${s.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reps: s.reps, weightKg: s.weightKg })
              })
            : fetch(`${API_BASE}/api/workouts/${workout.id}/sets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reps: s.reps, weightKg: s.weightKg })
              })
        )
      );

      setEditingWorkoutId(null);
      setEditSaveStatus(null);
      refreshWorkouts();
    } catch (err) {
      // Offline — queue the edit and reflect it locally right away.
      console.warn('Offline: queuing edit to sync later.', err);
      const originalSetIds = (workout.sets || []).map((s) => s.id);
      await addPendingOperation({
        type: 'update',
        workoutId: workout.id,
        editDraft,
        originalSetIds
      });
      setPendingCount(await countPending());

      const updatedWorkout = {
        ...workout,
        date: editDraft.date,
        muscleGroup: editDraft.muscleGroup,
        exercise: editDraft.exercise,
        notes: editDraft.notes,
        sets: editDraft.sets.map((s, i) => ({ id: s.id || `local-set-${i}`, reps: s.reps, weightKg: s.weightKg }))
      };
      const applyLocal = (list) => list.map((w) => (w.id === workout.id ? updatedWorkout : w));
      setWorkouts((prev) => applyLocal(prev));
      setWorkoutsByDate((prev) => applyLocal(prev));
      setEditingWorkoutId(null);
      setEditSaveStatus('queued');
      setTimeout(() => setEditSaveStatus(null), 2500);
    }
  };

  // Calculate quick stats from the nested sets of every workout
  const totalLoggedSets = workouts.reduce((acc, w) => acc + (w.sets?.length || 0), 0);
  const totalVolume = workouts.reduce(
    (sum, w) => sum + (w.sets || []).reduce((s, set) => s + set.reps * set.weightKg, 0),
    0
  );

  // Workouts for the date chosen on the "By Date" tab (fetched server-side via ?date=)
  const workoutsForSelectedDate = workoutsByDate;
  const setsForSelectedDate = workoutsForSelectedDate.reduce((acc, w) => acc + (w.sets?.length || 0), 0);
  const volumeForSelectedDate = workoutsForSelectedDate.reduce(
    (sum, w) => sum + (w.sets || []).reduce((s, set) => s + set.reps * set.weightKg, 0),
    0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f4f5f7', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Bar */}
      <header style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#f97316' }}>
          <Dumbbell size={28} />
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>GymTrack</span>
        </div>
        
        {/* Search Bar (mock) */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '6px 16px', width: '300px', color: '#64748b' }}>
          <Activity size={16} style={{ marginRight: 8 }} /> Search...
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Offline / sync-pending indicator */}
          {(!isOnline || pendingCount > 0) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: isOnline ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${isOnline ? '#fcd34d' : '#fca5a5'}`,
              borderRadius: 999, padding: '4px 12px', fontSize: '0.75rem',
              color: isOnline ? '#d97706' : '#dc2626'
            }}>
              {isOnline ? `Syncing ${pendingCount}...` : `Offline`}
            </div>
          )}
          {lastApiLatency && (
             <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
               <Zap size={14} color="#f97316" /> {lastApiLatency} ms
             </div>
          )}
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <User size={18} color="#64748b" />
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{ width: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', padding: '0 12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Home
          </div>
          
          <button onClick={() => setActiveTab('workouts')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: '8px', border: 'none', background: activeTab === 'workouts' ? '#fff7ed' : 'transparent', color: activeTab === 'workouts' ? '#f97316' : '#64748b', fontWeight: activeTab === 'workouts' ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
            <Dumbbell size={18} /> My Workouts
          </button>
          <button onClick={() => setActiveTab('byDate')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: '8px', border: 'none', background: activeTab === 'byDate' ? '#fff7ed' : 'transparent', color: activeTab === 'byDate' ? '#f97316' : '#64748b', fontWeight: activeTab === 'byDate' ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
            <CalendarDays size={18} /> By Date
          </button>
          <button onClick={() => setActiveTab('progress')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: '8px', border: 'none', background: activeTab === 'progress' ? '#fff7ed' : 'transparent', color: activeTab === 'progress' ? '#f97316' : '#64748b', fontWeight: activeTab === 'progress' ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
            <TrendingUp size={18} /> Progress
          </button>

          {adminToken && (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', padding: '0 12px', marginTop: '16px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Admin Apps
              </div>
              <button onClick={() => setActiveTab('traffic')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: '8px', border: 'none', background: activeTab === 'traffic' ? '#fff7ed' : 'transparent', color: activeTab === 'traffic' ? '#f97316' : '#64748b', fontWeight: activeTab === 'traffic' ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                <Activity size={18} /> Live Traffic
              </button>
              <button onClick={() => setActiveTab('health')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: '8px', border: 'none', background: activeTab === 'health' ? '#fff7ed' : 'transparent', color: activeTab === 'health' ? '#f97316' : '#64748b', fontWeight: activeTab === 'health' ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                <ShieldCheck size={18} /> Server Health
              </button>
              <button onClick={() => setActiveTab('map')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: '8px', border: 'none', background: activeTab === 'map' ? '#fff7ed' : 'transparent', color: activeTab === 'map' ? '#f97316' : '#64748b', fontWeight: activeTab === 'map' ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                <Map size={18} /> Request Map
              </button>
            </>
          )}

          <div style={{ marginTop: 'auto' }}>
            <button onClick={() => setActiveTab('admin')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: '8px', border: 'none', background: activeTab === 'admin' ? '#f1f5f9' : 'transparent', color: adminToken ? '#10b981' : '#f59e0b', fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s' }}>
              {adminToken ? <Unlock size={18} /> : <Lock size={18} />} Admin Panel
            </button>
          </div>
        </aside>
        
        {/* Main Content Body */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>

      {/* TAB: ADMIN LOGIN */}
      {activeTab === 'admin' && (
        <div style={{ maxWidth: 400, margin: '40px auto', background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#1e293b' }}>
            <User size={24} color="#f97316" /> Admin Panel
          </h2>
          
          {adminToken ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                You are securely logged in as Admin.
              </div>
              <button 
                onClick={() => {
                  localStorage.removeItem('adminToken');
                  setAdminToken(null);
                  setActiveTab('workouts');
                }}
                style={{ width: '100%', padding: '10px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                Logout
              </button>
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              try {
                const res = await fetch(`${API_BASE}/api/auth/login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(loginForm)
                });
                const data = await res.json();
                if (res.ok) {
                  localStorage.setItem('adminToken', data.token);
                  setAdminToken(data.token);
                  setLoginForm({ username: '', password: '' });
                } else {
                  setLoginError(data.error || 'Login failed');
                }
              } catch (err) {
                setLoginError('Network error');
              }
            }}>
              {loginError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {loginError}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 6 }}>Email / Username</label>
                <input 
                  type="text" 
                  required
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 8, color: '#1e293b' }} 
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: 6 }}>Password</label>
                <input 
                  type="password" 
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 8, color: '#1e293b' }} 
                />
              </div>
              <button 
                type="submit"
                style={{ width: '100%', padding: '12px', background: '#f97316', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                <LogIn size={18} /> Authenticate
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 1: WORKOUT TRACKER */}
      {activeTab === 'workouts' && (
        <div>
          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Logged Sets</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>
                {totalLoggedSets}
              </div>
            </div>
            <div style={{ background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Tonnage Moved</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4, color: '#f97316' }}>
                {(totalVolume / 1000).toFixed(1)} <span style={{ fontSize: '0.9rem' }}>tonnes</span>
              </div>
            </div>
          </div>

          {/* Log New Workout Form */}
          <form onSubmit={handleSubmit} style={{ background: '#ffffff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusCircle size={18} color="#f97316" /> Log Session Exercise
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Date</label>
                <input 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Muscle Group</label>
                <select 
                  value={formData.muscleGroup}
                  onChange={(e) => setFormData({ ...formData, muscleGroup: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}>
                  <option value="Chest">Chest</option>
                  <option value="Back">Back</option>
                  <option value="Legs">Legs</option>
                  <option value="Shoulders">Shoulders</option>
                  <option value="Arms">Arms</option>
                  <option value="Core">Core</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Exercise Name</label>
              <input 
                type="text"
                placeholder="e.g. Barbell Incline Press, Romanian Deadlift"
                value={formData.exercise}
                onChange={(e) => setFormData({ ...formData, exercise: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Sets (reps × weight per set)</label>
                <button
                  type="button"
                  onClick={addSetRow}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid #475569', color: '#f97316', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <Plus size={12} /> Add Set
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {formData.sets.map((s, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 28px', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>#{idx + 1}</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="Reps"
                      value={s.reps}
                      onChange={(e) => updateSetRow(idx, 'reps', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Weight (kg)"
                      value={s.weightKg}
                      onChange={(e) => updateSetRow(idx, 'weightKg', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeSetRow(idx)}
                      disabled={formData.sets.length === 1}
                      title="Remove set"
                      style={{ background: 'transparent', border: 'none', color: formData.sets.length === 1 ? '#475569' : '#f87171', cursor: formData.sets.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitStatus === 'saving'}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                background: submitStatus === 'queued' ? '#7c2d12' : '#0f172a',
                border: 'none',
                color: submitStatus === 'queued' ? '#fed7aa' : '#fff',
                fontWeight: 600,
                cursor: submitStatus === 'saving' ? 'not-allowed' : 'pointer',
                opacity: submitStatus === 'saving' ? 0.7 : 1
              }}>
              {submitStatus === 'saving'
                ? 'Saving…'
                : submitStatus === 'queued'
                ? 'Offline — saved locally, will sync later'
                : 'Save Entry & Broadcast API Call'}
            </button>
          </form>

          {/* Workout History List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Exercises</h2>
              <button 
                onClick={fetchWorkouts} 
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {workouts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, background: '#ffffff', borderRadius: 10, color: '#64748b' }}>
                No workouts logged yet. Add your first set above!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {workouts.map((w) => {
                  const isEditing = editingWorkoutId === w.id;
                  return (
                  <div key={w.id} style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 10, border: isEditing ? '1px solid #f97316' : '1px solid #e2e8f0' }}>
                    {isEditing ? (
                      <EditWorkoutForm
                        editDraft={editDraft}
                        setEditDraft={setEditDraft}
                        addEditSetRow={addEditSetRow}
                        removeEditSetRow={removeEditSetRow}
                        updateEditSetRow={updateEditSetRow}
                        onSave={() => saveEditWorkout(w)}
                        onCancel={cancelEditWorkout}
                        saveStatus={editSaveStatus}
                      />
                    ) : (
                    <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: '#1e293b', color: '#e0f2fe', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                            {w.muscleGroup}
                          </span>
                          <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{w.exercise}</strong>
                        </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                        {w.sets?.length || 0} sets &nbsp;·&nbsp; {w.date} ({getWeekdayName(w.date)})
                      </div>
                      {w.notes && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                          "{w.notes}"
                        </div>
                      )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => startEditWorkout(w)}
                          title="Edit record"
                          style={{ background: '#e2e8f0', border: 'none', borderRadius: 6, color: '#0f172a', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(w.id)}
                          style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', padding: '8px', cursor: 'pointer', display: 'flex' }}
                          title="Delete workout">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Per-set breakdown (read-only — use Edit to change) */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {(w.sets || []).map((s) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem' }}>
                          <span style={{ color: '#64748b' }}>#{s.setNumber}</span>
                          <span style={{ color: '#0f172a' }}>{s.reps} reps</span>
                          <span style={{ color: '#f97316', fontWeight: 600 }}>@ {s.weightKg} kg</span>
                        </div>
                      ))}
                    </div>
                    </>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1b: WORKOUT RECORDS BY DATE */}
      {activeTab === 'byDate' && (
        <div>
          <div style={{ background: '#ffffff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 6 }}>Choose a date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #475569', borderRadius: 6, color: '#1e293b', fontSize: '0.95rem' }}
            />
            <div style={{ fontSize: '0.8rem', color: '#f97316', marginTop: 8 }}>
              {getWeekdayName(selectedDate)}
            </div>
          </div>

          {/* Quick Metrics Bar for the selected date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Exercises Logged</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>
                {workoutsForSelectedDate.length}
              </div>
            </div>
            <div style={{ background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Sets Logged</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>
                {setsForSelectedDate}
              </div>
            </div>
            <div style={{ background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Tonnage Moved</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4, color: '#f97316' }}>
                {(volumeForSelectedDate / 1000).toFixed(1)} <span style={{ fontSize: '0.9rem' }}>tonnes</span>
              </div>
            </div>
          </div>

          {workoutsForSelectedDate.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, background: '#ffffff', borderRadius: 10, color: '#64748b' }}>
              No workouts logged on {selectedDate} ({getWeekdayName(selectedDate)}).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {workoutsForSelectedDate.map((w) => {
                const isEditing = editingWorkoutId === w.id;
                return (
                <div key={w.id} style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 10, border: isEditing ? '1px solid #f97316' : '1px solid #e2e8f0' }}>
                  {isEditing ? (
                    <EditWorkoutForm
                      editDraft={editDraft}
                      setEditDraft={setEditDraft}
                      addEditSetRow={addEditSetRow}
                      removeEditSetRow={removeEditSetRow}
                      updateEditSetRow={updateEditSetRow}
                      onSave={() => saveEditWorkout(w)}
                      onCancel={cancelEditWorkout}
                      saveStatus={editSaveStatus}
                    />
                  ) : (
                  <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: '#1e293b', color: '#e0f2fe', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                          {w.muscleGroup}
                        </span>
                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{w.exercise}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                        {w.sets?.length || 0} sets &nbsp;·&nbsp; {w.date} ({getWeekdayName(w.date)})
                      </div>
                      {w.notes && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                          "{w.notes}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => startEditWorkout(w)}
                        title="Edit record"
                        style={{ background: '#e2e8f0', border: 'none', borderRadius: 6, color: '#0f172a', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(w.id)}
                        style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', padding: '8px', cursor: 'pointer', display: 'flex' }}
                        title="Delete workout">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Per-set breakdown (read-only — use Edit to change) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {(w.sets || []).map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>#{s.setNumber}</span>
                        <span style={{ color: '#0f172a' }}>{s.reps} reps</span>
                        <span style={{ color: '#f97316', fontWeight: 600 }}>@ {s.weightKg} kg</span>
                      </div>
                    ))}
                  </div>
                  </>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: PROGRESS CHARTS */}
      {activeTab === 'progress' && (
        <div>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f97316', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={18} /> Progress
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Track how your top set weight or total session volume changes over time, per exercise.
            </p>
          </div>
          <ProgressChart workouts={workouts} />
        </div>
      )}

      {/* TAB 2: LIVE TRAFFIC INSPECTOR */}
      {activeTab === 'traffic' && (
        <div>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f97316', marginBottom: 6 }}>
              How User Traffic Works Under the Hood
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
              Every time you tap a button or load a page, the client browser emits an HTTP request through CORS middleware and route handlers to the Express server. The table below intercepts and inspects every live hit in real time.
            </p>
          </div>

          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '10px 12px' }}>Method</th>
                  <th style={{ padding: '10px 12px' }}>Endpoint</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>HTTP Latency</th>
                  <th style={{ padding: '10px 12px' }}>PostgreSQL Query</th>
                  <th style={{ padding: '10px 12px' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {trafficLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No recent traffic logged. Perform actions on the workouts tab!</td>
                  </tr>
                ) : (
                  trafficLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          fontWeight: 700,
                          color: log.method === 'POST' ? '#34d399' : log.method === 'DELETE' ? '#f87171' : '#f97316'
                        }}>
                          {log.method}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{log.url}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: log.status < 400 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: log.httpDurationMs > 50 ? '#fbbf24' : '#94a3b8' }}>
                        {log.httpDurationMs} ms
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {log.dbQuery ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ background: '#1e293b', color: '#e0f2fe', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                              {log.dbQuery.durationMs}ms
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.dbQuery.query}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>
                        {log.timestamp.split('T')[1].slice(0, 8)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SERVER HEALTH & HOST INFO */}
      {activeTab === 'health' && (
        <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={20} color="#34d399" /> System Health Diagnostics
          </h2>
          
          {healthData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Status</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', textTransform: 'capitalize' }}>{healthData.status}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Server Uptime</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{healthData.uptimeSeconds} seconds</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Node Runtime</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{healthData.nodeVersion}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Memory (RSS)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{healthData.memoryUsageMB.rss} MB</div>
              </div>
            </div>
          ) : (
            <div>Loading diagnostics...</div>
          )}
        </div>
      )}
      {/* TAB 4: REQUEST LIFECYCLE MAP */}
      {activeTab === 'map' && (
        <div>
          <div style={{ background: '#ffffff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>
              🗺️ Request Lifecycle Map
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
              Select any request from the list to see a live step‑by‑step map of everything that happened inside the server — middleware, DB query, CPU &amp; RAM usage at every stage.
            </p>
          </div>
          <LiveTrafficMap />
        </div>
      )}
          </div>
        </main>
      </div>
    </div>
  );
}
