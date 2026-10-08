import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Dumbbell, LogIn, UserPlus } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import AuthCard, { AuthField, AuthNotice, AuthSubmit } from '../components/AuthCard';

// Member login/signup. Admins use /admin (see AdminPage).
export default function LoginPage() {
  const { authToken, login, signup } = useAppData();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Covers both "already logged in" and "just logged in from this form".
  if (authToken) {
    return <Navigate to="/workouts" replace />;
  }

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSignup && form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const result = isSignup ? await signup(form.email, form.password) : await login(form.email, form.password);
    setSubmitting(false);
    if (!result.ok) setError(result.error || (isSignup ? 'Signup failed' : 'Login failed'));
  };

  const switchMode = () => {
    setError('');
    setForm({ ...form, password: '', confirm: '' });
    setMode(isSignup ? 'login' : 'signup');
  };

  return (
    <>
      <AuthCard
        icon={Dumbbell}
        title={isSignup ? 'Create your account' : 'Welcome back'}
        subtitle={isSignup ? 'Start logging your workouts in a minute.' : 'Log in to see your workouts.'}
      >
        <form onSubmit={handleSubmit}>
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
          <AuthField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <AuthField
            label="Password"
            type="password"
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={isSignup ? 4 : undefined}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {isSignup && (
            <AuthField
              label="Confirm password"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          )}
          <AuthSubmit disabled={submitting}>
            {isSignup ? <UserPlus size={18} /> : <LogIn size={18} />}
            {submitting ? 'Please wait…' : isSignup ? 'Sign Up' : 'Log In'}
          </AuthSubmit>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="w-full mt-5 text-sm text-slate-300 hover:text-white bg-transparent border-none cursor-pointer"
        >
          {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </AuthCard>

      <p className="mt-5 text-center text-sm text-slate-400">
        Admin?{' '}
        <Link to="/admin" className="text-brand-orange hover:underline">
          Use the admin login
        </Link>
      </p>
    </>
  );
}
