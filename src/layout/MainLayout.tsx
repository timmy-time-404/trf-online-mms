import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Users,
  Building2,
  LogOut,
  Menu,
  User,
  ChevronDown,
  Shield,
  Briefcase,
  Crown,
  CheckCircle,
  Plane
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

const MainLayout: React.FC = () => {
  const { currentUser, logout, switchRole } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRoleChange = (role: UserRole) => {
    switchRole(role);
    // Reload page to refresh data based on new role
    window.location.reload();
  };

  // Navigation items with role-based access
  const getNavItems = () => {
    const items = [
      { 
        path: '/', 
        label: 'Dashboard', 
        icon: LayoutDashboard, 
        roles: ['EMPLOYEE', 'ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'] 
      },
      { 
        path: '/trf', 
        label: 'Travel Requests', 
        icon: FileText, 
        roles: ['EMPLOYEE', 'ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'] 
      },
      { 
        path: '/trf/new', 
        label: 'New TRF', 
        icon: FileText, 
        roles: ['EMPLOYEE', 'SUPER_ADMIN'] 
      },
      // Admin Dept - Verification
      { 
        path: '/verify', 
        label: 'Verify TRFs', 
        icon: CheckCircle, 
        roles: ['ADMIN_DEPT', 'SUPER_ADMIN'],
        badge: 'verify'
      },
      // HoD, HR, PM - Approvals
      { 
        path: '/approvals', 
        label: 'Approvals', 
        icon: CheckSquare, 
        roles: ['HOD', 'HR', 'PM', 'SUPER_ADMIN'],
        badge: 'approval'
      },
      // GA - Process
      { 
        path: '/process', 
        label: 'Process TRFs', 
        icon: Plane, 
        roles: ['GA', 'SUPER_ADMIN'],
        badge: 'process'
      },
      // HR - Employee Management
      { 
        path: '/employees', 
        label: 'Employees', 
        icon: Users, 
        roles: ['HR', 'SUPER_ADMIN'] 
      },
      // GA - Hotel Management
      { 
        path: '/hotels', 
        label: 'Hotels', 
        icon: Building2, 
        roles: ['GA', 'SUPER_ADMIN'] 
      },
      // Reports - All except Employee
      { 
        path: '/reports', 
        label: 'Reports', 
        icon: Briefcase, 
        roles: ['ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'] 
      },
      // Super Admin
      { 
        path: '/super-admin', 
        label: 'Super Admin', 
        icon: Crown, 
        roles: ['SUPER_ADMIN'] 
      },
    ];

    return items.filter(
      item => currentUser && item.roles.includes(currentUser.role)
    );
  };

  const navItems = getNavItems();

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'EMPLOYEE': return User;
      case 'ADMIN_DEPT': return CheckCircle;
      case 'HOD': return Briefcase;
      case 'HR': return Users;
      case 'PM': return Shield;
      case 'GA': return Building2;
      case 'SUPER_ADMIN': return Crown;
      default: return User;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'EMPLOYEE': return 'bg-blue-100 text-blue-700';
      case 'ADMIN_DEPT': return 'bg-purple-100 text-purple-700';
      case 'HOD': return 'bg-indigo-100 text-indigo-700';
      case 'HR': return 'bg-pink-100 text-pink-700';
      case 'PM': return 'bg-green-100 text-green-700';
      case 'GA': return 'bg-orange-100 text-orange-700';
      case 'SUPER_ADMIN': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleLabel = (role: UserRole): string => {
    const labels: Record<UserRole, string> = {
      'EMPLOYEE': 'Employee',
      'ADMIN_DEPT': 'Admin Dept',
      'HOD': 'Head of Dept',
      'HR': 'HR',
      'PM': 'Project Manager',
      'GA': 'GA',
      'SUPER_ADMIN': 'Super Admin'
    };
    return labels[role];
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-white border-r border-gray-200 transition-all duration-300 fixed h-full z-20',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">TRF</span>
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h1 className="font-semibold text-gray-900 text-sm whitespace-nowrap">TRF Online</h1>
                <p className="text-xs text-gray-500 whitespace-nowrap">Travel Request</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  !sidebarOpen && 'justify-center'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    {/* Badge indicator for action items */}
                    {(item.badge === 'verify' || item.badge === 'approval' || item.badge === 'process') && (
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className={cn('flex-1 transition-all duration-300', sidebarOpen ? 'ml-64' : 'ml-16')}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold text-gray-900">
              {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Role Switcher */}
            <Select value={currentUser?.role} onValueChange={(value) => handleRoleChange(value as UserRole)}>
              <SelectTrigger className={cn("w-44 h-9 text-sm border-2", getRoleColor(currentUser?.role as UserRole).replace('text-', 'border-').replace('bg-', 'bg-opacity-10 '))}>
                <div className="flex items-center gap-2">
                  {currentUser && React.createElement(getRoleIcon(currentUser.role as UserRole), {
                    className: "w-4 h-4"
                  })}
                  <span className="truncate">{currentUser ? getRoleLabel(currentUser.role as UserRole) : 'Select Role'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="ADMIN_DEPT">Admin Dept</SelectItem>
                <SelectItem value="HOD">Head of Dept</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="PM">Project Manager</SelectItem>
                <SelectItem value="GA">GA</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>

            {/* User Info */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", getRoleColor(currentUser?.role as UserRole))}>
                {currentUser && React.createElement(getRoleIcon(currentUser.role as UserRole), {
                  className: "w-4 h-4"
                })}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">{currentUser?.username}</p>
                <p className="text-xs text-gray-500">{getRoleLabel(currentUser?.role as UserRole)}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-600"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;