import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '@/components/common/StatusBadge';
import { useTRFStore } from '@/store';
import { AlertTriangle, Building, Crown, FileText, Users } from 'lucide-react';

const ROLE_BADGE: Record<string, string> = {
  EMPLOYEE: 'bg-blue-100 text-blue-700',
  ADMIN_DEPT: 'bg-purple-100 text-purple-700',
  HOD: 'bg-indigo-100 text-indigo-700',
  HR: 'bg-pink-100 text-pink-700',
  PM: 'bg-green-100 text-green-700',
  GA: 'bg-orange-100 text-orange-700',
  SUPER_ADMIN: 'bg-red-100 text-red-700',
};

// Full class names so Tailwind keeps them in the build.
const TONE = {
  blue: { card: 'bg-blue-50 border-blue-200', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-900', label: 'text-blue-700' },
  green: { card: 'bg-green-50 border-green-200', icon: 'bg-green-100 text-green-600', text: 'text-green-900', label: 'text-green-700' },
  purple: { card: 'bg-purple-50 border-purple-200', icon: 'bg-purple-100 text-purple-600', text: 'text-purple-900', label: 'text-purple-700' },
  red: { card: 'bg-red-50 border-red-200', icon: 'bg-red-100 text-red-600', text: 'text-red-900', label: 'text-red-700' },
  gray: { card: 'bg-gray-50 border-gray-200', icon: 'bg-gray-100 text-gray-600', text: 'text-gray-900', label: 'text-gray-700' },
} as const;

/** Read-only system overview. Changes happen on the dedicated pages linked from here. */
const SuperAdminPage: React.FC = () => {
  const { users, employees, trfs, fetchUsers } = useTRFStore();
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const activeUsers = users.filter((u) => u.is_active !== false).length;
  const held = trfs.filter((t) => t.blockedBy);

  const stats = [
    { label: 'User aktif', value: `${activeUsers} / ${users.length}`, icon: Users, tone: TONE.blue },
    { label: 'Karyawan', value: employees.length, icon: Building, tone: TONE.green },
    { label: 'Total TRF', value: trfs.length, icon: FileText, tone: TONE.purple },
    { label: 'TRF tertahan', value: held.length, icon: AlertTriangle, tone: held.length ? TONE.red : TONE.gray },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-6 h-6 text-red-600" />
            Super Admin
          </h1>
          <p className="text-gray-500 mt-1">Ringkasan sistem. Pengelolaan dilakukan di halaman masing-masing.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/admin/users">Kelola User</Link></Button>
          <Button asChild variant="outline"><Link to="/employees">Kelola Karyawan</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className={tone.card}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone.icon}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-2xl font-bold tabular-nums ${tone.text}`}>{value}</p>
                <p className={`text-sm ${tone.label}`}>{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">User</TabsTrigger>
          <TabsTrigger value="trfs">Semua TRF</TabsTrigger>
          <TabsTrigger value="held">Tertahan ({held.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle className="text-lg">User</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Username</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Peran</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 font-medium">{user.username}</td>
                      <td className="px-4 py-3"><Badge className={ROLE_BADGE[user.role] ?? ''}>{user.role}</Badge></td>
                      <td className="px-4 py-3 text-gray-600">{user.department || '-'}</td>
                      <td className="px-4 py-3">{user.is_active === false ? <Badge variant="secondary">Nonaktif</Badge> : <Badge variant="outline">Aktif</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {(['trfs', 'held'] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{tab === 'held' ? 'TRF tertahan (approver belum tersedia)' : 'Semua TRF'}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Nomor TRF</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Karyawan</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                      {tab === 'held' && <th className="px-4 py-3 text-left font-medium text-gray-700">Menunggu</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(tab === 'held' ? held : trfs).map((trf) => (
                      <tr key={trf.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium"><Link className="text-blue-700 hover:underline" to={`/trf/${trf.id}`}>{trf.trfNumber}</Link></td>
                        <td className="px-4 py-3 text-gray-600">{trf.employee?.employeeName || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{trf.department}</td>
                        <td className="px-4 py-3"><StatusBadge status={trf.status} /></td>
                        {tab === 'held' && <td className="px-4 py-3 text-red-700">{trf.blockedBy}</td>}
                      </tr>
                    ))}
                    {(tab === 'held' ? held : trfs).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Tidak ada data.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SuperAdminPage;
