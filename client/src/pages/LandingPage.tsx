import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger } from 'motion';
import { Dumbbell, TrendingUp, CalendarDays, Activity, ArrowRight, Flame, Trophy } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';
import { EXPO_OUT, prefersReducedMotion } from '../utils/motion';
import BrandMark from '../components/BrandMark';
import IntroOverlay, { INTRO_SEEN_KEY } from '../components/IntroOverlay';

const PAGE_BG = '#0F172A';

// Plays once per browser tab.
function shouldPlayIntro(): boolean {
  if (prefersReducedMotion()) return false;
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

const FEATURES = [
  {
    icon: Dumbbell,
    title: 'Log every set',
    description: 'Track reps, weight, and notes per exercise in seconds, even offline.',
  },
  {
    icon: TrendingUp,
    title: 'See your progress',
    description: 'Charts that show whether you are actually getting stronger over time.',
  },
  {
    icon: CalendarDays,
    title: 'Browse by date',
    description: 'Jump back to any training day and review exactly what you did.',
  },
  {
    icon: Activity,
    title: 'Works offline',
    description: "Queue workouts without a connection — they sync the moment you're back online.",
  },
];

// The hero's "product shots": position/size on the stage, resting tilt, and
// depth-of-field blur (further away = blurrier and fainter). The blur is
// static, so each one is rasterised once and after that only ever moved.
const DUMBBELLS = [
  { box: 'left-[60%] top-[41%] w-[30vw] max-w-[400px] hidden md:block', tilt: -24, blur: 0, opacity: 1 },
  { box: 'left-[91%] top-[17%] w-[18vw] min-w-[130px] max-w-[260px]', tilt: 38, blur: 3, opacity: 0.85 },
  { box: 'left-[86%] top-[85%] w-[13vw] max-w-[190px] hidden md:block', tilt: 12, blur: 0, opacity: 1 },
  { box: 'left-[44%] top-[9%] w-[10.5vw] max-w-[150px] hidden md:block', tilt: -52, blur: 2.5, opacity: 0.7 },
  { box: 'left-[-5%] top-[88%] md:top-[80%] w-[16vw] min-w-[120px] max-w-[230px]', tilt: 28, blur: 5, opacity: 0.55 },
  { box: 'left-[40%] top-[70%] w-[7vw] max-w-[100px] hidden md:block', tilt: 72, blur: 1.5, opacity: 0.8 },
];

// Placed in the corners that the main dumbbell's diagonal leaves free.
const STAT_CARDS = [
  { box: 'top-8 left-0 w-56', icon: TrendingUp, label: "This week's volume", value: '12,480 kg', accent: 'text-brand-orange' },
  { box: 'bottom-6 right-0 w-52', icon: Flame, label: 'Current streak', value: '9 days', accent: 'text-amber-400' },
  { box: 'bottom-0 left-0 w-56', icon: Trophy, label: 'New PR', value: 'Bench · 95 kg', accent: 'text-brand-success-soft' },
];

export default function LandingPage() {
  const [playIntro] = useState(shouldPlayIntro);
  const [introActive, setIntroActive] = useState(playIntro);
  const [revealed, setRevealed] = useState(!playIntro);
  const stageRef = useRef<HTMLDivElement>(null);
  const navMarkRef = useRef<HTMLDivElement>(null);
  const featuresHeadingRef = useReveal<HTMLDivElement>(0, revealed);
  const ctaRef = useReveal<HTMLDivElement>(0.1, revealed);

  // Hero entrance: headline lines rise out of their masks, supporting copy
  // fades up, and the dumbbells fly out from the centre of the screen.
  const reveal = useCallback((startDelay = 0) => {
    const stage = stageRef.current;
    if (!stage) return;
    const all = (selector: string) => Array.from(stage.querySelectorAll<HTMLElement>(selector));

    animate(
      all('[data-reveal="line"]'),
      { transform: ['translateY(110%)', 'translateY(0%)'] },
      { duration: 0.9, delay: stagger(0.09, { startDelay }), ease: EXPO_OUT }
    );
    animate(
      all('[data-reveal="fade"]'),
      { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] },
      { duration: 0.6, delay: stagger(0.08, { startDelay: startDelay + 0.25 }), ease: 'easeOut' }
    );

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    all('[data-reveal="dumbbell"]').forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const dx = centerX - (rect.left + rect.width / 2);
      const dy = centerY - (rect.top + rect.height / 2);
      const spin = i % 2 ? 80 : -80;
      const delay = startDelay + i * 0.07;
      animate(el, { opacity: [0, 1] }, { duration: 0.3, delay, ease: 'easeOut' });
      animate(
        el,
        {
          transform: [
            `translate(${dx}px, ${dy}px) scale(0.2) rotate(${spin}deg)`,
            'translate(0px, 0px) scale(1) rotate(0deg)',
          ],
        },
        { duration: 1.2, delay, ease: EXPO_OUT }
      );
    });

    animate(
      all('[data-reveal="card"]'),
      { opacity: [0, 1], transform: ['translateY(20px) scale(0.96)', 'translateY(0px) scale(1)'] },
      { duration: 0.6, delay: stagger(0.1, { startDelay: startDelay + 0.55 }), ease: 'easeOut' }
    );
  }, []);

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.style.backgroundColor = PAGE_BG;

    const stage = stageRef.current;
    if (stage && !prefersReducedMotion()) {
      stage.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        if (el.dataset.reveal === 'line') el.style.transform = 'translateY(110%)';
        else el.style.opacity = '0';
      });
      if (!playIntro) reveal();
    }

    return () => {
      html.style.backgroundColor = '';
    };
  }, [playIntro, reveal]);

  const handleDone = useCallback(() => {
    setIntroActive(false);
    setRevealed(true);
  }, []);

  return (
    <div className="min-h-screen bg-brand-navy text-white font-sans overflow-x-hidden">
      {introActive && (
        <IntroOverlay targetRef={navMarkRef} onReveal={reveal} onDone={handleDone} />
      )}

      {/* Stage: nav + hero, with the dumbbells layered behind the content */}
      <div ref={stageRef} className="relative overflow-hidden">
        <HeroDumbbells />

        <header className="relative z-10 flex items-center justify-between px-6 md:px-12 h-20">
          <BrandMark ref={navMarkRef} style={{ opacity: introActive ? 0 : 1 }} />
          <Link
            data-reveal="fade"
            to="/workouts"
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold bg-brand-orange hover:bg-brand-orange-hover transition-colors"
          >
            Open App <ArrowRight size={16} />
          </Link>
        </header>

        <section className="relative z-10 px-6 md:px-12 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div
              data-reveal="fade"
              className="inline-block mb-5 text-xs font-semibold tracking-wide uppercase text-brand-orange bg-brand-orange/10 border border-brand-orange/30 rounded-full px-3 py-1"
            >
              Train. Log. Improve.
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
                <span data-reveal="line" className="block">
                  Your workouts,
                </span>
              </span>
              <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
                <span data-reveal="line" className="block text-brand-orange">
                  tracked properly.
                </span>
              </span>
            </h1>
            <p data-reveal="fade" className="text-lg text-slate-300 mb-8 max-w-xl">
              GymTrack logs every set and rep so you can see real progress instead of guessing. No
              spreadsheets, no clutter — just your training history, always within reach.
            </p>
            <Link
              data-reveal="fade"
              to="/workouts"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold bg-brand-orange hover:bg-brand-orange-hover transition-colors"
            >
              Start logging <ArrowRight size={18} />
            </Link>
          </div>

          <div className="relative hidden md:block h-[420px]">
            <div className="absolute -inset-16 bg-[radial-gradient(closest-side,rgba(249,115,22,0.22),transparent)]" />
            {STAT_CARDS.map((card, i) => (
              <div key={card.label} data-reveal="card" className={`absolute will-change-transform ${card.box}`}>
                <div
                  className="gt-float rounded-xl border border-white/10 bg-slate-800/90 p-4 shadow-xl"
                  style={{ animationDelay: `${i * -1.4}s` }}
                >
                  <card.icon size={18} className={`${card.accent} mb-2`} />
                  <div className="text-xs text-slate-400 mb-0.5">{card.label}</div>
                  <div className="text-lg font-bold">{card.value}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Features */}
      <section className="px-6 md:px-12 pb-24">
        <div ref={featuresHeadingRef} className="mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Everything you need, nothing you don't</h2>
          <p className="text-slate-400">Built for the gym, not the boardroom.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} delay={i * 0.08} enabled={revealed} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 pb-24">
        <div
          ref={ctaRef}
          className="rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-hover px-8 py-12 text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to track your next session?</h2>
          <p className="text-white/80 mb-6">It takes less time to log a set than to rest between them.</p>
          <Link
            to="/workouts"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold bg-white text-brand-navy hover:bg-slate-100 transition-colors"
          >
            Open GymTrack <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function HeroDumbbells() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gt-plate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FDBA74" />
            <stop offset="0.45" stopColor="#F97316" />
            <stop offset="1" stopColor="#C2410C" />
          </linearGradient>
          <linearGradient id="gt-plate-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FB923C" />
            <stop offset="0.5" stopColor="#EA580C" />
            <stop offset="1" stopColor="#9A3412" />
          </linearGradient>
          <linearGradient id="gt-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F1F5F9" />
            <stop offset="0.5" stopColor="#94A3B8" />
            <stop offset="1" stopColor="#475569" />
          </linearGradient>
        </defs>
      </svg>

      {DUMBBELLS.map((dumbbell, i) => (
        <div
          key={i}
          data-reveal="dumbbell"
          className={`absolute ${dumbbell.box}`}
          // Promoted up front so they are rasterised behind the intro, not mid-reveal.
          style={{ willChange: 'transform, opacity' }}
        >
          <div
            className="gt-float"
            style={{
              transform: `rotate(${dumbbell.tilt}deg)`,
              filter: dumbbell.blur ? `blur(${dumbbell.blur}px)` : undefined,
              opacity: dumbbell.opacity,
              animationDelay: `${i * -0.9}s`,
            }}
          >
            <DumbbellArt />
          </div>
        </div>
      ))}
    </div>
  );
}

