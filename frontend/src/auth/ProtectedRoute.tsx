import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Spinner } from '../components/Spinner';
import type { Role } from '../types/api';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
