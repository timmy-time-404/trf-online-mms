import React from 'react';

const HotelManagementPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hotel Management</h1>
        <p className="text-gray-500 mt-1">Manage hotels and accommodations</p>
      </div>
      
      <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Hotel Management</h3>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          This module allows GA to manage hotels, room availability, rates, and accommodation arrangements.
        </p>
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg inline-block">
          <p className="text-sm text-amber-800">🚧 Under Development</p>
        </div>
      </div>
    </div>
  );
};

export default HotelManagementPage;