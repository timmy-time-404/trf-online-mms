// types/index.ts - Complete Type Definitions for TRF Online System

// ============================================
// DATABASE TYPES (Supabase Schema)
// ============================================

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          user_id: string | null;
          employee_type: string;
          employee_name: string;
          job_title: string | null;
          department: string | null;
          section: string | null;
          email: string | null;
          phone: string | null;
          date_of_hire: string | null;
          point_of_hire: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          employee_type: string;
          employee_name: string;
          job_title?: string | null;
          department?: string | null;
          section?: string | null;
          email?: string | null;
          phone?: string | null;
          date_of_hire?: string | null;
          point_of_hire?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          employee_type?: string;
          employee_name?: string;
          job_title?: string | null;
          department?: string | null;
          section?: string | null;
          email?: string | null;
          phone?: string | null;
          date_of_hire?: string | null;
          point_of_hire?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          username: string;
          email: string;
          role: string;
          employee_id: string | null;
          department: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          email: string;
          role: string;
          employee_id?: string | null;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string;
          role?: string;
          employee_id?: string | null;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trfs: {
        Row: {
          id: string;
          trf_number: string;
          employee_id: string;
          department: string;
          travel_purpose: string;
          start_date: string;
          end_date: string;
          purpose_remarks: string | null;
          status: string;
          accommodation: any | null;
          travel_arrangements: any;
          admin_dept_verify: any | null;
          parallel_approval: any | null;
          pm_approval: any | null;
          ga_process: any | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trf_number?: string;
          employee_id: string;
          department: string;
          travel_purpose: string;
          start_date: string;
          end_date: string;
          purpose_remarks?: string | null;
          status?: string;
          accommodation?: any | null;
          travel_arrangements?: any;
          admin_dept_verify?: any | null;
          parallel_approval?: any | null;
          pm_approval?: any | null;
          ga_process?: any | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trf_number?: string;
          employee_id?: string;
          department?: string;
          travel_purpose?: string;
          start_date?: string;
          end_date?: string;
          purpose_remarks?: string | null;
          status?: string;
          accommodation?: any | null;
          travel_arrangements?: any;
          admin_dept_verify?: any | null;
          parallel_approval?: any | null;
          pm_approval?: any | null;
          ga_process?: any | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      status_history: {
        Row: {
          id: string;
          trf_id: string;
          changed_by: string;
          changed_by_name: string;
          old_status: string | null;
          new_status: string;
          remarks: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          trf_id: string;
          changed_by: string;
          changed_by_name: string;
          old_status?: string | null;
          new_status: string;
          remarks?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          trf_id?: string;
          changed_by?: string;
          changed_by_name?: string;
          old_status?: string | null;
          new_status?: string;
          remarks?: string | null;
          changed_at?: string;
        };
      };
    };
  };
}

// ============================================
// ROLES (7 Total)
// ============================================

export type UserRole = 
  | 'EMPLOYEE' 
  | 'ADMIN_DEPT' 
  | 'HOD' 
  | 'HR' 
  | 'PM' 
  | 'GA' 
  | 'SUPER_ADMIN';

export type EmployeeType = 'EMPLOYEE' | 'VISITOR';

export type MCUStatus = 'PENDING' | 'VALID' | 'EXPIRED';

// ============================================
// TRF STATUS (10 Total - dengan Parallel Approval)
// ============================================

export type TRFStatus = 
  | 'DRAFT'                          // Employee editing
  | 'SUBMITTED'                      // Waiting Admin Dept verify
  | 'PENDING_APPROVAL'               // Parallel: Waiting HoD & HR
  | 'HOD_APPROVED'                   // HoD done, waiting HR
  | 'HR_APPROVED'                    // HR done, waiting HoD
  | 'PARALLEL_APPROVED'              // Both approved, waiting PM
  | 'PM_APPROVED'                    // Approved, waiting GA
  | 'GA_PROCESSED'                   // Completed with voucher
  | 'REJECTED'                       // Rejected by anyone
  | 'NEEDS_REVISION';                // Sent back for edit

export type TravelType = 'TRAVEL_IN' | 'TRAVEL_OUT';

export type ArrangementType = 'BY_SITE_SERVICE' | 'SELF_ARRANGEMENT';

export type TransportationType = 'CAR' | 'FLIGHT' | 'TRAIN' | 'SELF_ARRANGEMENT';

// ============================================
// USER & EMPLOYEE
// ============================================

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  department?: string;  // For ADMIN_DEPT & HOD
}

export interface Employee {
  id: string;
  userId?: string;      // Nullable untuk VISITOR atau external
  employeeType: EmployeeType;
  employeeName: string;
  jobTitle?: string;
  department?: string;
  section?: string;
  email?: string;
  phone?: string;
  dateOfHire?: string;
  pointOfHire?: string;
}

