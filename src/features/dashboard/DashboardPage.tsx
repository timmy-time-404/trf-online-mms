import React from 'react';
import { useDashboardStore } from '@/store';
import StatCard from './components/StatCard';
// import RoomAvailabilityChart from './components/RoomAvailabilityChart';
import WeeklyTravelChart from './components/WeeklyTravelChart';
import RecentActivityTable from './components/RecentActivityTable';
import { Plane, PlaneTakeoff,Users } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { stats } = useDashboardStore();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of travel request activities</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Travel In"
          value={stats.totalTravelIn}
          icon={Plane}
          description="All time travel in requests"
          color="blue"
        />
        <StatCard
          title="Total Travel Out"
          value={stats.totalTravelOut}
          icon={PlaneTakeoff}
          description="All time travel out requests"
          color="green"
        />
        <StatCard
          title="On Site Active"
          value={stats.onSiteActive}
          icon={Users}
          description="Currently on site"
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="w-full">
        {/* <RoomAvailabilityChart /> */}
        <WeeklyTravelChart />
      </div>

      {/* Recent Activity */}
      <RecentActivityTable />
    </div>
  );
};

export default DashboardPage;
