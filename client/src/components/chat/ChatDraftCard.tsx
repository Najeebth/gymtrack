import { Check, CloudOff, Loader2, X } from 'lucide-react';
import type { ChatActionStatus, ChatWorkoutDraft } from '../../types';

interface ChatDraftCardProps {
  draft: ChatWorkoutDraft;
  /** Set once the user acted on it (remembered across reloads). */
  status?: ChatActionStatus;
  /** False for older drafts: only the newest one can still be confirmed. */
  actionable: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

const STATUS_BADGES: Record<ChatActionStatus | 'expired', { label: string; className: string; icon?: React.ReactNode }> = {
  saved: { label: 'Saved', className: 'bg-green-50 text-brand-success border-green-200', icon: <Check size={12} /> },
  queued: { label: 'Queued offline', className: 'bg-amber-50 text-amber-600 border-amber-300', icon: <CloudOff size={12} /> },
  dismissed: { label: 'Dismissed', className: 'bg-slate-50 text-brand-muted border-brand-border' },
  expired: { label: 'Not logged', className: 'bg-slate-50 text-brand-muted border-brand-border' },
};

// A workout the bot proposed. Nothing is saved until the user confirms here.
export default function ChatDraftCard({ draft, status, actionable, confirming, onConfirm, onDismiss }: ChatDraftCardProps) {
  const badge = status ? STATUS_BADGES[status] : actionable ? null : STATUS_BADGES.expired;

  return (
    <div className="mt-2 bg-white border border-brand-border rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[0.65rem] uppercase bg-brand-navy text-sky-100 px-1.5 py-0.5 rounded font-bold">
          {draft.muscleGroup}
        </span>
        <strong className="text-sm text-brand-navy truncate">{draft.exercise}</strong>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {draft.sets.map((s, i) => (
          <span key={i} className="bg-slate-50 border border-brand-border rounded-md px-1.5 py-0.5 text-xs">
            <span className="text-brand-navy">{s.reps}</span>
            <span className="text-brand-muted"> × </span>
            <span className="text-brand-orange font-semibold">{s.weightKg > 0 ? `${s.weightKg} kg` : 'BW'}</span>
          </span>
        ))}
      </div>

      {badge ? (
        <div className={`mt-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
          {badge.icon}
          {badge.label}
        </div>
      ) : (
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-lg py-1.5 transition cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {confirming ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {confirming ? 'Saving…' : `Log for ${draft.date}`}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={confirming}
            aria-label="Dismiss this workout"
            className="flex items-center justify-center bg-brand-border hover:bg-slate-300 text-brand-navy rounded-lg px-2.5 transition cursor-pointer disabled:opacity-60"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
