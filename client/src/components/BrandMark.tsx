import { forwardRef, type CSSProperties } from 'react';
import { Dumbbell } from 'lucide-react';

const NAME = 'GymTrack';

// The GymTrack logo lockup. `k` scales every dimension together, so the big
// intro version and the nav version are the same shape at different sizes —
// which is what lets the intro logo land exactly on the nav logo.
const BrandMark = forwardRef<HTMLDivElement, { k?: number; style?: CSSProperties }>(
  function BrandMark({ k = 1, style }, ref) {
    return (
      <div
        ref={ref}
        role="img"
        aria-label={NAME}
        className="flex items-center font-bold text-white whitespace-nowrap"
        style={{ gap: 8 * k, fontSize: 18 * k, lineHeight: `${28 * k}px`, ...style }}
      >
        <Dumbbell data-brand-icon="" size={26 * k} className="text-brand-orange shrink-0" />
        <span aria-hidden className="flex">
          {NAME.split('').map((letter, i) => (
            <span key={i} className="block overflow-hidden">
              <span data-brand-letter="" className="block">
                {letter}
              </span>
            </span>
          ))}
        </span>
      </div>
    );
  }
);

export default BrandMark;
