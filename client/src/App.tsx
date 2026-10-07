import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import RequireAdmin from './components/RequireAdmin';
import WorkoutsPage from './pages/WorkoutsPage';
import ByDatePage from './pages/ByDatePage';
import ProgressPage from './pages/ProgressPage';
import AdminPage from './pages/AdminPage';
import TrafficPage from './pages/TrafficPage';
import HealthPage from './pages/HealthPage';
import MapPage from './pages/MapPage';

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <div className="flex flex-col h-screen bg-brand-bg text-brand-navy font-sans">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-full mx-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/workouts" replace />} />
                  <Route path="/workouts" element={<WorkoutsPage />} />
                  <Route path="/by-date" element={<ByDatePage />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route
                    path="/traffic"
                    element={
                      <RequireAdmin>
                        <TrafficPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/health"
                    element={
                      <RequireAdmin>
                        <HealthPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/map"
                    element={
                      <RequireAdmin>
                        <MapPage />
                      </RequireAdmin>
                    }
                  />
                  <Route path="*" element={<Navigate to="/workouts" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </AppDataProvider>
  );
}
