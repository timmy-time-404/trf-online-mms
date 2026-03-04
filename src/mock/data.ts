// TRF Online System - CLEAN MOCK DATA (SUPABASE SAFE)

import type {
  User,
  TRF,
  StatusHistory,
  
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



/* =====================================================
   IMPORTANT:
   TRF & STATUS HISTORY NOW COME FROM SUPABASE
===================================================== */

export const mockTRFs: TRF[] = [];

export const mockStatusHistory: StatusHistory[] = [];

/* =====================================================
   REFERENCE DATA
===================================================== */



/* =====================================================
   DASHBOARD MOCK (SAFE)
===================================================== */

