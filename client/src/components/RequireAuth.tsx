import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAppData } from '../context/AppDataContext';

// Route guard for the main workout pages (workouts/by-date/progress):
// redirects to the member login/signup screen when no one is logged in.
// Any role (member or admin) satisfies this gate — it's RequireAdmin that
// additionally checks role.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { authToken } = useAppData();
  if (!authToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
