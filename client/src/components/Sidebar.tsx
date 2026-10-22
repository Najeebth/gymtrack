import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Dumbbell, CalendarDays, TrendingUp, ClipboardList, Library, Activity, ShieldCheck, Map, Users, X } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

const navItemClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg border-none text-left transition-all ${
    isActive ? 'bg-orange-50 text-brand-orange font-semibold' : 'text-brand-muted font-medium'
  }`;

interface SidebarProps {
  /** Mobile only: whether the slide-in drawer is showing. */
  open: boolean;
  onClose: () => void;
}

// Static column from md up; below that, a slide-in drawer opened from the header.
export default function Sidebar({ open, onClose }: SidebarProps) {
  const { pathname } = useLocation();

  // Close the drawer after navigating, and on Escape
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      <aside className="hidden md:flex w-60 shrink-0 bg-white border-r border-brand-border py-6 px-3 flex-col gap-2 overflow-y-auto">
        <NavItems />
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-[950]" role="dialog" aria-label="Navigation">
          <div className="absolute inset-0 bg-brand-navy/40" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[80vw] bg-white shadow-2xl py-4 px-3 flex flex-col gap-2 overflow-y-auto">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="p-2 rounded-lg text-brand-muted hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <NavItems />
          </aside>
        </div>
      )}
    </>
  );
}

function NavItems() {
  const { isAdmin } = useAppData();

  return (
    <>
      <div className="text-xs font-bold text-brand-muted px-3 mb-2 uppercase tracking-wide">Home</div>

      <NavLink to="/workouts" className={navItemClasses}>
        <Dumbbell size={18} /> My Workouts
      </NavLink>
      <NavLink to="/exercises" className={navItemClasses}>
        <Library size={18} /> Exercises
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
    </>
  );
}
