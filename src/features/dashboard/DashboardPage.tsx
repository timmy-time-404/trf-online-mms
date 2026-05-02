import React, { useEffect } from 'react';
import { useDashboardStore } from '@/store';
import StatCard from './components/StatCard';
import WeeklyTravelChart from './components/WeeklyTravelChart';
import RecentActivityTable from './components/RecentActivityTable';
import { Plane, PlaneTakeoff, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardPage: React.FC = () => {
  const { stats, isLoadingStats, fetchDashboardStats, fetchWeeklyTravel } = useDashboardStore();

  useEffect(() => {
    fetchDashboardStats();
    fetchWeeklyTravel();
  }, [fetchDashboardStats, fetchWeeklyTravel]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of travel request activities</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">

        {isLoadingStats ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <StatCard
            title="Total Travel In"
            value={stats.totalTravelIn}
            icon={Plane}
            description="All time approved travel in"
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
            description="All time approved travel out"
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
            description="Employees currently on site today"
            color="purple"
          />
        )}

      </div>

      {/* Weekly Travel Chart */}
      <div className="w-full">
        <WeeklyTravelChart />
      </div>

      {/* Recent Activity */}
      <RecentActivityTable />
    </div>
  );
};

export default DashboardPage;