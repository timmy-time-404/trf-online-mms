import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTRFStore, useAuthStore } from '@/store';
import {
  Crown,
  Users,
  Building,
  Database,
  FileText,
  Settings,
  Trash2,
  Edit,
  Eye,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const SuperAdminPage: React.FC = () => {
  const { users, employees, trfs, resetStore } = useTRFStore();
  const { currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('users');

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all data to default? This cannot be undone.')) {
      // In real app, this would reset to initial state
      toast.success('Data reset successfully');
      window.location.reload();
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'EMPLOYEE': 'bg-blue-100 text-blue-700',
      'ADMIN_DEPT': 'bg-purple-100 text-purple-700',
      'HOD': 'bg-indigo-100 text-indigo-700',
      'HR': 'bg-pink-100 text-pink-700',
      'PM': 'bg-green-100 text-green-700',
      'GA': 'bg-orange-100 text-orange-700',
      'SUPER_ADMIN': 'bg-red-100 text-red-700'
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-6 h-6 text-red-600" />
            Super Admin Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Full system administration and control</p>
        </div>
        <Button
          variant="destructive"
          onClick={handleResetData}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reset All Data
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{users.length}</p>
                <p className="text-sm text-blue-700">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">{employees.length}</p>
                <p className="text-sm text-green-700">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-900">{trfs.length}</p>
                <p className="text-sm text-purple-700">Total TRFs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-900">7</p>
                <p className="text-sm text-orange-700">User Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="trfs">All TRFs</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Username</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{user.username}</td>
                        <td className="px-4 py-3 text-gray-600">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{user.department || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="w-5 h-5" />
                Employee Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Job Title</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">MCU Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{emp.employeeName}</td>
                        <td className="px-4 py-3">
                          <Badge variant={emp.employeeType === 'EMPLOYEE' ? 'default' : 'secondary'}>
                            {emp.employeeType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                        <td className="px-4 py-3 text-gray-600">{emp.jobTitle}</td>
                        <td className="px-4 py-3">
                          <Badge 
                            variant="outline"
                            className={
                              emp.mcuStatus === 'VALID' ? 'text-green-600 border-green-300' :
                              emp.mcuStatus === 'PENDING' ? 'text-amber-600 border-amber-300' :
                              'text-red-600 border-red-300'
                            }
                          >
                            {emp.mcuStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRFs Tab */}
        <TabsContent value="trfs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                All TRFs (Override View)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">TRF Number</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Employee</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {trfs.map((trf) => (
                      <tr key={trf.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{trf.trfNumber}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {trf.employee?.employeeName || trf.employeeId}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{trf.department}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {trf.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(trf.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Data Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Mock Data
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Export All Data
                </Button>
                <Button variant="destructive" className="w-full justify-start">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Data
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  System Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Current User</p>
                  <p className="text-sm text-gray-600">{currentUser?.username}</p>
                  <p className="text-xs text-gray-500">{currentUser?.role}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">System Version</p>
                  <p className="text-sm text-gray-600">TRF Online v2.0</p>
                  <p className="text-xs text-gray-500">With Parallel Approval</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuperAdminPage;