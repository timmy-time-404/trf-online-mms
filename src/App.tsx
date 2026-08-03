import React, {
  useEffect,
} from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { Toaster } from '@/components/ui/sonner';
import {
  APP_SESSION_INVALID_EVENT,
} from '@/lib/appSession';
import { useAuthStore, useTRFStore } from '@/store';
import type { UserRole } from '@/types';

// Layouts
import AuthLayout from '@/layout/AuthLayout';
import MainLayout from '@/layout/MainLayout';

// Pages
import LoginPage from '@/features/auth/LoginPage';
import ChangePasswordPage from '@/features/auth/ChangePasswordPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import TRFDetailPage from '@/features/trf/TRFDetailPage';
import TRFEditPage from '@/features/trf/TRFEditPage';
import TRFListPage from '@/features/trf/TRFListPage';
import TRFNewPage from '@/features/trf/TRFNewPage';
import EarlyRecallDetailPage from '@/features/early-recall/EarlyRecallDetailPage';
import EarlyRecallFormPage from '@/features/early-recall/EarlyRecallFormPage';
import EarlyRecallListPage from '@/features/early-recall/EarlyRecallListPage';

// Role-specific pages
import ApprovalPage from '@/features/approval/ApprovalPage';
import UsersPage from '@/features/admin/users/UsersPage';
import EmployeeManagementPage from './features/employees/EmployeeManagementPage';
import HotelManagementPage from './features/hotels/HotelManagementPage';
import ProcessPage from './features/process/ProcessPage';
import SuperAdminPage from './features/super-admin/SuperAdminPage';
import VerifyPage from './features/verify/VerifyPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireDepartment?: boolean;
}

const SessionLoadingScreen: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />

      <p className="mt-3 text-sm text-gray-500">
        Memvalidasi sesi...
      </p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<
  ProtectedRouteProps
