import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/store';

// Layouts
import MainLayout from '@/layout/MainLayout';
import AuthLayout from '@/layout/AuthLayout';

// Pages
import LoginPage from '@/features/auth/LoginPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import TRFListPage from '@/features/trf/TRFListPage';
import TRFNewPage from '@/features/trf/TRFNewPage';
import TRFDetailPage from '@/features/trf/TRFDetailPage';
import ApprovalPage from '@/features/approval/ApprovalPage';

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, currentUser } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* Public Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected Routes */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          {/* Dashboard - All roles */}
          <Route path="/" element={<DashboardPage />} />

          {/* TRF Routes */}
          <Route path="/trf" element={<TRFListPage />} />
          <Route
            path="/trf/new"
            element={
              <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                <TRFNewPage />
              </ProtectedRoute>
            }
          />
          <Route path="/trf/:id" element={<TRFDetailPage />} />

          {/* Approval Routes - Approver only */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute allowedRoles={['APPROVER']}>
                <ApprovalPage />
              </ProtectedRoute>
            }
          />

          {/* Placeholder routes for HR and GA */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['HR', 'GA']}>
                <div className="p-8 text-center">
                  <h2 className="text-xl font-semibold">Employee Management</h2>
                  <p className="text-gray-500 mt-2">Coming soon...</p>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hotels"
            element={
              <ProtectedRoute allowedRoles={['GA']}>
                <div className="p-8 text-center">
                  <h2 className="text-xl font-semibold">Hotel Management</h2>
                  <p className="text-gray-500 mt-2">Coming soon...</p>
                </div>
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
