import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import { ToastProvider } from './context/ToastContext';
import ToastStack from './components/ToastStack';
import RequireAdmin from './components/RequireAdmin';
import RequireAuth from './components/RequireAuth';
import AppShell from './AppShell';
import AuthLayout from './AuthLayout';
import LandingPage from './pages/LandingPage';
import WorkoutsPage from './pages/WorkoutsPage';
import ByDatePage from './pages/ByDatePage';
import ProgressPage from './pages/ProgressPage';
import TemplatesPage from './pages/TemplatesPage';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';
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
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route element={<AppShell />}>
              <Route
                path="/workouts"
                element={
                  <RequireAuth>
                    <WorkoutsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/by-date"
                element={
                  <RequireAuth>
                    <ByDatePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/progress"
                element={
                  <RequireAuth>
                    <ProgressPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/templates"
                element={
                  <RequireAuth>
                    <TemplatesPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/users"
                element={
                  <RequireAdmin>
                    <UsersPage />
                  </RequireAdmin>
                }
              />
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
