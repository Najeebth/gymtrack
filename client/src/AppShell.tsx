import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWidget from './components/chat/ChatWidget';
import { useAppData } from './context/AppDataContext';

// The authenticated app's chrome (navbar + sidebar + chat assistant). Rendered
// around every page except the public landing page at "/" — see App.tsx.
export default function AppShell() {
  const { authToken } = useAppData();

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-brand-navy font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {/* Extra bottom padding so the last card can scroll clear of the chat launcher */}
        <main className="flex-1 p-8 pb-28 overflow-y-auto">
          <div className="max-w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      {authToken && <ChatWidget />}
    </div>
  );
}
