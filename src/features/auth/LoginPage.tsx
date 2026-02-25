import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store';
import { mockUsers } from '@/mock/data';
import type { UserRole } from '@/types';
import { 
  User, 
  Users, 
  Shield, 
  Building2, 
  ArrowRight, 
  CheckSquare,
  Briefcase,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState<UserRole>('EMPLOYEE');

  const handleLogin = () => {
    // Find user by role
    const user = mockUsers.find(u => u.role === selectedRole);

    if (user) {
      login(user);
      toast.success(`Logged in as ${getRoleLabel(selectedRole)}`);
      navigate('/');
    } else {
      toast.error('User not found for this role');
    }
  };

  const getRoleLabel = (role: UserRole): string => {
    const labels: Record<UserRole, string> = {
      'EMPLOYEE': 'Employee',
      'ADMIN_DEPT': 'Admin Dept',
      'HOD': 'Head of Department',
      'HR': 'HR',
      'PM': 'Project Manager',
      'GA': 'General Affairs',
      'SUPER_ADMIN': 'Super Admin'
    };
    return labels[role];
  };

  const roleConfig: Record<UserRole, { 
    icon: any; 
    title: string; 
    description: string;
    color: string;
    bgColor: string;
  }> = {
    EMPLOYEE: {
      icon: User,
      title: 'Employee',
      description: 'Create and manage your travel requests',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    ADMIN_DEPT: {
      icon: CheckSquare,
      title: 'Admin Dept',
      description: 'Verify TRFs for compliance',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    HOD: {
      icon: Briefcase,
      title: 'Head of Dept',
      description: 'Approve TRFs for your department',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    HR: {
      icon: Users,
      title: 'HR',
      description: 'Approve TRFs & manage employees',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50'
    },
    PM: {
      icon: Shield,
      title: 'Project Manager',
      description: 'Final approval for all TRFs',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    GA: {
      icon: Building2,
      title: 'GA',
      description: 'Process TRFs & manage hotels',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    SUPER_ADMIN: {
      icon: Crown,
      title: 'Super Admin',
      description: 'Full system access',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  };

  return (
    <Card className="w-full shadow-lg max-w-2xl">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl">Select Your Role</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Choose a role to simulate different user views
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(Object.keys(roleConfig) as UserRole[]).map((role) => {
            const config = roleConfig[role];
            const Icon = config.icon;
            const isSelected = selectedRole === role;

            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${config.bgColor}`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{config.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{config.description}</p>
              </button>
            );
          })}
        </div>

        {/* Role Selector Dropdown */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Or select from dropdown:</label>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPLOYEE">Employee - Create TRF</SelectItem>
              <SelectItem value="ADMIN_DEPT">Admin Dept - Verify TRFs</SelectItem>
              <SelectItem value="HOD">Head of Department - Approve Dept TRFs</SelectItem>
              <SelectItem value="HR">HR - Approve All & Manage Employees</SelectItem>
              <SelectItem value="PM">Project Manager - Final Approval</SelectItem>
              <SelectItem value="GA">GA - Process & Manage Hotels</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin - Full Access</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selected Role Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {React.createElement(roleConfig[selectedRole].icon, {
              className: `w-5 h-5 ${roleConfig[selectedRole].color}`
            })}
            <div>
              <p className="font-medium text-gray-900">{roleConfig[selectedRole].title}</p>
              <p className="text-sm text-gray-500">{roleConfig[selectedRole].description}</p>
            </div>
          </div>
        </div>

        {/* Login Button */}
        <Button
          onClick={handleLogin}
          className="w-full"
          size="lg"
        >
          Continue as {roleConfig[selectedRole].title}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

        {/* Info */}
        <div className="text-center text-xs text-gray-500 pt-2">
          <p>This is a prototype. No real authentication required.</p>
          <p>Select any role to explore the system.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoginPage;