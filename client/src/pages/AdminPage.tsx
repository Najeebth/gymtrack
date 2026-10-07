import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogIn } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

export default function AdminPage() {
  const { adminToken, login, logout } = useAppData();
  const navigate = useNavigate();
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const result = await login(loginForm.username, loginForm.password);
    if (result.ok) {
      setLoginForm({ username: '', password: '' });
    } else {
      setLoginError(result.error || 'Login failed');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/workouts');
  };

  return (
    <div className="max-w-[400px] mx-auto my-10 bg-white p-6 rounded-xl border border-brand-border shadow-[0_10px_15px_-3px_rgba(0,0,0,0.5)]">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800">
        <User size={24} className="text-brand-orange" /> Admin Panel
      </h2>

      {adminToken ? (
        <div className="text-center">
          <div className="bg-emerald-500/10 text-brand-success-soft p-3 rounded-lg mb-4 border border-emerald-500/20">
            You are securely logged in as Admin.
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-brand-danger-soft text-white border-none rounded-lg font-semibold cursor-pointer"
          >
            Logout
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {loginError && (
            <div className="bg-red-500/10 text-brand-danger-soft p-2 rounded-md mb-4 text-sm border border-red-500/20">
              {loginError}
            </div>
          )}
          <div className="mb-4">
            <label className="text-sm text-brand-muted block mb-1.5">Email / Username</label>
            <input
              type="text"
              required
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-500 rounded-lg text-slate-800"
            />
          </div>
          <div className="mb-6">
            <label className="text-sm text-brand-muted block mb-1.5">Password</label>
            <input
              type="password"
              required
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-500 rounded-lg text-slate-800"
            />
          </div>
          <button
            type="submit"
            className="w-full p-3 bg-brand-orange text-white border-none rounded-lg font-semibold cursor-pointer flex justify-center items-center gap-1.5"
          >
            <LogIn size={18} /> Authenticate
          </button>
        </form>
      )}
    </div>
  );
}
