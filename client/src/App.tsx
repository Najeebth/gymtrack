import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import { ToastProvider } from './context/ToastContext';
import ToastStack from './components/ToastStack';
import RequireAdmin from './components/RequireAdmin';
import AppShell from './AppShell';
import LandingPage from './pages/LandingPage';
import WorkoutsPage from './pages/WorkoutsPage';
import ByDatePage from './pages/ByDatePage';
import ProgressPage from './pages/ProgressPage';
import AdminPage from './pages/AdminPage';
import TrafficPage from './pages/TrafficPage';
import HealthPage from './pages/HealthPage';
import MapPage from './pages/MapPage';

export default function App() {
  return (
    <ToastProvider>
      <AppDataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<AppShell />}>
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
            </Route>
          </Routes>
          <ToastStack />
        </BrowserRouter>
      </AppDataProvider>
    </ToastProvider>
  );
}
