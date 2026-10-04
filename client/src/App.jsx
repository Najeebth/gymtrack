import React, { useState, useEffect } from 'react';
import { Activity, Dumbbell, PlusCircle, Trash2, RefreshCw, BarChart2, ShieldCheck, Zap, Map } from 'lucide-react';
import LiveTrafficMap from './LiveTrafficMap.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'https://gymtrack-prdf.onrender.com';

export default function App() {
  const [activeTab, setActiveTab] = useState('workouts'); // 'workouts' | 'traffic' | 'health' | 'map'
  const [workouts, setWorkouts] = useState([]);
  const [trafficLogs, setTrafficLogs] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastApiLatency, setLastApiLatency] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    muscleGroup: 'Chest',
    exercise: '',
    sets: 3,
    reps: 10,
    weightKg: 60,
    notes: ''
  });

  // Fetch Workouts
  const fetchWorkouts = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/api/workouts`);
      const data = await res.json();
      setWorkouts(data);
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
    }
  }, [activeTab]);

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
        setFormData({ ...formData, exercise: '', notes: '' });
        fetchWorkouts();
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/workouts/${id}`, { method: 'DELETE' });
      if (res.ok) fetchWorkouts();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Calculate quick stats
  const totalVolume = workouts.reduce((sum, w) => sum + (w.sets * w.reps * w.weightKg), 0);

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
                {workouts.reduce((acc, curr) => acc + curr.sets, 0)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Sets</label>
                <input 
                  type="number"
                  min="1"
                  value={formData.sets}
                  onChange={(e) => setFormData({ ...formData, sets: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Reps / Set</label>
                <input 
                  type="number"
                  min="1"
                  value={formData.reps}
                  onChange={(e) => setFormData({ ...formData, reps: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Weight (kg)</label>
                <input 
                  type="number"
                  step="0.5"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#fff' }}
                />
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
                  <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '12px 16px', borderRadius: 10, border: '1px solid #334155' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: '#0369a1', color: '#e0f2fe', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                          {w.muscleGroup}
                        </span>
                        <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{w.exercise}</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>
                        {w.sets} sets × {w.reps} reps @ <strong style={{ color: '#38bdf8' }}>{w.weightKg} kg</strong> &nbsp;·&nbsp; {w.date}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDelete(w.id)}
                      style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', padding: '8px', cursor: 'pointer' }}
                      title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
