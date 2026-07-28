import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Briefcase,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  Crown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plane,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import NotificationBell from '@/components/common/NotificationBell';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';
import type { UserRole } from '@/types';

type NavigationBadge = 'verify' | 'approval' | 'process';

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: NavigationBadge;
}

const ALL_ROLES: UserRole[] = [
  'EMPLOYEE',
  'ADMIN_DEPT',
  'HOD',
  'HR',
  'PM',
  'GA',
  'SUPER_ADMIN',
];

const MainLayout: React.FC = () => {
  const { currentUser, logout, switchRole } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [desktopSidebarOpen, setDesktopSidebarOpen] =
    React.useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] =
    React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRoleChange = (role: UserRole) => {
    switchRole(role);
    window.location.reload();
  };

  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!mobileSidebarOpen) {
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileSidebarOpen]);

  const getNavItems = (): NavigationItem[] => {
    const items: NavigationItem[] = [
      {
        path: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ALL_ROLES,
      },
      {
        path: '/trf',
        label: 'Travel Requests',
        icon: FileText,
        roles: ALL_ROLES,
      },
      {
        path: '/trf/new',
        label: 'New TRF',
        icon: FileText,
        roles: ['EMPLOYEE', 'SUPER_ADMIN'],
      },
      {
        path: '/verify',
        label: 'Verify TRFs',
        icon: CheckCircle,
        roles: ['ADMIN_DEPT', 'SUPER_ADMIN'],
        badge: 'verify',
      },
      {
        path: '/approvals',
        label: 'Approvals',
        icon: CheckSquare,
        roles: ['HOD', 'HR', 'PM', 'SUPER_ADMIN'],
        badge: 'approval',
      },
      {
        path: '/process',
        label: 'Process TRFs',
        icon: Plane,
        roles: ['GA', 'SUPER_ADMIN'],
        badge: 'process',
      },
      {
        path: '/employees',
        label: 'Employees',
        icon: Users,
        roles: ['HR', 'SUPER_ADMIN'],
      },
      {
        path: '/hotels',
        label: 'Hotels',
        icon: Building2,
        roles: ['GA', 'SUPER_ADMIN'],
      },
      {
        path: '/reports',
        label: 'Reports',
        icon: Briefcase,
        roles: [
          'ADMIN_DEPT',
          'HOD',
          'HR',
          'PM',
          'GA',
          'SUPER_ADMIN',
        ],
      },
      {
        path: '/admin/users',
        label: 'User Management',
        icon: UserPlus,
        roles: ['SUPER_ADMIN'],
      },
      {
        path: '/super-admin',
        label: 'Super Admin',
        icon: Crown,
        roles: ['SUPER_ADMIN'],
      },
    ];

    if (!currentUser) {
      return [];
    }

    return items.filter((item) =>
      item.roles.includes(currentUser.role as UserRole),
    );
  };

  const navItems = getNavItems();

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'EMPLOYEE':
        return User;
      case 'ADMIN_DEPT':
        return CheckCircle;
      case 'HOD':
        return Briefcase;
      case 'HR':
        return Users;
      case 'PM':
        return Shield;
      case 'GA':
        return Building2;
      case 'SUPER_ADMIN':
        return Crown;
      default:
        return User;
    }
  };

  const getRoleColor = (role?: UserRole) => {
    switch (role) {
      case 'EMPLOYEE':
        return 'bg-blue-100 text-blue-700';
      case 'ADMIN_DEPT':
        return 'bg-purple-100 text-purple-700';
      case 'HOD':
        return 'bg-indigo-100 text-indigo-700';
      case 'HR':
        return 'bg-pink-100 text-pink-700';
      case 'PM':
        return 'bg-green-100 text-green-700';
      case 'GA':
        return 'bg-orange-100 text-orange-700';
      case 'SUPER_ADMIN':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleBorderColor = (role?: UserRole) => {
    switch (role) {
      case 'EMPLOYEE':
        return 'border-blue-200 bg-blue-50/50';
      case 'ADMIN_DEPT':
        return 'border-purple-200 bg-purple-50/50';
      case 'HOD':
        return 'border-indigo-200 bg-indigo-50/50';
      case 'HR':
        return 'border-pink-200 bg-pink-50/50';
      case 'PM':
        return 'border-green-200 bg-green-50/50';
      case 'GA':
        return 'border-orange-200 bg-orange-50/50';
      case 'SUPER_ADMIN':
        return 'border-red-200 bg-red-50/50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getRoleLabel = (role?: UserRole): string => {
    const labels: Partial<Record<UserRole, string>> = {
      EMPLOYEE: 'Employee',
      ADMIN_DEPT: 'Admin Dept',
      HOD: 'Head of Dept',
      HR: 'HR',
      PM: 'Project Manager',
      GA: 'GA',
      SUPER_ADMIN: 'Super Admin',
    };

    return role ? labels[role] ?? role : 'Select Role';
  };

  const isNavItemActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }

    if (path === '/trf') {
      return (
        location.pathname === '/trf' ||
        (location.pathname.startsWith('/trf/') &&
          location.pathname !== '/trf/new')
      );
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  };

  const sortedNavItems = [...navItems].sort(
    (first, second) => second.path.length - first.path.length,
  );

  const currentPageTitle =
    sortedNavItems.find((item) => isNavItemActive(item.path))
      ?.label ?? 'Dashboard';

  const CurrentRoleIcon = getRoleIcon(
    currentUser?.role as UserRole | undefined,
  );

  const renderRoleSwitcher = (triggerClassName?: string) => (
    <Select
      value={currentUser?.role}
      onValueChange={(value) =>
        handleRoleChange(value as UserRole)
      }
    >
      <SelectTrigger
        className={cn(
          'h-10 w-full border-2 text-sm',
          getRoleBorderColor(
            currentUser?.role as UserRole | undefined,
          ),
          triggerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CurrentRoleIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {getRoleLabel(
              currentUser?.role as UserRole | undefined,
            )}
          </span>
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
  );

  const renderNavigation = (
    expanded: boolean,
    mobile = false,
  ) => (
    <nav
      className={cn(
        'space-y-1 overflow-y-auto p-3',
        mobile ? 'flex-1' : 'max-h-[calc(100vh-4rem)]',
      )}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(item.path);

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => {
              if (mobile) {
                setMobileSidebarOpen(false);
              }
            }}
            className={cn(
              'relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              !expanded && 'justify-center px-2',
            )}
            title={!expanded ? item.label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" />

            {expanded && (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.label}
                </span>

                {item.badge && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                    aria-label="Action required"
                  />
                )}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,86vw)] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 lg:hidden',
          mobileSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full',
        )}
        aria-hidden={!mobileSidebarOpen}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-sm font-bold text-white">
                TRF
              </span>
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-gray-900">
                TRF Online
              </h1>
              <p className="truncate text-xs text-gray-500">
                Travel Request
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(false)}
            className="shrink-0 text-gray-500"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {renderNavigation(true, true)}

        <div className="shrink-0 space-y-3 border-t border-gray-200 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                getRoleColor(
                  currentUser?.role as UserRole | undefined,
                ),
              )}
            >
              <CurrentRoleIcon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {currentUser?.username ?? 'User'}
              </p>
              <p className="truncate text-xs text-gray-500">
                {getRoleLabel(
                  currentUser?.role as UserRole | undefined,
                )}
              </p>
            </div>
          </div>

          {renderRoleSwitcher()}

          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="w-full justify-start gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-gray-200 bg-white transition-[width] duration-300 lg:flex',
          desktopSidebarOpen ? 'w-64' : 'w-20',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-gray-200',
            desktopSidebarOpen
              ? 'px-4'
              : 'justify-center px-2',
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-sm font-bold text-white">
                TRF
              </span>
            </div>

            {desktopSidebarOpen && (
              <div className="min-w-0 overflow-hidden">
                <h1 className="whitespace-nowrap text-sm font-semibold text-gray-900">
                  TRF Online
                </h1>
                <p className="whitespace-nowrap text-xs text-gray-500">
                  Travel Request
                </p>
              </div>
            )}
          </div>
        </div>

        {renderNavigation(desktopSidebarOpen)}
      </aside>

      {/* Main content */}
      <div
        className={cn(
          'min-h-screen transition-[margin] duration-300',
          desktopSidebarOpen ? 'lg:ml-64' : 'lg:ml-20',
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-gray-200 bg-white/95 px-3 backdrop-blur sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileSidebarOpen(true)}
              className="shrink-0 text-gray-500 lg:hidden"
              aria-label="Buka menu"
              aria-expanded={mobileSidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setDesktopSidebarOpen((previous) => !previous)
              }
              className="hidden shrink-0 text-gray-500 lg:inline-flex"
              aria-label={
                desktopSidebarOpen
                  ? 'Perkecil sidebar'
                  : 'Perbesar sidebar'
              }
              aria-expanded={desktopSidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <h2 className="max-w-[10rem] truncate text-base font-semibold text-gray-900 sm:max-w-xs sm:text-lg md:max-w-md">
              {currentPageTitle}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
            <NotificationBell />

            <div className="hidden xl:block">
              {renderRoleSwitcher('w-44')}
            </div>

            <div className="hidden items-center gap-3 border-l border-gray-200 pl-3 md:flex">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  getRoleColor(
                    currentUser?.role as UserRole | undefined,
                  ),
                )}
              >
                <CurrentRoleIcon className="h-4 w-4" />
              </div>

              <div className="hidden min-w-0 lg:block">
                <p className="max-w-32 truncate text-sm font-medium text-gray-900">
                  {currentUser?.username}
                </p>
                <p className="max-w-32 truncate text-xs text-gray-500">
                  {getRoleLabel(
                    currentUser?.role as UserRole | undefined,
                  )}
                </p>
              </div>

              <ChevronDown className="hidden h-4 w-4 shrink-0 text-gray-400 lg:block" />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="shrink-0 text-gray-500 hover:text-red-600"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;