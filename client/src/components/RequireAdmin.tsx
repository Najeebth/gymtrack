import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAppData } from '../context/AppDataContext';

// Route guard for admin-only pages (traffic/health/map): redirects to the
// admin login screen whenever there's no adminToken, mirroring the previous
// `{adminToken && (...)}` sidebar gating.
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { adminToken } = useAppData();
  if (!adminToken) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
