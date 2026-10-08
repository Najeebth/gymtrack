import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck, LogIn } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import AuthCard, { AuthField, AuthNotice, AuthSubmit } from '../components/AuthCard';

// Admin login. It uses the same login endpoint as members; what matters here
// is whether the account that comes back has the ADMIN role.
export default function AdminPage() {
  const { authToken, isAdmin, login } = useAppData();
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already an admin — server health is the admin's default landing page.
  if (isAdmin) {
    return <Navigate to="/health" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSubmitting(true);
    const result = await login(loginForm.email, loginForm.password);
    setSubmitting(false);
    if (!result.ok) setLoginError(result.error || 'Login failed');
  };

  return (
    <>
      <AuthCard icon={ShieldCheck} title="Admin login" subtitle="For traffic, health and request tooling.">
        {authToken && (
          <AuthNotice tone="info">
            You're logged in as a member. Log in with an admin account to continue.
          </AuthNotice>
        )}
        <form onSubmit={handleSubmit}>
          {loginError && <AuthNotice tone="error">{loginError}</AuthNotice>}
          <AuthField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <AuthField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <AuthSubmit disabled={submitting}>
            <LogIn size={18} /> {submitting ? 'Please wait…' : 'Log In'}
          </AuthSubmit>
        </form>
      </AuthCard>

      <p className="mt-5 text-center text-sm text-slate-400">
        {authToken ? (
          <Link to="/workouts" className="text-brand-orange hover:underline">
            Back to my workouts
          </Link>
        ) : (
          <>
            Not an admin?{' '}
            <Link to="/login" className="text-brand-orange hover:underline">
              Member login
            </Link>
          </>
        )}
      </p>
    </>
  );
}
