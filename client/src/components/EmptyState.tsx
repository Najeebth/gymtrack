import { PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  imageSrc?: string;
}

export default function EmptyState({
  title = 'No workouts logged yet',
  description = 'Your training journey starts here. Add your first exercise and set above to track your volume, reps, and personal records.',
  actionText = 'Log First Workout',
  onAction,
  imageSrc = '/empty-workouts.svg'
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white rounded-2xl border border-brand-border text-center shadow-sm">
      <div className="w-56 h-40 max-w-full flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300">
        <img
          src={imageSrc}
          alt={title}
          className="w-full h-full object-contain select-none pointer-events-none"
        />
      </div>

      <h3 className="text-lg font-bold text-brand-navy tracking-tight mb-1.5">
        {title}
      </h3>

      <p className="text-sm text-brand-muted max-w-md mx-auto leading-relaxed mb-5">
        {description}
      </p>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover transition-colors shadow-sm cursor-pointer"
        >
          <PlusCircle size={16} />
          {actionText}
        </button>
      )}
    </div>
  );
}

