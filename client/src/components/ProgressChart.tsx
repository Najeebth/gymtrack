import { useEffect, useMemo, useState } from 'react';
import type { Workout } from '../types';

type Metric = 'maxWeight' | 'volume';

interface SeriesPoint {
  date: string;
  maxWeight: number;
  volume: number;
}

// Lightweight SVG line chart (no charting library) showing a chosen exercise's
// trend over time: either heaviest set per session or total volume moved.
export default function ProgressChart({ workouts }: { workouts: Workout[] }) {
  const exercises = useMemo(
    () => Array.from(new Set(workouts.map((w) => w.exercise).filter(Boolean))).sort(),
    [workouts]
  );
  const [selectedExercise, setSelectedExercise] = useState('');
  const [metric, setMetric] = useState<Metric>('maxWeight');

  useEffect(() => {
    if (!selectedExercise && exercises.length > 0) setSelectedExercise(exercises[0]);
    if (selectedExercise && !exercises.includes(selectedExercise) && exercises.length > 0) {
      setSelectedExercise(exercises[0]);
    }
  }, [exercises, selectedExercise]);

  const series = useMemo<SeriesPoint[]>(() => {
    return workouts
      .filter((w) => w.exercise === selectedExercise)
      .map((w) => {
        const sets = w.sets || [];
        const maxWeight = sets.reduce((m, s) => Math.max(m, s.weightKg || 0), 0);
        const volume = sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weightKg || 0), 0);
        return { date: w.date, maxWeight, volume };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
      <div className="p-6 text-center text-brand-muted bg-white rounded-xl border border-brand-border">
        Log a few workouts first — charts show up here once there's data to plot.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-brand-border p-4">
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="px-2.5 py-2 bg-slate-50 border border-slate-500 rounded-md text-slate-800"
        >
          {exercises.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5">
          <button
            onClick={() => setMetric('maxWeight')}
            className={`px-3 py-1.5 rounded-md border-none cursor-pointer text-sm font-semibold ${
              metric === 'maxWeight' ? 'bg-brand-orange text-white' : 'bg-brand-border text-slate-800'
            }`}
          >
            Top Set (kg)
          </button>
          <button
            onClick={() => setMetric('volume')}
            className={`px-3 py-1.5 rounded-md border-none cursor-pointer text-sm font-semibold ${
              metric === 'volume' ? 'bg-brand-orange text-white' : 'bg-brand-border text-slate-800'
            }`}
          >
            Session Volume (kg)
          </button>
        </div>
      </div>

      {series.length === 0 ? (
        <div className="p-6 text-center text-brand-muted">No logged sessions for this exercise yet.</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padX}
              x2={width - padX}
              y1={padY + f * (height - 2 * padY)}
              y2={padY + f * (height - 2 * padY)}
              stroke="#e2e8f0"
              strokeWidth="1"
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
        <div className="flex justify-between mt-2 text-xs text-brand-muted">
          <span>{series[0].date}</span>
          {series.length > 1 && <span>{series[series.length - 1].date}</span>}
        </div>
      )}
    </div>
  );
}
