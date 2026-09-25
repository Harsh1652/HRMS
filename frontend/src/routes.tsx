import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './App';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { MyProfilePage } from './pages/MyProfile';
import { EmployeeListPage } from './pages/EmployeeList';
import { EmployeeDetailPage } from './pages/EmployeeDetail';
import { EmployeeFormPage } from './pages/EmployeeForm';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'me', element: <MyProfilePage /> },
          {
            element: <ProtectedRoute roles={['ADMIN', 'MANAGER']} />,
            children: [
              { path: 'employees', element: <EmployeeListPage /> },
              { path: 'employees/:id', element: <EmployeeDetailPage /> },
              { path: 'employees/:id/edit', element: <EmployeeFormPage /> },
            ],
          },
          {
            element: <ProtectedRoute roles={['ADMIN']} />,
            children: [{ path: 'employees/new', element: <EmployeeFormPage /> }],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