function DumbbellArt() {
  return (
    <svg viewBox="0 0 240 100" className="block w-full h-auto">
      <rect x="10" y="44" width="220" height="12" rx="6" fill="url(#gt-steel)" />
      {[104, 112, 120, 128, 136].map((x) => (
        <line key={x} x1={x} y1="45" x2={x} y2="55" stroke="#334155" strokeWidth="1.5" opacity="0.45" />
      ))}
      <rect x="4" y="40" width="12" height="20" rx="4" fill="url(#gt-steel)" />
      <rect x="224" y="40" width="12" height="20" rx="4" fill="url(#gt-steel)" />
      <rect x="14" y="22" width="22" height="56" rx="8" fill="url(#gt-plate-deep)" />
      <rect x="204" y="22" width="22" height="56" rx="8" fill="url(#gt-plate-deep)" />
      <rect x="34" y="8" width="24" height="84" rx="9" fill="url(#gt-plate)" />
      <rect x="182" y="8" width="24" height="84" rx="9" fill="url(#gt-plate)" />
      <rect x="56" y="36" width="10" height="28" rx="3" fill="url(#gt-steel)" />
      <rect x="174" y="36" width="10" height="28" rx="3" fill="url(#gt-steel)" />
      <rect x="17" y="27" width="4" height="46" rx="2" fill="#fff" opacity="0.2" />
      <rect x="207" y="27" width="4" height="46" rx="2" fill="#fff" opacity="0.2" />
      <rect x="38" y="13" width="5" height="74" rx="2.5" fill="#fff" opacity="0.28" />
      <rect x="186" y="13" width="5" height="74" rx="2.5" fill="#fff" opacity="0.28" />
    </svg>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
  enabled,
}: {
  icon: typeof Dumbbell;
  title: string;
  description: string;
  delay: number;
  enabled: boolean;
}) {
  const ref = useReveal<HTMLDivElement>(delay, enabled);
  return (
    <div ref={ref} className="rounded-xl border border-white/10 bg-white/5 p-5">
      <Icon size={22} className="text-brand-orange mb-3" />
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}
