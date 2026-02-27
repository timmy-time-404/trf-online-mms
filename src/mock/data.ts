// TRF Online System - CLEAN MOCK DATA (SUPABASE SAFE)

import type {
  User,
  Employee,
  TRF,
  StatusHistory,
  DashboardStats,
  RoomAvailability,
  WeeklyTravel,
  Activity,
  ReferenceData
} from '@/types';

/* =====================================================
   DEPARTMENTS
===================================================== */

export const departments = [
  { code: 'OPS', name: 'Operations' },
  { code: 'ENG', name: 'Engineering' },
  { code: 'HSE', name: 'HSE' },
  { code: 'EXP', name: 'Exploration' },
  { code: 'HR', name: 'HR' },
  { code: 'FIN', name: 'Finance' },
  { code: 'GA', name: 'General Affairs' }
];

/* =====================================================
   USERS (UUID ONLY)
===================================================== */

export const mockUsers: User[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    username: "john.doe",
    email: "john.doe@mining.com",
    role: "EMPLOYEE",
    employeeId: "11111111-1111-1111-1111-111111111111"
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    username: "jane.smith",
    email: "jane.smith@mining.com",
    role: "EMPLOYEE",
    employeeId: "22222222-2222-2222-2222-222222222222"
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    username: "admin.ops",
    email: "admin.ops@mining.com",
    role: "ADMIN_DEPT",
    department: "Operations"
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    username: "hod.ops",
    email: "hod.ops@mining.com",
    role: "HOD",
    department: "Operations"
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    username: "hr.admin",
    email: "hr@mining.com",
    role: "HR"
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    username: "pm.manager",
    email: "pm@mining.com",
    role: "PM"
  },
  {
    id: "77777777-7777-7777-7777-777777777777",
    username: "ga.admin",
    email: "ga@mining.com",
    role: "GA"
  }
];

/* =====================================================
   EMPLOYEES (UUID ONLY)
===================================================== */

export const mockEmployees: Employee[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    employeeType: "EMPLOYEE",
    employeeName: "John Doe",
    jobTitle: "Mining Engineer",
    department: "Operations",
    section: "Production",
    email: "john.doe@mining.com",
    phone: "+62 812-3456-7890"
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    employeeType: "EMPLOYEE",
    employeeName: "Jane Smith",
    jobTitle: "Safety Officer",
    department: "HSE",
    section: "Safety",
    email: "jane.smith@mining.com",
    phone: "+62 813-9876-5432"
  }
];

/* =====================================================
   IMPORTANT:
   TRF & STATUS HISTORY NOW COME FROM SUPABASE
===================================================== */

export const mockTRFs: TRF[] = [];

export const mockStatusHistory: StatusHistory[] = [];

/* =====================================================
   REFERENCE DATA
===================================================== */

export const referenceData: ReferenceData = {
  hotels: [
    { code: "HTL001", name: "Grand Mining Hotel", location: "Site A" },
    { code: "HTL002", name: "Camp Residence", location: "Site B" }
  ],
  locations: [
    { code: "LOC001", name: "Site A", type: "SITE" },
    { code: "LOC002", name: "Jakarta", type: "CITY" }
  ],
  purposes: [
    { code: "PUR001", name: "Site Inspection" },
    { code: "PUR002", name: "Training" }
  ],
  departments: [
    { code: "DEPT001", name: "Operations" },
    { code: "DEPT002", name: "HSE" }
  ]
};

/* =====================================================
   DASHBOARD MOCK (SAFE)
===================================================== */

export const dashboardStats: DashboardStats = {
  totalTravelIn: 0,
  totalTravelOut: 0,
  siteEntry: 0,
  onSiteActive: 0
};

export const roomAvailability: RoomAvailability[] = [];

export const weeklyTravel: WeeklyTravel[] = [];

export const recentActivities: Activity[] = [];