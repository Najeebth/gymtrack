import { useEffect, useRef } from 'react';
import { animate, inView } from 'motion';
import { prefersReducedMotion } from '../utils/motion';

// Fades + slides an element in the first time it scrolls into view. While
// `enabled` is false the element stays hidden and is not observed yet.
export function useReveal<T extends HTMLElement>(delay = 0, enabled = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    if (!enabled) return;

    const stop = inView(
      el,
      () => {
        animate(
          el,
          { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] },
          { duration: 0.6, delay, ease: 'easeOut' }
        );
        stop();
      },
      { margin: '-80px' }
    );

    return () => stop();
  }, [delay, enabled]);

  return ref;
}
