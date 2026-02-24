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
import { User, Users, Shield, Building2, ArrowRight } from 'lucide-react';
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
      toast.success(`Logged in as ${selectedRole}`);
      navigate('/');
    } else {
      toast.error('User not found');
    }
  };

  const roleConfig = {
    EMPLOYEE: {
      icon: User,
      title: 'Employee',
      description: 'Create and manage travel requests',
      color: 'bg-blue-50 text-blue-600'
    },
    APPROVER: {
      icon: Shield,
      title: 'Approver',
      description: 'Review and approve travel requests',
      color: 'bg-green-50 text-green-600'
    },
    HR: {
      icon: Users,
      title: 'HR',
      description: 'View reports and manage employees',
      color: 'bg-purple-50 text-purple-600'
    },
    GA: {
      icon: Building2,
      title: 'GA',
      description: 'Manage hotels and accommodations',
      color: 'bg-orange-50 text-orange-600'
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-xl">Select Your Role</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Choose a role to simulate different user views
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Cards */}
        <div className="grid grid-cols-2 gap-3">
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
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900">{config.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{config.description}</p>
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
              <SelectItem value="APPROVER">Approver - Review & Approve</SelectItem>
              <SelectItem value="HR">HR - View Reports</SelectItem>
              <SelectItem value="GA">GA - Manage Hotels</SelectItem>
            </SelectContent>
          </Select>
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
