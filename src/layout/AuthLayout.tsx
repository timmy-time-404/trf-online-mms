import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">TRF</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TRF Online</h1>
          <p className="text-gray-600 mt-1">Travel Request Form System</p>
        </div>

        {/* Content */}
        <Outlet />

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          Mining Corporate System
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;
