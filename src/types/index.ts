// ============================================
// BASIC TYPES & ENUMS
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

export type TRFStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ADMIN_DEPT_VERIFIED'
  | 'PENDING_APPROVAL' // Status legacy/umum
  | 'HOD_APPROVED'
  | 'HR_APPROVED'
  | 'PM_APPROVED'
  | 'GA_PROCESSED'
  | 'REJECTED'
  | 'NEEDS_REVISION'
  | 'REVISED';

export type TravelType = 'TRAVEL_IN' | 'TRAVEL_OUT';

export type ArrangementType = 'BY_SITE_SERVICE' | 'SELF_ARRANGEMENT';

export type TransportationType = 'FLIGHT' | 'TRAIN' | 'CAR' | 'SHIP' | 'SELF_ARRANGEMENT';

// ============================================
// ENTITIES
// ============================================

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
}

export interface Employee {
  id: string;
  userId?: string;
  employeeType: EmployeeType;
  employeeName: string;
  jobTitle: string;
  department: string;
  section: string;
  email: string;
  phone: string;
  dateOfHire?: string;
  pointOfHire: string;
  tenant?: string; // Optional tambahan jika ada
}

export interface Accommodation {
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

// Interfaces untuk legacy nested data (Jika masih digunakan UI lama)
export interface AdminDeptVerify {
  verified: boolean;
  verifiedAt: string;
  verifierId: string;
  verifierName: string;
  remarks?: string;
}

export interface ApprovalAction {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISED';
  actionAt?: string;
  actionById?: string;
  actionByName?: string;
  remarks?: string;
}

export interface ParallelApproval {
  hod: ApprovalAction;
  hr: ApprovalAction;
}

export interface PMApproval {
  approved: boolean;
  approvedAt: string;
  approverId: string;
  approverName: string;
  remarks?: string;
}

export interface GAProcess {
  processed: boolean;
  processedAt: string;
  processorId: string;
  processorName: string;
  voucherDetails?: {
    hotelVoucher?: string;
    flightTicket?: string;
    transportation?: string;
    other?: string;
  };
  remarksToEmployee?: string;
  files?: GADocument[];
}

export interface StatusHistory {
  id?: string;
  trfId: string;
  changedBy: string;
  changedByName: string;
  oldStatus?: string;
  newStatus: string;
  remarks: string;
  changedAt?: string; // Biasanya di-generate otomatis oleh DB
}

export interface GADocument {
  name: string;
  url: string;
  path?: string; 
}

// ============================================
// MAIN TRF OBJECT
// ============================================

export interface TRF {
  id: string;
  trfNumber: string;
  employeeId: string;
  employee?: Employee;
  department?: string;
  travelPurpose: string;
  startDate: string;
  endDate: string;
  purposeRemarks?: string;
  status: TRFStatus;
  accommodation?: Accommodation;
  travelArrangements: TravelArrangement[];
  
  // Legacy / Nested Workflow Data (Jika masih dipakai)
  adminDeptVerify?: AdminDeptVerify;
  parallelApproval?: ParallelApproval;
  pmApproval?: PMApproval;
  gaProcess?: GAProcess;
  // Modern Workflow Data
  gaDocuments?: Record<string, GADocument>;
  // Lumpsum Data
  lumpsumAmount?: number;
  lumpsumCurrency?: string;
  lumpsumNote?: string;
  lumpsumInputBy?: string;
  lumpsumInputAt?: string;

  // Timestamps
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INPUT TYPES (For Form / API)
// ============================================

export interface CreateTRFInput {
  employeeId: string;
  department?: string;
  travelPurpose: string;
  startDate: string;
  endDate: string;
  purposeRemarks?: string;
  accommodation?: Accommodation;
  travelArrangements: TravelArrangement[];
}

export interface UpdateTRFInput extends Partial<CreateTRFInput> {
  status?: TRFStatus;
}