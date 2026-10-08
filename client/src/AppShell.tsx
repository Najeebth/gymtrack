import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';

// The authenticated app's chrome (navbar + sidebar). Rendered around every
// page except the public landing page at "/" — see App.tsx.
export default function AppShell() {
  return (
    <div className="flex flex-col h-screen bg-brand-bg text-brand-navy font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
