import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useDashboardStore } from '@/store';
import { Hotel } from 'lucide-react';

// Colors for the chart

const RoomAvailabilityChart: React.FC = () => {
  const { roomAvailability } = useDashboardStore();

  // Aggregate data across all hotels
  const aggregated = roomAvailability.reduce(
    (acc, hotel) => {
      acc.available += hotel.available;
      acc.occupied += hotel.occupied;
      acc.total += hotel.total;
      return acc;
    },
    { available: 0, occupied: 0, total: 0 }
  );

  const data = [
    { name: 'Available', value: aggregated.available, color: '#10B981' },
    { name: 'Occupied', value: aggregated.occupied, color: '#EF4444' }
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / aggregated.total) * 100).toFixed(1);
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-2xl font-bold" style={{ color: item.payload.color }}>
            {item.value}
          </p>
          <p className="text-sm text-gray-500">{percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Hotel className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Room Availability</CardTitle>
            <p className="text-sm text-gray-500">Total rooms across all hotels</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-sm text-gray-700">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{aggregated.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{aggregated.available}</p>
            <p className="text-xs text-gray-500">Available</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{aggregated.occupied}</p>
            <p className="text-xs text-gray-500">Occupied</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoomAvailabilityChart;
