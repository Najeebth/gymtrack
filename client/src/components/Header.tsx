import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Activity,
  Dumbbell,
  Zap,
  User,
  LogOut,
  Camera,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

export default function Header() {
  const {
    isOnline,
    pendingCount,
    lastApiLatency,
    authToken,
    email,
    isAdmin,
    avatarUrl,
    uploadAvatar,
    removeAvatar,
    logout,
  } = useAppData();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = '';

    setIsUploading(true);
    try {
      await uploadAvatar(file);
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm('Remove profile photo?')) return;
    setIsUploading(true);
    try {
      await removeAvatar();
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  // User initials for clean fallback (e.g. "JD" for john@doe.com)
  const initial = (email?.[0] || 'U').toUpperCase();

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
          {/* Avatar Button */}
          <button
            type="button"
            onClick={handleAvatarClick}
            aria-label={authToken ? 'Account menu' : 'Not logged in'}
            className={`w-9 h-9 rounded-full flex justify-center items-center border border-slate-200 overflow-hidden transition shadow-xs ${
              authToken ? 'cursor-pointer hover:ring-2 hover:ring-brand-orange/40' : 'cursor-default'
            }`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-brand-orange/10 flex items-center justify-center font-bold text-xs text-brand-orange">
                {authToken ? initial : <User size={16} className="text-brand-muted" />}
              </div>
            )}
          </button>

          {/* Hidden File Input for Image Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
          />

          {/* User Dropdown Menu */}
          {menuOpen && authToken && (
            <div className="absolute right-0 top-12 w-64 bg-white border border-brand-border rounded-xl shadow-xl py-2 z-[1001] animate-in fade-in zoom-in-95 duration-100">
              {/* Profile Card Header */}
              <div className="px-4 py-3 border-b border-brand-border flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 border border-slate-200">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-brand-orange/10 flex items-center justify-center font-bold text-sm text-brand-orange">
                      {initial}
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 size={16} className="text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold text-brand-navy truncate"
                    title={email ?? undefined}
                  >
                    {email}
                  </div>
                  <div className="text-xs text-brand-muted">
                    {isAdmin ? 'Admin' : 'Member'}
                  </div>
                </div>
              </div>

              {/* Avatar Actions */}
              <div className="p-2 border-b border-slate-100 space-y-1">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  <Camera size={14} className="text-brand-orange" />
                  {isUploading ? 'Uploading to Cloud...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleRemovePhoto}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Remove Photo
                  </button>
                )}
              </div>

              {/* Logout Button */}
              <div className="pt-1 px-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-danger hover:bg-red-50 rounded-lg transition cursor-pointer"
                >
                  <LogOut size={14} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
