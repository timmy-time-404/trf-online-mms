import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDashboardStore } from '@/store';
import { TrendingUp } from 'lucide-react';

const WeeklyTravelChart: React.FC = () => {
  const { weeklyTravel } = useDashboardStore();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-600">{item.name}:</span>
              <span className="text-sm font-semibold text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate totals
  const totalTravelIn = weeklyTravel.reduce((sum, day) => sum + day.travelIn, 0);
  const totalTravelOut = weeklyTravel.reduce((sum, day) => sum + day.travelOut, 0);

  return (
    // Tambahkan w-full di sini agar Card selalu mencoba memenuhi ruang
    <Card className="w-full border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Weekly Travel</CardTitle>
            <p className="text-sm text-gray-500">Travel requests this week</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tinggi dinaikkan menjadi h-80 agar proporsional saat full-width */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyTravel} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="circle"
                formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
              />
              <Bar 
                dataKey="travelIn" 
                name="Travel In" 
                fill="#3B82F6" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar 
                dataKey="travelOut" 
                name="Travel Out" 
                fill="#10B981" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalTravelIn}</p>
            <p className="text-xs text-gray-500">Total Travel In</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{totalTravelOut}</p>
            <p className="text-xs text-gray-500">Total Travel Out</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyTravelChart;