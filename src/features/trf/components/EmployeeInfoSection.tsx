import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Briefcase, Building, MapPin, Calendar, Phone, Mail, Shield } from 'lucide-react';
import { useTRFStore } from '@/store';
// Employee type imported from types

interface EmployeeInfoSectionProps {
  selectedEmployeeId: string;
  onEmployeeChange: (employeeId: string) => void;
  disabled?: boolean;
}

const EmployeeInfoSection: React.FC<EmployeeInfoSectionProps> = ({
  selectedEmployeeId,
  onEmployeeChange,
  disabled = false
}) => {
  const { employees } = useTRFStore();

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const InfoRow = ({ 
    icon: Icon, 
    label, 
    value 
  }: { 
    icon: React.ElementType; 
    label: string; 
    value?: string 
  }) => (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value || '-'}</p>
      </div>
    </div>
  );

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Employee Information</CardTitle>
            <p className="text-sm text-gray-500">Select employee or visitor</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Employee Selector */}
        <div className="space-y-2">
          <Label htmlFor="employee">Select Employee / Visitor <span className="text-red-500">*</span></Label>
          <Select
            value={selectedEmployeeId}
            onValueChange={onEmployeeChange}
            disabled={disabled}
          >
            <SelectTrigger id="employee" className="w-full">
              <SelectValue placeholder="Select an employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" disabled>Select an employee</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  <div className="flex items-center gap-2">
                    <span>{employee.employeeName}</span>
                    <span className="text-xs text-gray-500">({employee.employeeType})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Employee Details */}
        {selectedEmployee && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-blue-700">
                  {selectedEmployee.employeeName.charAt(0)}
                </span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{selectedEmployee.employeeName}</h4>
                <p className="text-sm text-gray-500">{selectedEmployee.jobTitle || 'N/A'}</p>
              </div>
              <div className="ml-auto">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedEmployee.employeeType === 'EMPLOYEE' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {selectedEmployee.employeeType}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow 
                icon={Building} 
                label="Department" 
                value={selectedEmployee.department} 
              />
              <InfoRow 
                icon={Briefcase} 
                label="Tenant" 
                value={selectedEmployee.tenant} 
              />
              <InfoRow 
                icon={MapPin} 
                label="Section" 
                value={selectedEmployee.section} 
              />
              <InfoRow 
                icon={MapPin} 
                label="Point of Hire" 
                value={selectedEmployee.pointOfHire} 
              />
              <InfoRow 
                icon={Mail} 
                label="Email" 
                value={selectedEmployee.email} 
              />
              <InfoRow 
                icon={Phone} 
                label="Phone" 
                value={selectedEmployee.phone} 
              />
              <InfoRow 
                icon={Calendar} 
                label="Date of Hire" 
                value={selectedEmployee.dateOfHire} 
              />
              <InfoRow 
                icon={Shield} 
                label="MCU Status" 
                value={selectedEmployee.mcuStatus} 
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeInfoSection;
