import React, { useEffect } from 'react';
import {
  Clock,
  Plane,
  PlaneTakeoff,
  Users,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  useAuthStore,
  useDashboardStore,
  useTRFStore,
} from '@/store';

import RecentActivityTable from './components/RecentActivityTable';
import StatCard from './components/StatCard';
import WeeklyTravelChart from './components/WeeklyTravelChart';

const getScopeDescription = (
  role?: string,
  department?: string,
) => {
  switch (role) {
    case 'EMPLOYEE':
      return 'Menampilkan data Travel Request milik Anda.';

    case 'ADMIN_DEPT':
    case 'HOD':
      return department
        ? `Menampilkan data Department ${department}.`
        : 'Department akun belum ditentukan.';

    case 'HR':
    case 'PM':
    case 'GA':
    case 'SUPER_ADMIN':
      return 'Menampilkan data dari seluruh department.';

    default:
      return 'Ringkasan aktivitas Travel Request.';
  }
};

const DashboardPage: React.FC = () => {
  const currentUser = useAuthStore(
    (state) => state.currentUser,
  );

  const {
    stats,
    isLoadingStats,
    fetchDashboardStats,
    fetchWeeklyTravel,
  } = useDashboardStore();

  const fetchAllData = useTRFStore(
    (state) => state.fetchAllData,
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    /*
     * Dashboard statistics and weekly chart are fetched
     * using the current user's visibility scope.
     *
     * TRF data is also refreshed for Recent Activity.
     */
    void Promise.all([
      fetchDashboardStats(currentUser),
      fetchWeeklyTravel(currentUser),
      fetchAllData(),
    ]);
  }, [
    currentUser,
    fetchAllData,
    fetchDashboardStats,
    fetchWeeklyTravel,
  ]);

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-32 rounded-xl"
            />
          ))}
        </div>

        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-gray-500 sm:text-base">
          {getScopeDescription(
            currentUser.role,
            currentUser.department,
          )}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoadingStats ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <StatCard
            title="Total Travel In"
            value={stats.totalTravelIn}
            icon={Plane}
            description="Total Travel In yang telah selesai diproses"
            color="blue"
          />
        )}

        {isLoadingStats ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <StatCard
            title="Total Travel Out"
            value={stats.totalTravelOut}
            icon={PlaneTakeoff}
            description="Total Travel Out yang telah selesai diproses"
            color="green"
          />
        )}

        {isLoadingStats ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <StatCard
            title="On Site Active"
            value={stats.onSiteActive}
            icon={Users}
            description="Karyawan yang sedang aktif berada di site"
            color="purple"
          />
        )}

        {isLoadingStats ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <StatCard
            title="Days In Site"
            value={stats.daysInSite}
            icon={Clock}
            description="Total durasi perjalanan aktif di site"
            color="orange"
          />
        )}
      </div>

      {/* Weekly Travel Chart */}
      <div className="w-full">
        <WeeklyTravelChart />
      </div>

      {/* Recent Activity */}
      <RecentActivityTable user={currentUser} />
    </div>
  );
};

export default DashboardPage;