> = ({
  children,
  allowedRoles,
  requireDepartment = false,
}) => {
  const location = useLocation();

  const currentUser = useAuthStore(
    (state) => state.currentUser,
  );

  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );

  const isLoading = useAuthStore(
    (state) => state.isLoading,
  );

  if (isLoading) {
    return <SessionLoadingScreen />;
  }

  if (
    !isAuthenticated ||
    !currentUser
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  /*
   * User dengan temporary password hanya boleh
   * mengakses halaman Change Password.
   */
  if (
    currentUser.mustChangePassword &&
    location.pathname !==
      '/change-password'
  ) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  /*
   * User yang sudah mengganti password tidak perlu
   * kembali membuka halaman Change Password.
   */
  if (
    !currentUser.mustChangePassword &&
    location.pathname ===
      '/change-password'
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(
      currentUser.role,
    )
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  /*
   * ADMIN_DEPT dan HOD wajib memiliki department.
   * SUPER_ADMIN dikecualikan karena memiliki akses global.
   */
  if (
    requireDepartment &&
    currentUser.role !==
      'SUPER_ADMIN'
  ) {
    const departmentRequired =
      currentUser.role ===
        'ADMIN_DEPT' ||
      currentUser.role === 'HOD';

    if (
      departmentRequired &&
      !currentUser.department
    ) {
      return (
        <Navigate
          to="/"
          replace
        />
      );
    }
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const fetchEmployees = useTRFStore(
    (state) => state.fetchEmployees,
  );

  const fetchTRFs = useTRFStore(
    (state) => state.fetchTRFs,
  );

  const fetchReferenceMaster =
    useTRFStore(
      (state) =>
        state.fetchReferenceMaster,
    );

  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );

  const isLoading = useAuthStore(
    (state) => state.isLoading,
  );

  const loadUserFromSession =
    useAuthStore(
      (state) =>
        state.loadUserFromSession,
    );

  const invalidateSession =
    useAuthStore(
      (state) =>
        state.invalidateSession,
    );

  /*
   * Satu handler pusat untuk seluruh authenticated Edge Function.
   * Ketika session invalid/revoked/expired, Zustand dan storage
   * dibersihkan sehingga ProtectedRoute mengarahkan ke Login.
   */
  useEffect(() => {
    const handleInvalidSession = () => {
      invalidateSession();
    };

    window.addEventListener(
      APP_SESSION_INVALID_EVENT,
      handleInvalidSession,
    );

    return () => {
      window.removeEventListener(
        APP_SESSION_INVALID_EVENT,
        handleInvalidSession,
      );
    };
  }, [invalidateSession]);

  /*
   * Saat website dibuka atau di-refresh, validasi
   * X-App-Session melalui Edge Function app-session.
   */
  useEffect(() => {
    void loadUserFromSession();
  }, [loadUserFromSession]);

  /*
   * Data aplikasi baru dimuat setelah session
   * selesai divalidasi dan user terautentikasi.
   */
  useEffect(() => {
    if (
      !isAuthenticated ||
      isLoading
    ) {
      return;
    }

    const loadData = async () => {
      await fetchReferenceMaster();
      await fetchEmployees();
      await fetchTRFs();
    };

    void loadData();
  }, [
    isAuthenticated,
    isLoading,
    fetchReferenceMaster,
    fetchEmployees,
    fetchTRFs,
  ]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        richColors
      />

      <Routes>
        {/* PUBLIC ROUTES */}
        <Route element={<AuthLayout />}>
          <Route
            path="/login"
            element={<LoginPage />}
          />
        </Route>

        {/* FORCE CHANGE PASSWORD — tanpa sidebar */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        {/* PROTECTED ROUTES — dengan MainLayout */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* DASHBOARD */}
          <Route
            path="/"
            element={<DashboardPage />}
          />

          {/* TRF ROUTES */}
          <Route
            path="/trf"
            element={<TRFListPage />}
          />

          <Route
            path="/trf/:id"
            element={<TRFDetailPage />}
          />

          <Route
            path="/trf/new"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'EMPLOYEE',
                  'SUPER_ADMIN',
                ]}
              >
                <TRFNewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/trf/:id/edit"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'EMPLOYEE',
                  'HR',
                  'GA',
                  'SUPER_ADMIN',
                ]}
              >
                <TRFEditPage />
              </ProtectedRoute>
            }
          />

          {/* EARLY RECALL */}
          <Route
            path="/early-recall"
            element={<EarlyRecallListPage />}
          />

          <Route
            path="/early-recall/new"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HOD',
                  'PM',
                  'SUPER_ADMIN',
                ]}
              >
                <EarlyRecallFormPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/early-recall/:id"
            element={<EarlyRecallDetailPage />}
          />

          <Route
            path="/early-recall/:id/edit"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HOD',
                  'PM',
                  'SUPER_ADMIN',
                ]}
              >
                <EarlyRecallFormPage />
              </ProtectedRoute>
            }
          />

          {/* ADMIN DEPARTMENT */}
          <Route
            path="/verify"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'ADMIN_DEPT',
                  'SUPER_ADMIN',
                ]}
                requireDepartment
              >
                <VerifyPage />
              </ProtectedRoute>
            }
          />

          {/* HOD, HR, PM */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HOD',
                  'HR',
                  'PM',
                  'SUPER_ADMIN',
                ]}
              >
                <ApprovalPage />
              </ProtectedRoute>
            }
          />

          {/* GENERAL AFFAIRS */}
          <Route
            path="/process"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'GA',
                  'SUPER_ADMIN',
                ]}
              >
                <ProcessPage />
              </ProtectedRoute>
            }
          />

          {/* EMPLOYEE MANAGEMENT */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HR',
                  'SUPER_ADMIN',
                ]}
              >
                <EmployeeManagementPage />
              </ProtectedRoute>
            }
          />

          {/* HOTEL MANAGEMENT */}
          <Route
            path="/hotels"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'GA',
                  'SUPER_ADMIN',
                ]}
              >
                <HotelManagementPage />
              </ProtectedRoute>
            }
          />

          {/* REPORTS */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'ADMIN_DEPT',
                  'HOD',
                  'HR',
                  'PM',
                  'GA',
                  'SUPER_ADMIN',
                ]}
              >
                <div className="p-8 text-center">
                  <h2 className="text-xl font-semibold">
                    Reports &amp; Analytics
                  </h2>

                  <p className="mt-2 text-gray-500">
                    Coming soon...
                  </p>
                </div>
              </ProtectedRoute>
            }
          />

          {/* USER MANAGEMENT */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                ]}
              >
                <UsersPage />
              </ProtectedRoute>
            }
          />

          {/* SUPER ADMIN */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                ]}
              >
                <SuperAdminPage />
              </ProtectedRoute>
            }
          />

          {/* SETTINGS */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'SUPER_ADMIN',
                ]}
              >
                <div className="p-8 text-center">
                  <h2 className="text-xl font-semibold">
                    System Settings
                  </h2>

                  <p className="mt-2 text-gray-500">
                    Coming soon...
                  </p>
                </div>
              </ProtectedRoute>
            }
          />
        </Route>

        {/* FALLBACK */}
        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
