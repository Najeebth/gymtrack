import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, LayoutDashboard, PlusCircle, Trophy } from 'lucide-react';
import { useWorkoutsQuery } from '../hooks/useWorkoutsQuery';
import EmptyState from '../components/EmptyState';
import { localToday } from '../utils/date';
import { computeDashboardStats, workoutVolume, type WeekBucket } from '../utils/dashboard';

const card = 'bg-white p-4 rounded-xl border border-brand-border';
const cardTitle = 'text-sm font-semibold text-brand-navy mb-3';

const formatTonnes = (kg: number) => (kg / 1000).toFixed(1);

export default function DashboardPage() {
  const { workouts, isLoading } = useWorkoutsQuery();
  const navigate = useNavigate();

  // Re-derived whenever the workouts cache changes, which includes live
  // Socket.IO updates from other devices.
  const stats = useMemo(() => computeDashboardStats(workouts, localToday()), [workouts]);

  if (isLoading) {
    return <div className={`${card} text-center text-brand-muted`}>Loading your dashboard…</div>;
  }

  if (workouts.length === 0) {
    return (
      <EmptyState
        title="Your dashboard is empty"
        description="Log your first workout and your weekly stats, streak and records will show up here."
        onAction={() => navigate('/workouts')}
      />
    );
  }

  const volumeDelta =
    stats.lastWeekVolumeKg > 0
      ? Math.round(((stats.weekVolumeKg - stats.lastWeekVolumeKg) / stats.lastWeekVolumeKg) * 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-semibold text-brand-orange flex items-center gap-1.5">
            <LayoutDashboard size={18} /> Dashboard
          </h2>
          <p className="text-sm text-brand-muted mt-1">Your training at a glance. Updates live as you log.</p>
        </div>
        <Link
          to="/workouts"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover transition"
        >
          <PlusCircle size={16} /> Log a workout
        </Link>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <StatCard label="Sessions this week" value={String(stats.weekSessions)} />
        <StatCard label="Sets this week" value={String(stats.weekSets)} />
        <StatCard
          label="Volume this week"
          value={formatTonnes(stats.weekVolumeKg)}
          unit="tonnes"
          accent
          hint={
            volumeDelta === null
              ? 'No data last week'
              : `${volumeDelta >= 0 ? '+' : ''}${volumeDelta}% vs last week`
          }
        />
        <StatCard
          label="Day streak"
          value={String(stats.streakDays)}
          unit={stats.streakDays === 1 ? 'day' : 'days'}
          icon={<Flame size={16} className={stats.streakDays > 0 ? 'text-brand-orange' : 'text-brand-muted'} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="weekly-volume-title">
          <h3 id="weekly-volume-title" className={cardTitle}>
            Weekly volume (last 8 weeks)
          </h3>
          <VolumeBars weeks={stats.weeklyVolume} />
        </section>

        <section className={card} aria-labelledby="muscle-split-title">
          <h3 id="muscle-split-title" className={cardTitle}>
            Muscle groups (last 30 days, by sets)
          </h3>
          {stats.muscleSplit.length === 0 ? (
            <p className="text-sm text-brand-muted">No sets logged in the last 30 days.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {stats.muscleSplit.map((m) => (
                <li key={m.muscleGroup}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{m.muscleGroup}</span>
                    <span className="text-brand-muted">
                      {m.sets} {m.sets === 1 ? 'set' : 'sets'} · {m.percent}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-orange" style={{ width: `${m.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="prs-title">
          <h3 id="prs-title" className={`${cardTitle} flex items-center gap-1.5`}>
            <Trophy size={16} className="text-brand-orange" /> Recent personal records
          </h3>
          {stats.recentPRs.length === 0 ? (
            <p className="text-sm text-brand-muted">
              No new records in the last 30 days. Beat your heaviest set on an exercise to see it here.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-brand-border">
              {stats.recentPRs.map((pr) => (
                <li key={`${pr.exercise}-${pr.date}`} className="py-2 flex justify-between gap-3 text-sm">
                  <span className="font-medium">{pr.exercise}</span>
                  <span className="text-right">
                    <span className="font-bold text-brand-orange">{pr.weightKg} kg</span>
                    <span className="block text-xs text-brand-muted">
                      {pr.date} · was {pr.previousKg} kg
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card} aria-labelledby="recent-title">
          <h3 id="recent-title" className={cardTitle}>
            Recent workouts
          </h3>
          <ul className="flex flex-col divide-y divide-brand-border">
            {stats.recentWorkouts.map((w) => (
              <li key={w.id} className="py-2 flex justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{w.exercise}</span>
                  <span className="block text-xs text-brand-muted">
                    {w.date.slice(0, 10)} · {w.muscleGroup}
                  </span>
                </span>
                <span className="text-right text-brand-muted">
                  {(w.sets || []).length} {(w.sets || []).length === 1 ? 'set' : 'sets'}
                  <span className="block text-xs">{Math.round(workoutVolume(w))} kg</span>
                </span>
              </li>
            ))}
          </ul>
          <Link to="/by-date" className="inline-block mt-3 text-sm text-brand-orange hover:underline">
            Browse by date →
          </Link>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white p-3.5 rounded-[10px] border border-brand-border">
      <div className="text-sm text-brand-muted flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${accent ? 'text-brand-orange' : ''}`}>
        {value}
        {unit && <span className="text-sm ml-1">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-brand-muted mt-0.5">{hint}</div>}
    </div>
  );
}

// Lightweight SVG bar chart, in the same no-chart-library spirit as ProgressChart.
function VolumeBars({ weeks }: { weeks: WeekBucket[] }) {
  const width = 600;
  const height = 200;
  const padX = 12;
  const padTop = 12;
  const padBottom = 28;
  const max = Math.max(...weeks.map((w) => w.volumeKg), 1);
  const slot = (width - 2 * padX) / weeks.length;
  const barWidth = slot * 0.6;
  const plotHeight = height - padTop - padBottom;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Weekly training volume in tonnes for the last ${weeks.length} weeks`}
    >
      <line x1={padX} x2={width - padX} y1={height - padBottom} y2={height - padBottom} stroke="#e2e8f0" />
      {weeks.map((w, i) => {
        const h = (w.volumeKg / max) * plotHeight;
        const x = padX + i * slot + (slot - barWidth) / 2;
        const isCurrent = i === weeks.length - 1;
        return (
          <g key={w.weekStart}>
            <rect
              x={x}
              y={height - padBottom - h}
              width={barWidth}
              height={Math.max(h, w.volumeKg > 0 ? 2 : 0)}
              rx="3"
              fill={isCurrent ? '#f97316' : '#fdba74'}
            >
              <title>{`Week of ${w.label}: ${formatTonnes(w.volumeKg)} tonnes`}</title>
            </rect>
            <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize="11" fill="#64748b">
              {w.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
