import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWidget from './components/chat/ChatWidget';
import { useAppData } from './context/AppDataContext';

// The authenticated app's chrome (navbar + sidebar + chat assistant). Rendered
// around every page except the public landing page at "/" — see App.tsx.
export default function AppShell() {
  const { authToken } = useAppData();
  // Mobile navigation drawer (the sidebar is a static column from md up)
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-brand-navy font-sans">
      <Header onMenuClick={() => setNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={navOpen} onClose={closeNav} />
        {/* Extra bottom padding so the last card can scroll clear of the chat launcher */}
        <main className="flex-1 min-w-0 p-4 md:p-8 pb-28 md:pb-28 overflow-y-auto">
          <div className="max-w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      {authToken && <ChatWidget />}
    </div>
  );
}
