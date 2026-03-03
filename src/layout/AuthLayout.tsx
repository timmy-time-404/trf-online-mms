import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          
          {/* ✅ LOGO PERUSAHAAN */}
          {/* Pastikan file logo Anda (misal: logo.png) berada di dalam folder "public" */}
          <img 
            src="src\assets\mms-color.png" 
            alt="Logo PT Merdeka Mining Servis" 
            className="h-20 w-auto mx-auto mb-4 object-contain"
          />
          
          <h2 className="text-2xl font-bold text-gray-900">Travel Request Form Online</h2>
          <p className="text-gray-600 mt-1">by PT. Merdeka Mining Servis</p>
        </div>

        {/* Content */}
        <Outlet />

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          PT. Merdeka Mining Servis | &copy; {new Date().getFullYear()} All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;