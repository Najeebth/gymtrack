import { Users } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAdminUsersQuery } from '../hooks/useAdminQuery';
import type { AdminUser } from '../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function UsersPage() {
  const { email: myEmail } = useAppData();
  const { users, loadError, deleteUser, isDeleting } = useAdminUsersQuery();
  const confirm = useConfirm();

  const handleDelete = async (user: AdminUser) => {
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const ok = await confirm({
      title: 'Delete account?',
      message: (
        <>
          <strong className="text-brand-navy">{user.email}</strong> and their {plural(user.workoutCount, 'workout')} and{' '}
          {plural(user.templateCount, 'template')} will be permanently deleted. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteUser(user.id);
    } catch {
      // The mutation's onError shows the failure toast
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
                        ) : (
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isDeleting}
                            aria-label={`Delete ${user.email}`}
                            className="bg-transparent border border-red-200 text-brand-danger rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-50"
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
