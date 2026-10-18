import { PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string | null;
  actionText?: string;
  onAction?: () => void;
  imageSrc?: string | null;
}

export default function EmptyState({
  title = 'No workouts logged yet',
  description = null,
  actionText = 'Log First Workout',
  onAction,
  imageSrc = null
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white rounded-2xl border border-brand-border text-center shadow-sm">
      {imageSrc && (
        <div className="w-32 h-32 max-w-full flex items-center justify-center mb-5 transition-transform hover:scale-105 duration-300">
          <img
            src={imageSrc}
            alt={title}
            className="w-full h-full object-contain select-none pointer-events-none drop-shadow-md"
          />
        </div>
      )}

      <h3 className={`text-lg font-bold text-brand-navy tracking-tight ${description ? 'mb-1.5' : 'mb-4'}`}>
        {title}
      </h3>

      {description && (
        <p className="text-sm text-brand-muted max-w-md mx-auto leading-relaxed mb-5">
          {description}
        </p>
      )}

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover transition-colors shadow-sm cursor-pointer"
        >
          <PlusCircle size={16} />
          {actionText}
        </button>
      )}
    </div>
  );
}

