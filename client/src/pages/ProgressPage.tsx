import { TrendingUp } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import ProgressChart from '../components/ProgressChart';

export default function ProgressPage() {
  const { workouts } = useAppData();

  return (
    <div>
      <div className="bg-white p-4 rounded-xl border border-brand-border mb-4">
        <h2 className="text-base font-semibold text-brand-orange mb-1.5 flex items-center gap-1.5">
          <TrendingUp size={18} /> Progress
        </h2>
        <p className="text-sm text-brand-muted">
          Track how your top set weight or total session volume changes over time, per exercise.
        </p>
      </div>
      <ProgressChart workouts={workouts} />
    </div>
  );
}
