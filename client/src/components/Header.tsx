import { Activity, Dumbbell, Zap, User } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

export default function Header() {
  const { isOnline, pendingCount, lastApiLatency } = useAppData();

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-brand-border shrink-0">
      <div className="flex items-center gap-3 text-brand-orange">
        <Dumbbell size={28} />
        <span className="text-xl font-bold text-brand-navy">GymTrack</span>
      </div>

      <div className="flex items-center bg-slate-50 border border-brand-border rounded-full px-4 py-1.5 w-[300px] text-brand-muted">
        <Activity size={16} className="mr-2" /> Search...
      </div>

      <div className="flex items-center gap-4">
        {(!isOnline || pendingCount > 0) && (
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border ${
              isOnline
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-red-50 border-red-300 text-brand-danger'
            }`}
          >
            {isOnline ? `Syncing ${pendingCount}...` : 'Offline'}
          </div>
        )}
        {lastApiLatency && (
          <div className="text-xs text-brand-muted flex items-center gap-1">
            <Zap size={14} className="text-brand-orange" /> {lastApiLatency} ms
          </div>
        )}
        <div className="w-8 h-8 rounded-full bg-brand-border flex justify-center items-center">
          <User size={18} className="text-brand-muted" />
        </div>
      </div>
    </header>
  );
}
