import { NavLink } from 'react-router-dom';
import { Dumbbell, CalendarDays, TrendingUp, Activity, ShieldCheck, Map, Lock, Unlock } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

const navItemClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg border-none text-left transition-all ${
    isActive ? 'bg-orange-50 text-brand-orange font-semibold' : 'text-brand-muted font-medium'
  }`;

export default function Sidebar() {
  const { adminToken } = useAppData();

  return (
    <aside className="w-60 bg-white border-r border-brand-border py-6 px-3 flex flex-col gap-2 overflow-y-auto">
      <div className="text-xs font-bold text-brand-muted px-3 mb-2 uppercase tracking-wide">Home</div>

      <NavLink to="/workouts" className={navItemClasses}>
        <Dumbbell size={18} /> My Workouts
      </NavLink>
      <NavLink to="/by-date" className={navItemClasses}>
        <CalendarDays size={18} /> By Date
      </NavLink>
      <NavLink to="/progress" className={navItemClasses}>
        <TrendingUp size={18} /> Progress
      </NavLink>

      {adminToken && (
        <>
          <div className="text-xs font-bold text-brand-muted px-3 mt-4 mb-2 uppercase tracking-wide">
            Admin Apps
          </div>
          <NavLink to="/traffic" className={navItemClasses}>
            <Activity size={18} /> Live Traffic
          </NavLink>
          <NavLink to="/health" className={navItemClasses}>
            <ShieldCheck size={18} /> Server Health
          </NavLink>
          <NavLink to="/map" className={navItemClasses}>
            <Map size={18} /> Request Map
          </NavLink>
        </>
      )}

      <div className="mt-auto">
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg border-none text-left w-full font-semibold transition-all ${
              isActive ? 'bg-slate-100' : 'bg-transparent'
            } ${adminToken ? 'text-brand-success-soft' : 'text-amber-500'}`
          }
        >
          {adminToken ? <Unlock size={18} /> : <Lock size={18} />} Admin Panel
        </NavLink>
      </div>
    </aside>
  );
}
