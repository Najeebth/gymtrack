import { useEffect, useRef, useState } from 'react';
import { Sparkles, ChevronDown, Check, Plus } from 'lucide-react';
import { useExercisesQuery } from '../hooks/useExercisesQuery';
import { COMMON_EXERCISES } from '../constants/exercises';
import type { Exercise, MuscleGroup } from '../types';

interface ExerciseAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  muscleGroup: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  onQuickAdd?: (currentValue: string) => void;
}

interface SuggestionOption {
  name: string;
  equipment?: string;
  isCustom?: boolean;
}

export default function ExerciseAutocomplete({
  value,
  onChange,
  muscleGroup,
  placeholder,
  className,
  required,
  onQuickAdd,
}: ExerciseAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch exercises matching the current muscle group from cached query
  const { exercises: dbExercises } = useExercisesQuery({
    muscleGroup: muscleGroup && muscleGroup !== 'All' ? muscleGroup : undefined,
    limit: 50,
  });

  // Build full list of suggestions for this muscle group
  const fullList: SuggestionOption[] =
    dbExercises.length > 0
      ? dbExercises.map((ex) => ({
          name: ex.name,
          equipment: ex.equipment,
          isCustom: ex.isCustom,
        }))
      : (COMMON_EXERCISES[muscleGroup as MuscleGroup] || []).map((name) => ({ name }));

  const lowerValue = (value || '').trim().toLowerCase();

  // If value is empty OR matches an option completely, show the FULL list so the user can easily re-select
  const isExactMatch = fullList.some((opt) => opt.name.toLowerCase() === lowerValue);

  const filteredOptions =
    !lowerValue || isExactMatch
      ? fullList
      : fullList.filter((opt) => opt.name.toLowerCase().includes(lowerValue));

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className={`${className || ''} pr-8`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition"
          aria-label="Toggle exercise suggestions"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {open && filteredOptions.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-40 bg-white border border-brand-border rounded-lg shadow-xl max-h-[260px] flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filteredOptions.map((opt) => {
              const isSelected = opt.name.toLowerCase() === lowerValue;
              return (
                <div
                  key={opt.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.name);
                    setOpen(false);
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 transition ${
                    isSelected
                      ? 'bg-orange-50 text-brand-orange font-semibold'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <Check size={14} className="text-brand-orange shrink-0" />}
                    <span>{opt.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.equipment && (
                      <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {opt.equipment}
                      </span>
                    )}
                    {opt.isCustom && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                        <Sparkles size={9} /> Custom
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {onQuickAdd && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                onQuickAdd(value);
                setOpen(false);
              }}
              className="p-2.5 bg-orange-50 hover:bg-orange-100 text-brand-orange text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition border-t border-brand-border shrink-0 select-none"
            >
              <Plus size={13} />
              <span>Create new exercise{value.trim() ? ` "${value.trim()}"` : ''}</span>
            </div>
          )}
        </div>
      )}

      {open && filteredOptions.length === 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-40 bg-white border border-brand-border rounded-lg shadow-xl p-3.5 text-center">
          <p className="text-xs text-brand-muted mb-2.5">No exercises found</p>
          {onQuickAdd && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onQuickAdd(value);
                setOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-orange text-white text-xs font-semibold hover:bg-brand-orange-hover transition shadow-sm cursor-pointer"
            >
              <Plus size={13} /> Create "{value || 'New exercise'}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
