import { NavLink } from 'react-router-dom';
import { Dumbbell, CalendarDays, TrendingUp, ClipboardList, Activity, ShieldCheck, Map, Users } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

const navItemClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg border-none text-left transition-all ${
    isActive ? 'bg-orange-50 text-brand-orange font-semibold' : 'text-brand-muted font-medium'
  }`;

export default function Sidebar() {
  const { isAdmin } = useAppData();

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
      <NavLink to="/templates" className={navItemClasses}>
        <ClipboardList size={18} /> Templates
      </NavLink>

      {isAdmin && (
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
          <NavLink to="/users" className={navItemClasses}>
            <Users size={18} /> Users
          </NavLink>
        </>
      )}
    </aside>
  );
}
