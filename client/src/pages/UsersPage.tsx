import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { deleteUserApi, fetchUsersApi } from '../api/admin';
import type { AdminUser } from '../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function UsersPage() {
  const { authToken, email: myEmail } = useAppData();
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authToken) return;
    try {
      setUsers(await fetchUsersApi(authToken));
      setLoadError(null);
    } catch (err) {
      setLoadError(navigator.onLine ? (err as Error).message : "You're offline — reconnect to see accounts.");
    }
  }, [authToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (user: AdminUser) => {
    if (!authToken) return;
    setDeletingId(user.id);
    try {
      await deleteUserApi(authToken, user.id);
      setUsers((prev) => (prev ? prev.filter((u) => u.id !== user.id) : prev));
      showToast(`Deleted ${user.email}`, 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  const members = users?.filter((u) => u.role === 'MEMBER').length ?? 0;
  const totalWorkouts = users?.reduce((sum, u) => sum + u.workoutCount, 0) ?? 0;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-3 flex items-center gap-1.5">
        <Users size={20} className="text-brand-orange" /> Users
      </h1>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-brand-danger rounded-lg p-3 text-sm mb-4">{loadError}</div>
      )}

      {users && (
        <>
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Stat label="Accounts" value={users.length} />
            <Stat label="Members" value={members} />
            <Stat label="Workouts logged" value={totalWorkouts} />
          </div>

          <div className="overflow-x-auto bg-white rounded-xl border border-brand-border">
            <table className="w-full border-collapse text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-brand-border text-brand-muted">
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5 text-right">Workouts</th>
                  <th className="px-3 py-2.5 text-right">Templates</th>
                  <th className="px-3 py-2.5">Last workout</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isMe = user.email === myEmail;
                  return (
                    <tr key={user.id} className="border-b border-brand-border last:border-b-0">
                      <td className="px-3 py-2.5 font-medium">
                        {user.email}
                        {isMe && <span className="ml-2 text-xs text-brand-muted font-normal">(you)</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            user.role === 'ADMIN' ? 'bg-brand-navy text-sky-100' : 'bg-slate-100 text-brand-muted'
                          }`}
                        >
                          {user.role === 'ADMIN' ? 'Admin' : 'Member'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-brand-muted">{formatDate(user.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{user.workoutCount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{user.templateCount}</td>
                      <td className="px-3 py-2.5 text-brand-muted">{user.lastWorkoutDate ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {isMe ? (
                          <span className="text-xs text-brand-muted">—</span>
                        ) : confirmingId === user.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-brand-muted">
                              Delete account and {user.workoutCount} workout{user.workoutCount === 1 ? '' : 's'}?
                            </span>
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={deletingId === user.id}
                              className="bg-brand-danger text-white border-none rounded-md px-2.5 py-1 font-semibold cursor-pointer disabled:opacity-70"
                            >
                              {deletingId === user.id ? 'Deleting…' : 'Delete'}
                            </button>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="bg-transparent border border-brand-border text-brand-muted rounded-md px-2.5 py-1 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmingId(user.id)}
                            aria-label={`Delete ${user.email}`}
                            className="bg-transparent border border-red-200 text-brand-danger rounded-md px-2.5 py-1 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!users && !loadError && <div className="text-brand-muted text-sm">Loading accounts…</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-3.5 rounded-[10px] border border-brand-border">
      <div className="text-sm text-brand-muted">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
