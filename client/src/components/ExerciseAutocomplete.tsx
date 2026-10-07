import { useState } from 'react';
import { COMMON_EXERCISES } from '../constants/exercises';

interface ExerciseAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  muscleGroup: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

// A themed exercise-name input with a suggestion dropdown (replaces the
// native <datalist>, whose popup can't be styled and renders in the OS
// theme instead of ours). Free text is still allowed — suggestions just
// filter as you type and narrow down whenever the muscle group changes.
export default function ExerciseAutocomplete({
  value,
  onChange,
  muscleGroup,
  placeholder,
  className,
  required
}: ExerciseAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const options = (COMMON_EXERCISES[muscleGroup as keyof typeof COMMON_EXERCISES] || []).filter((opt) =>
    opt.toLowerCase().includes((value || '').toLowerCase())
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={className}
      />
      {open && options.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-20 bg-white border border-brand-border rounded-lg shadow-lg max-h-[220px] overflow-y-auto">
          {options.map((opt) => (
            <div
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setOpen(false);
              }}
              className="px-3 py-2 text-sm text-brand-navy cursor-pointer hover:bg-orange-50"
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
