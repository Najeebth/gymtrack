import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Dumbbell,
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  UserPlus,
  Zap,
  Quote,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import BrandMark from '../components/BrandMark';

export default function LoginPage() {
  const { authToken, login, signup } = useAppData();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated or just authenticated, redirect to dashboard
  if (authToken) {
    return <Navigate to="/dashboard" replace />;
  }

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignup && form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }

    if (isSignup && form.password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const result = isSignup
        ? await signup(form.email, form.password)
        : await login(form.email, form.password);

      if (!result.ok) {
        setError(result.error || (isSignup ? 'Signup failed. Please try again.' : 'Invalid email or password.'));
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setError('');
    setForm({ email: form.email, password: '', confirm: '' });
    setMode(isSignup ? 'login' : 'signup');
  };

  const handleSocialClick = (provider: 'Google' | 'Apple') => {
    showToast(`${provider} sign-in is not configured yet. Please continue with email.`, 'info');
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    showToast('Please reach out to your gym administrator to reset your credentials.', 'info');
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0a0e17] text-slate-200 font-sans selection:bg-brand-500 selection:text-white antialiased overflow-x-hidden">
      {/* ========================================================
          LEFT COLUMN: EDITORIAL SHOWCASE (Desktop lg+)
          ======================================================== */}
      <section
        className="relative hidden lg:flex lg:w-[50%] xl:w-[54%] flex-col justify-between p-10 xl:p-16 overflow-hidden select-none"
        aria-label="GymTrack Performance Showcase"
      >
        {/* Background Image with Cinematic Overlays */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIx0hvLI8_rVF0U3HozUhNoaN8Rqxx0arpt9DADVwBtkYfApwK1MkA5OzoYlGo587l1SnpjwJfygkpi5YQ4CRSYwT0pxyN7wgKlJ09poKH0u_xI-2KvcQrt6p1YHmeDv2P2kpnxlNDI6WcnhIOTXCCwoD2UzdGVaIOMJy540o7K5ynHD5mzEUn1On40IQCJ_ZJPIRKc7k6QpNrCTUjxyRko5UtXNQ3Y7cpZS9ssLc"
            alt="Athlete lifting weights in gym"
            className="h-full w-full object-cover object-center filter brightness-[0.78] contrast-[1.08] transform scale-105"
          />
          {/* Atmospheric Vignettes & Color Bleeds */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/50 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0a0e17]/30 to-[#0a0e17]" />
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Top Tagline / Pro Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold uppercase tracking-wider text-orange-400">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            GymTrack Pro Performance
          </div>
        </div>

        {/* Mid-Editorial Motivational Typography */}
        <div className="relative z-10 max-w-xl my-auto py-10">
          <div className="inline-block mb-3 text-xs tracking-[0.25em] text-brand-400 font-bold uppercase">
            Unstoppable Discipline
          </div>
          <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-display font-extrabold text-white leading-[1.12] tracking-tight mb-6">
            Track every rep. <br />
            <span
              className="text-transparent bg-clip-text"
              style={{
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundImage: 'linear-gradient(to right, #fb923c, #fcd34d, #ffffff)',
              }}
            >
              Conquer every limit.
            </span>
          </h1>
          <p className="text-base xl:text-lg text-slate-300 font-normal leading-relaxed max-w-md">
            Real-time telemetry and intelligent recovery tracking.
          </p>
        </div>

        {/* Bottom Glass Social Proof Card */}
        <div className="relative z-10">
          <div className="glass-panel rounded-2xl p-5 xl:p-6 max-w-lg shadow-2xl transition hover:border-white/20">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  <Zap size={20} className="text-brand-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white tracking-tight leading-tight">128,450+</p>
                  <p className="text-xs text-slate-400 font-medium">Workouts logged this week</p>
                </div>
              </div>

              {/* Avatar Cluster */}
              <div className="flex -space-x-2.5 overflow-hidden">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200 border-2 border-[#121722]">
                  MT
                </span>
                <span
                  style={{ backgroundColor: '#0284c7' }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white border-2 border-[#121722]"
                >
                  SL
                </span>
                <span
                  style={{ backgroundColor: '#ea580c' }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white border-2 border-[#121722]"
                >
                  DK
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 border-2 border-[#121722]">
                  +2k
                </span>
              </div>
            </div>

            {/* Micro Testimonial */}
            <div className="flex items-start gap-2.5 text-sm text-slate-300">
              <Quote size={16} className="text-brand-400 shrink-0 mt-0.5" />
              <p className="text-xs xl:text-sm text-slate-300">
                <span className="italic text-slate-200">“GymTrack helped me break my PR 3 weeks in a row.”</span>
                <span className="block mt-1 font-semibold not-italic text-brand-400 text-xs">
                  — Marcus T., Powerlifting Coach
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          RIGHT COLUMN: AUTH PORTAL
          ======================================================== */}
      <main className="flex-1 flex flex-col justify-between bg-[#0a0e17] px-6 py-8 sm:px-12 md:px-16 lg:px-12 xl:px-16 min-h-screen">
        {/* Top Navigation Bar */}
        <header className="flex items-center justify-between w-full">
          <Link to="/" className="inline-flex items-center group transition-transform hover:scale-[1.02]" aria-label="GymTrack Home">
            <BrandMark k={1} />
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-800/50"
          >
            <ArrowLeft size={14} />
            <span>Back to home</span>
          </Link>
        </header>

        {/* Center Auth Container */}
        <div className="my-auto py-8 w-full max-w-md mx-auto">
          {/* Form Header */}
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand-500/10 text-brand-400 text-xs font-medium mb-3">
              {isSignup ? <UserPlus size={14} /> : <User size={14} />}
              <span>{isSignup ? 'Member Registration' : 'Member Login'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              {isSignup
                ? 'Start logging your workouts, streaks, and sets in a minute.'
                : 'Log in to see your workouts, streaks, and progress.'}
            </p>
          </div>

          {/* Social Sign-in Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleSocialClick('Google')}
              className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-800 bg-[#121722] hover:bg-slate-800/80 text-xs font-semibold text-slate-200 transition duration-150 hover:border-slate-700 cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="leading-none">Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialClick('Apple')}
              className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-800 bg-[#121722] hover:bg-slate-800/80 text-xs font-semibold text-slate-200 transition duration-150 hover:border-slate-700 cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0 fill-current text-white -mt-0.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.61 1.35-.55.63-1.03 1.66-.9 2.69 1 .08 2.02-.48 2.59-1.19z" />
              </svg>
              <span className="leading-none">Apple</span>
            </button>
          </div>

          {/* Separator */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-slate-800" />
            <span className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-widest shrink-0">
              Or continue with email
            </span>
            <div className="flex-1 border-t border-slate-800" />
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs leading-relaxed"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
              >
                Email Address
              </label>
              <div className="relative rounded-xl border border-slate-800 bg-[#121722] input-ambient-glow transition duration-150 overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 z-10">
                  <Mail size={16} />
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@domain.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{ backgroundColor: '#121722', color: '#f1f5f9' }}
                  className="dark-input w-full pl-10 pr-4 py-3 text-sm placeholder-slate-500 border-none rounded-xl focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative rounded-xl border border-slate-800 bg-[#121722] input-ambient-glow transition duration-150 overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 z-10">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength={isSignup ? 4 : undefined}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{ backgroundColor: '#121722', color: '#f1f5f9' }}
                  className="dark-input w-full pl-10 pr-11 py-3 text-sm placeholder-slate-500 border-none rounded-xl focus:ring-0 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer z-10"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Signup only) */}
            {isSignup && (
              <div>
                <label
                  htmlFor="confirm"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
                >
                  Confirm Password
                </label>
                <div className="relative rounded-xl border border-slate-800 bg-[#121722] input-ambient-glow transition duration-150 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 z-10">
                    <Lock size={16} />
                  </div>
                  <input
                    id="confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    style={{ backgroundColor: '#121722', color: '#f1f5f9' }}
                    className="dark-input w-full pl-10 pr-11 py-3 text-sm placeholder-slate-500 border-none rounded-xl focus:ring-0 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer z-10"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Options: Remember me & Forgot Password */}
            <div className="flex items-center justify-between pt-1 pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0 transition cursor-pointer"
                />
                <span className="text-xs text-slate-400 hover:text-slate-300">Remember for 30 days</span>
              </label>

              {!isSignup && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-brand-500 hover:text-brand-400 transition-colors bg-transparent border-none cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.4)',
              }}
              className="w-full relative group overflow-hidden rounded-xl text-white font-bold py-3.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{isSignup ? 'Create Account' : 'Log In'}</span>
                  <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Login/Signup Mode */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-brand-400 hover:text-brand-300 ml-1 transition-colors underline-offset-4 hover:underline bg-transparent border-none cursor-pointer"
              >
                {isSignup ? 'Log in' : 'Sign up'}
              </button>
            </p>
          </div>
        </div>

        {/* Right Footer */}
        <footer className="w-full pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>
            Admin or coach?{' '}
            <Link to="/admin" className="text-brand-500 hover:text-brand-400 font-medium ml-1 transition-colors">
              Use the admin portal
            </Link>
          </p>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="hover:text-slate-400 transition cursor-default">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition cursor-default">Terms of Service</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
