import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { authService } from '../services/authService';

interface Props {
  requireAdmin?: boolean;
  children: ReactNode;
}

export default function RequireAuth({ requireAdmin = false, children }: Props) {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/" replace />;
  if (!requireAdmin && user.role === 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
