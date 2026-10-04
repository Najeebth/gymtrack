import React, { useState, useEffect } from 'react';
import { Activity, Dumbbell, PlusCircle, Trash2, RefreshCw, BarChart2, ShieldCheck, Zap, Map, Plus, X, CalendarDays } from 'lucide-react';
import LiveTrafficMap from './LiveTrafficMap.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'https://gymtrack-prdf.onrender.com';

// Returns just the weekday name for a 'YYYY-MM-DD' date string (e.g. "Sunday")
function getWeekdayName(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export default function App() {
  const [activeTab, setActiveTab] = useState('workouts'); // 'workouts' | 'byDate' | 'traffic' | 'health' | 'map'
  const [workouts, setWorkouts] = useState([]);
  const [trafficLogs, setTrafficLogs] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastApiLatency, setLastApiLatency] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutsByDate, setWorkoutsByDate] = useState([]);

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
      const res = await fetch(`${API_BASE}/api/traffic`);
      const data = await res.json();
      setTrafficLogs(data.requests || []);
    } catch (err) {
      console.error('Traffic fetch error:', err);
    }
  };

  // Fetch Health
  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setHealthData(data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.exercise.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormData({ ...formData, exercise: '', notes: '', sets: [{ reps: 10, weightKg: 60 }] });
        refreshWorkouts();
      }
    } catch (err) {
      console.error('Submit error:', err);
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
      console.error('Delete error:', err);
    }
  };

  // Append one more set to an existing workout record
  const handleAddSetToWorkout = async (workout) => {
    const lastSet = workout.sets[workout.sets.length - 1] || { reps: 10, weightKg: 60 };
    try {
      const res = await fetch(`${API_BASE}/api/workouts/${workout.id}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reps: lastSet.reps, weightKg: lastSet.weightKg })
      });
      if (res.ok) refreshWorkouts();
    } catch (err) {
      console.error('Add set error:', err);
    }
  };

  const handleDeleteSet = async (workoutId, setId) => {
    try {
      const res = await fetch(`${API_BASE}/api/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' });
      if (res.ok) refreshWorkouts();
    } catch (err) {
      console.error('Delete set error:', err);
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
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '16px 20px', minHeight: '100vh' }}>
      
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #334155' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
            <Dumbbell size={28} /> FitTrack
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Personal Gym Progress & Request Traffic Inspector</p>
        </div>

        {/* Latency Pill */}
        {lastApiLatency && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155', borderRadius: 999, padding: '4px 12px', fontSize: '0.75rem', color: '#38bdf8' }}>
            <Zap size={14} /> Roundtrip: {lastApiLatency} ms
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button 
          onClick={() => setActiveTab('workouts')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'workouts' ? '#0284c7' : '#1e293b',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
          <Dumbbell size={16} /> My Workouts
        </button>

        <button 
          onClick={() => setActiveTab('byDate')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'byDate' ? '#0284c7' : '#1e293b',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
          <CalendarDays size={16} /> By Date
        </button>

        <button 
          onClick={() => setActiveTab('traffic')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'traffic' ? '#0284c7' : '#1e293b',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
          <Activity size={16} /> Live Traffic
        </button>

        <button 
          onClick={() => setActiveTab('health')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'health' ? '#0284c7' : '#1e293b',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
          <ShieldCheck size={16} /> Server Health
        </button>

        <button 
          onClick={() => setActiveTab('map')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'map' ? '#7c3aed' : '#1e293b',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
          <Map size={16} /> Request Map
        </button>
      </div>

      {/* TAB 1: WORKOUT TRACKER */}
      {activeTab === 'workouts' && (
        <div>
          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Logged Sets</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>
                {totalLoggedSets}
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Tonnage Moved</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4, color: '#38bdf8' }}>
                {(totalVolume / 1000).toFixed(1)} <span style={{ fontSize: '0.9rem' }}>tonnes</span>
              </div>
            </div>
          </div>

          {/* Log New Workout Form */}
          <form onSubmit={handleSubmit} style={{ background: '#1e293b', padding: 18, borderRadius: 12, border: '1px solid #334155', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusCircle size={18} color="#38bdf8" /> Log Session Exercise
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Date</label>
                <input 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Muscle Group</label>
                <select 
                  value={formData.muscleGroup}
                  onChange={(e) => setFormData({ ...formData, muscleGroup: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}>
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
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Exercise Name</label>
              <input 
                type="text"
                placeholder="e.g. Barbell Incline Press, Romanian Deadlift"
                value={formData.exercise}
                onChange={(e) => setFormData({ ...formData, exercise: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sets (reps × weight per set)</label>
                <button
                  type="button"
                  onClick={addSetRow}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid #475569', color: '#38bdf8', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
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
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Weight (kg)"
                      value={s.weightKg}
                      onChange={(e) => updateSetRow(idx, 'weightKg', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}
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
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                background: '#0284c7',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
              Save Entry & Broadcast API Call
            </button>
          </form>

          {/* Workout History List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Exercises</h2>
              <button 
                onClick={fetchWorkouts} 
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {workouts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, background: '#1e293b', borderRadius: 10, color: '#94a3b8' }}>
                No workouts logged yet. Add your first set above!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {workouts.map((w) => (
                  <div key={w.id} style={{ background: '#1e293b', padding: '12px 16px', borderRadius: 10, border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: '#0369a1', color: '#e0f2fe', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                            {w.muscleGroup}
                          </span>
                          <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{w.exercise}</strong>
                        </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                        {w.sets?.length || 0} sets &nbsp;·&nbsp; {w.date} ({getWeekdayName(w.date)})
                      </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleAddSetToWorkout(w)}
                          title="Add another set"
                          style={{ background: '#0369a1', border: 'none', borderRadius: 6, color: '#e0f2fe', padding: '8px', cursor: 'pointer', display: 'flex' }}>
                          <Plus size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(w.id)}
                          style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', padding: '8px', cursor: 'pointer', display: 'flex' }}
                          title="Delete workout">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Per-set breakdown */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {(w.sets || []).map((s) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem' }}>
                          <span style={{ color: '#64748b' }}>#{s.setNumber}</span>
                          <span style={{ color: '#f8fafc' }}>{s.reps} reps</span>
                          <span style={{ color: '#38bdf8', fontWeight: 600 }}>@ {s.weightKg} kg</span>
                          <button
                            onClick={() => handleDeleteSet(w.id, s.id)}
                            title="Remove this set"
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', padding: 0 }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1b: WORKOUT RECORDS BY DATE */}
      {activeTab === 'byDate' && (
        <div>
          <div style={{ background: '#1e293b', padding: 18, borderRadius: 12, border: '1px solid #334155', marginBottom: 20 }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 6 }}>Choose a date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff', fontSize: '0.95rem' }}
            />
            <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: 8 }}>
              {getWeekdayName(selectedDate)}
            </div>
          </div>

          {/* Quick Metrics Bar for the selected date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Exercises Logged</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>
                {workoutsForSelectedDate.length}
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sets Logged</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>
                {setsForSelectedDate}
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tonnage Moved</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4, color: '#38bdf8' }}>
                {(volumeForSelectedDate / 1000).toFixed(1)} <span style={{ fontSize: '0.9rem' }}>tonnes</span>
              </div>
            </div>
          </div>

          {workoutsForSelectedDate.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, background: '#1e293b', borderRadius: 10, color: '#94a3b8' }}>
              No workouts logged on {selectedDate} ({getWeekdayName(selectedDate)}).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {workoutsForSelectedDate.map((w) => (
                <div key={w.id} style={{ background: '#1e293b', padding: '12px 16px', borderRadius: 10, border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: '#0369a1', color: '#e0f2fe', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                          {w.muscleGroup}
                        </span>
                        <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{w.exercise}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                        {w.sets?.length || 0} sets &nbsp;·&nbsp; {w.date} ({getWeekdayName(w.date)})
                      </div>
                      {w.notes && (
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                          "{w.notes}"
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(w.id)}
                      style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', padding: '8px', cursor: 'pointer', display: 'flex' }}
                      title="Delete workout">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Per-set breakdown */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {(w.sets || []).map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>#{s.setNumber}</span>
                        <span style={{ color: '#f8fafc' }}>{s.reps} reps</span>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>@ {s.weightKg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE TRAFFIC INSPECTOR */}
      {activeTab === 'traffic' && (
        <div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 12, border: '1px solid #334155', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#38bdf8', marginBottom: 6 }}>
              How User Traffic Works Under the Hood
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Every time you tap a button or load a page, the client browser emits an HTTP request through CORS middleware and route handlers to the Express server. The table below intercepts and inspects every live hit in real time.
            </p>
          </div>

          <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
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
                    <tr key={log.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          fontWeight: 700,
                          color: log.method === 'POST' ? '#34d399' : log.method === 'DELETE' ? '#f87171' : '#38bdf8'
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
                            <span style={{ background: '#0369a1', color: '#e0f2fe', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
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
        <div style={{ background: '#1e293b', padding: 20, borderRadius: 12, border: '1px solid #334155' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={20} color="#34d399" /> System Health Diagnostics
          </h2>
          
          {healthData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Status</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', textTransform: 'capitalize' }}>{healthData.status}</div>
              </div>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Server Uptime</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{healthData.uptimeSeconds} seconds</div>
              </div>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Node Runtime</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{healthData.nodeVersion}</div>
              </div>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Memory (RSS)</div>
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
          <div style={{ background: '#1e1b4b', padding: 16, borderRadius: 12, border: '1px solid #4c1d95', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>
              🗺️ Request Lifecycle Map
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Select any request from the list to see a live step‑by‑step map of everything that happened inside the server — middleware, DB query, CPU &amp; RAM usage at every stage.
            </p>
          </div>
          <LiveTrafficMap />
        </div>
      )}
    </div>
  );
}
