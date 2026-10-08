import { useEffect, useRef, useState } from 'react';
import { Activity, Dumbbell, Zap, User, LogOut } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

export default function Header() {
  const { isOnline, pendingCount, lastApiLatency, authToken, email, isAdmin, logout } = useAppData();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleAvatarClick = () => {
    if (!authToken) return;
    setMenuOpen((open) => !open);
  };

  // No navigation here: once the token is gone, the route guard for the
  // current page sends the user to the matching login screen.
  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

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

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={handleAvatarClick}
            aria-label={authToken ? 'Account menu' : 'Not logged in'}
            className={`w-8 h-8 rounded-full flex justify-center items-center border-none ${
              authToken ? 'bg-brand-orange/10 cursor-pointer' : 'bg-brand-border cursor-default'
            }`}
          >
            <User size={18} className={authToken ? 'text-brand-orange' : 'text-brand-muted'} />
          </button>

          {menuOpen && authToken && (
            <div className="absolute right-0 top-11 w-56 bg-white border border-brand-border rounded-lg shadow-lg py-1 z-[1001]">
              <div className="px-3 py-2 border-b border-brand-border">
                <div className="text-sm text-brand-navy truncate" title={email ?? undefined}>
                  {email}
                </div>
                <div className="text-xs text-brand-muted">{isAdmin ? 'Admin' : 'Member'}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brand-danger-soft border-none bg-transparent cursor-pointer hover:bg-slate-50"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