// ============================================
// ACCOMMODATION & TRAVEL
// ============================================

export interface Accommodation {
  id?: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  remarks?: string;
}

export interface TravelArrangement {
  id?: string;
  travelType: TravelType;
  arrangementType: ArrangementType;
  transportation: TransportationType;
  travelDate: string;
  fromLocation: string;
  toLocation: string;
  specialArrangement: boolean;
  justification?: string;
  remarks?: string;
}

// ============================================
// APPROVAL STRUCTURE (Parallel)
// ============================================

export interface AdminDeptVerification {
  verified: boolean;      // true = yes, false = no
  verifiedAt: string;
  verifiedBy: string;
  verifierName: string;
  remarks?: string;       // Reason if no
}

export interface ParallelApproval {
  hod?: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    actionAt?: string;
    actionBy?: string;
    actionByName?: string;
    remarks?: string;
  };
  hr?: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    actionAt?: string;
    actionBy?: string;
    actionByName?: string;
    remarks?: string;
  };
}

export interface PMApproval {
  approved: boolean;
  approvedAt: string;
  approvedBy: string;
  approverName: string;
  remarks?: string;
}

export interface GAProcess {
  processed: boolean;
  processedAt: string;
  processedBy: string;
  processorName: string;
  voucherDetails?: {
    hotelVoucher?: string;
    flightTicket?: string;
    transportation?: string;
    other?: string;
  };
  files?: string[];           // File URLs (tickets, vouchers)
  remarksToEmployee?: string;
}

// ============================================
// TRF (Updated dengan Approval Structure)
// ============================================

export interface TRF {
  id: string;
  trfNumber: string;
  employeeId: string;
  employee?: Employee;
  department: string;         // Department for filtering
  travelPurpose: string;
  startDate: string;
  endDate: string;
  purposeRemarks?: string;
  status: TRFStatus;
  
  // Approval Flow
  adminDeptVerify?: AdminDeptVerification;
  parallelApproval?: ParallelApproval;
  pmApproval?: PMApproval;
  gaProcess?: GAProcess;
  
  // Legacy fields (for backward compatibility)
  accommodation?: Accommodation;
  travelArrangements: TravelArrangement[];
  submittedAt?: string;
  approvedAt?: string;        // Legacy - use pmApproval instead
  approvedBy?: string;        // Legacy
  approverName?: string;      // Legacy
  
  createdAt: string;
  updatedAt: string;
}

// ============================================
// STATUS HISTORY
// ============================================

export interface StatusHistory {
  id: string;
  trfId: string;
  changedBy: string;
  changedByName: string;
  oldStatus?: TRFStatus;
  newStatus: TRFStatus;
  remarks?: string;
  changedAt: string;
}

// ============================================
// DASHBOARD & REFERENCE
// ============================================

export interface DashboardStats {
  totalTravelIn: number;
  totalTravelOut: number;
  siteEntry: number;
  onSiteActive: number;
}

export interface RoomAvailability {
  hotelName: string;
  total: number;
  occupied: number;
  available: number;
}

export interface WeeklyTravel {
  day: string;
  travelIn: number;
  travelOut: number;
}

export interface Activity {
  id: string;
  date: string;
  type: string;
  description: string;
  trfNumber: string;
  status: TRFStatus;
}

export interface ReferenceData {
  hotels: { code: string; name: string; location: string }[];
  locations: { code: string; name: string; type: string }[];
  purposes: { code: string; name: string }[];
  departments: { code: string; name: string }[];
  tenants: { code: string; name: string }[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// STORE TYPES
// ============================================

export interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface TRFState {
  trfs: TRF[];
  statusHistory: StatusHistory[];
  employees: Employee[];
  users: User[];
  isLoading: boolean;
}

export interface DashboardState {
  stats: DashboardStats;
  roomAvailability: RoomAvailability[];
  weeklyTravel: WeeklyTravel[];
  recentActivities: Activity[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// FORM INPUT TYPES (Untuk Create/Update)
// ============================================

export interface CreateTRFInput {
  employeeId: string;
  department: string;
  travelPurpose: string;
  startDate: string;
  endDate: string;
  purposeRemarks?: string;
  accommodation?: Accommodation;
  travelArrangements: TravelArrangement[];
}

export interface UpdateTRFInput {
  travelPurpose?: string;
  startDate?: string;
  endDate?: string;
  purposeRemarks?: string;
  accommodation?: Accommodation;
  travelArrangements?: TravelArrangement[];
  status?: TRFStatus;
  adminDeptVerify?: AdminDeptVerification;
  parallelApproval?: ParallelApproval;
  pmApproval?: PMApproval;
  gaProcess?: GAProcess;
  submittedAt?: string;
}