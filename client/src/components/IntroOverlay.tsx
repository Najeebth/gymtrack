import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { animate, stagger } from 'motion';
import { EXPO_OUT } from '../utils/motion';
import BrandMark from './BrandMark';

export const INTRO_SEEN_KEY = 'gymtrack_intro_shown';

const SNAP = [0.76, 0, 0.24, 1] as const;
const NAV_MARK_WIDTH = 130;
// Seconds: pause on the finished logo, curtain travel time, and how far into
// the curtain's travel its edge crosses mid-screen.
const HOLD = 0.25;
const CURTAIN = 0.8;
const REVEAL_AT = 0.45;

interface Props {
  // The real nav logo, rendered (invisibly) underneath; the intro logo lands on it.
  targetRef: RefObject<HTMLElement | null>;
  // Fired while the finished logo is holding still. The page should schedule its
  // entrance to begin `delay` seconds later (as the curtain's edge crosses
  // mid-screen), so that setup work never lands in the middle of the motion.
  onReveal: (delay: number) => void;
  // Fired once the logo has landed and the curtain is gone; the overlay can be unmounted.
  onDone: () => void;
}

// Brand reveal: the logo draws itself in on an orange screen, then shrinks
// onto the nav logo while the orange lifts away like a curtain. Everything
// here animates transform/colour only, so it stays on the compositor.
export default function IntroOverlay({ targetRef, onReveal, onDone }: Props) {
  const curtainRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReveal, onDone });
  callbacks.current = { onReveal, onDone };
  const [k] = useState(() =>
    Math.min(4.2, Math.max(2, (window.innerWidth * 0.6) / NAV_MARK_WIDTH))
  );

  useLayoutEffect(() => {
    const curtain = curtainRef.current;
    const trail = trailRef.current;
    const mark = markRef.current;
    if (!curtain || !trail || !mark) return;

    const icon = mark.querySelector<SVGElement>('[data-brand-icon]');
    const strokes = Array.from(mark.querySelectorAll<SVGPathElement>('[data-brand-icon] path'));
    const letters = Array.from(mark.querySelectorAll<HTMLElement>('[data-brand-letter]'));

    let cancelled = false;
    const running: Array<{ stop: () => void }> = [];
    const timers: number[] = [];
    const play = (...args: Parameters<typeof animate>) => {
      const controls = animate(...args);
      running.push(controls);
      return controls;
    };
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    window.scrollTo(0, 0);
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';

    curtain.style.transform = 'none';
    trail.style.transform = 'none';
    mark.style.transform = 'none';
    mark.style.transformOrigin = '0 0';
    if (icon) icon.style.color = '#ffffff';
    strokes.forEach((path) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '1 2';
      path.style.strokeDashoffset = '1.05';
    });
    letters.forEach((letter) => {
      letter.style.transform = 'translateY(110%)';
    });

    async function run() {
      if (!curtain || !trail || !mark) return;

      play(
        strokes,
        { strokeDashoffset: [1.05, 0] },
        { duration: 0.7, delay: stagger(0.08, { startDelay: 0.15 }), ease: 'easeInOut' }
      );
      await play(
        letters,
        { transform: ['translateY(110%)', 'translateY(0%)'] },
        { duration: 0.6, delay: stagger(0.045, { startDelay: 0.3 }), ease: EXPO_OUT }
      );
      if (cancelled) return;

      callbacks.current.onReveal(HOLD + REVEAL_AT);
      await wait(HOLD * 1000);
      if (cancelled) return;

      const from = mark.getBoundingClientRect();
      const to = targetRef.current?.getBoundingClientRect();
      const landing = to
        ? `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})`
        : 'translate(0px, 0px) scale(1)';

      const lift = { transform: ['translateY(0%)', 'translateY(-100%)'] };
      play(curtain, lift, { duration: CURTAIN, ease: SNAP });
      const trailLift = play(trail, lift, { duration: CURTAIN, delay: 0.09, ease: SNAP });
      // The icon stays white while there is orange behind it, then takes its
      // nav colour as the last of the curtain clears.
      if (icon) {
        play(
          icon,
          { color: ['#ffffff', '#ffffff', '#F97316'] },
          { duration: CURTAIN + 0.09, times: [0, 0.86, 1], ease: 'linear' }
        );
      }
      const flight = play(
        mark,
        { transform: ['translate(0px, 0px) scale(1)', landing] },
        { duration: CURTAIN, ease: SNAP }
      );

      await Promise.all([flight, trailLift]);
      if (cancelled) return;
      try {
        sessionStorage.setItem(INTRO_SEEN_KEY, '1');
      } catch {
        // Storage unavailable (private browsing): the intro just replays next visit.
      }
      callbacks.current.onDone();
    }

    run();
    return () => {
      cancelled = true;
      running.forEach((controls) => controls.stop());
      timers.forEach((id) => window.clearTimeout(id));
      html.style.overflow = previousOverflow;
    };
  }, [targetRef]);

  return (
    <div className="fixed inset-0 z-50" aria-hidden>
      <div ref={trailRef} className="absolute inset-0 bg-brand-orange-hover will-change-transform" />
      <div ref={curtainRef} className="absolute inset-0 bg-brand-orange will-change-transform" />
      <div className="absolute inset-0 flex items-center justify-center">
        <BrandMark ref={markRef} k={k} style={{ willChange: 'transform' }} />
      </div>
    </div>
  );
}
