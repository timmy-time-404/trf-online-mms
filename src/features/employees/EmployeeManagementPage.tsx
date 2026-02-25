import React from 'react';

const EmployeeManagementPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
        <p className="text-gray-500 mt-1">Manage employees and visitors</p>
      </div>
      
      <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Employee Management</h3>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          This module allows HR to manage employee data, add new employees, update information, and track MCU status.
        </p>
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg inline-block">
          <p className="text-sm text-amber-800">🚧 Under Development</p>
        </div>
      </div>
    </div>
  );
};

export default EmployeeManagementPage;