import { useLayoutEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BrandMark from './components/BrandMark';

// Standalone frame for the login screens: no sidebar or app navbar, since
// nobody here is inside the app yet. Styled to match the landing page.
export default function AuthLayout() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.style.backgroundColor = '#0F172A';
    return () => {
      html.style.backgroundColor = '';
    };
  }, []);

  return (
    <div className="min-h-screen bg-brand-navy text-white font-sans flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 md:px-12 h-20 shrink-0">
        <Link to="/">
          <BrandMark />
        </Link>
        <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Back to home
        </Link>
      </header>

      <main className="flex-1 flex justify-center px-6 pt-6 pb-20 md:pt-12">
        <div className="relative w-full max-w-[420px]">
          <div className="absolute -inset-24 pointer-events-none bg-[radial-gradient(closest-side,rgba(249,115,22,0.16),transparent)]" />
          <div className="relative">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
