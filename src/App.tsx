import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useTRFStore, useAuthStore } from '@/store';

// Layouts
import MainLayout from '@/layout/MainLayout';
import AuthLayout from '@/layout/AuthLayout';

// Pages
import LoginPage from '@/features/auth/LoginPage';
import ChangePasswordPage from '@/features/auth/ChangePasswordPage'; 
import DashboardPage from '@/features/dashboard/DashboardPage';
import TRFListPage from '@/features/trf/TRFListPage';
import TRFNewPage from '@/features/trf/TRFNewPage';
import TRFDetailPage from '@/features/trf/TRFDetailPage';

// Role-specific pages
import VerifyPage from './features/verify/VerifyPage';           // Admin Dept
import ApprovalPage from '@/features/approval/ApprovalPage';     // HoD, HR, PM
import ProcessPage from './features/process/ProcessPage';        // GA
import SuperAdminPage from './features/super-admin/SuperAdminPage'; // Super Admin

// Placeholder for management pages
import EmployeeManagementPage from './features/employees/EmployeeManagementPage'; // HR
import HotelManagementPage from './features/hotels/HotelManagementPage';       // GA
import UsersPage from '@/features/admin/users/UsersPage';

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireDepartment?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  requireDepartment = false
}) => {
  const { isAuthenticated, currentUser } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check allowed roles
  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  // Check department requirement for ADMIN_DEPT and HOD
  if (requireDepartment && currentUser?.role !== 'SUPER_ADMIN') {
    if ((currentUser?.role === 'ADMIN_DEPT' || currentUser?.role === 'HOD') && !currentUser?.department) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

function App() {
  // ✅ Added fetchReferenceMaster
  const { fetchEmployees, fetchTRFs, fetchReferenceMaster } = useTRFStore();
  const { isAuthenticated, isLoading } = useAuthStore();

  // Fetch data from Supabase when authenticated
  useEffect(() => {
    const loadData = async () => {
      await fetchReferenceMaster(); // ⭐ LOAD MASTER DULU
      await fetchEmployees();
      await fetchTRFs();      
    };

    if (isAuthenticated && !isLoading) {
      loadData();
    }
  }, [isAuthenticated, isLoading, fetchReferenceMaster, fetchEmployees, fetchTRFs]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* FORCE CHANGE PASSWORD (No Sidebar/MainLayout) */}
        <Route 
          path="/change-password" 
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          } 
        />

        {/* PROTECTED ROUTES (With MainLayout & Sidebar) */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          {/* DASHBOARD - All authenticated users */}
          <Route path="/" element={<DashboardPage />} />

          {/* TRF ROUTES */}
          <Route path="/trf" element={<TRFListPage />} />
          <Route path="/trf/:id" element={<TRFDetailPage />} />
          
          <Route
            path="/trf/new"
            element={
              <ProtectedRoute allowedRoles={['EMPLOYEE', 'SUPER_ADMIN']}>
                <TRFNewPage />
              </ProtectedRoute>
            }
          />

          {/* ADMIN DEPT - Verification */}
          <Route
            path="/verify"
            element={
              <ProtectedRoute allowedRoles={['ADMIN_DEPT', 'SUPER_ADMIN']} requireDepartment>
                <VerifyPage />
              </ProtectedRoute>
            }
          />

          {/* APPROVAL ROUTES - HoD, HR, PM */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute allowedRoles={['HOD', 'HR', 'PM', 'SUPER_ADMIN']}>
                <ApprovalPage />
              </ProtectedRoute>
            }
          />

          {/* GA PROCESS ROUTE */}
          <Route
            path="/process"
            element={
              <ProtectedRoute allowedRoles={['GA', 'SUPER_ADMIN']}>
                <ProcessPage />
              </ProtectedRoute>
            }
          />

          {/* EMPLOYEE MANAGEMENT - HR only */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['HR', 'SUPER_ADMIN']}>
                <EmployeeManagementPage />
              </ProtectedRoute>
            }
          />

          {/* HOTEL MANAGEMENT - GA only */}
          <Route
            path="/hotels"
            element={
              <ProtectedRoute allowedRoles={['GA', 'SUPER_ADMIN']}>
                <HotelManagementPage />
              </ProtectedRoute>
            }
          />

          {/* REPORTS - All except Employee */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN']}>
                <div className="p-8 text-center">
                  <h2 className="text-xl font-semibold">Reports & Analytics</h2>
                  <p className="text-gray-500 mt-2">Coming soon...</p>
                </div>
              </ProtectedRoute>
            }
          />

          {/* USER MANAGEMENT - Super Admin only */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          {/* SUPER ADMIN - Full Access */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <SuperAdminPage />
              </ProtectedRoute>
            }
          />

          {/* SETTINGS - Super Admin only */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <div className="p-8 text-center">
                  <h2 className="text-xl font-semibold">System Settings</h2>
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