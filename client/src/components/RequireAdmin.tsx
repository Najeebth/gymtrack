import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAppData } from '../context/AppDataContext';

// Route guard for admin-only pages (traffic/health/map): redirects to the
// admin login screen unless the logged-in account's role is ADMIN.
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAppData();
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
