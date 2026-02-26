// TRF Online System - Mock Data

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

// ============================================
// DEPARTMENTS
// ============================================
export const departments = [
  { code: 'OPS', name: 'Operations' },
  { code: 'ENG', name: 'Engineering' },
  { code: 'HSE', name: 'HSE' },
  { code: 'EXP', name: 'Exploration' },
  { code: 'HR', name: 'HR' },
  { code: 'FIN', name: 'Finance' },
  { code: 'GA', name: 'General Affairs' }
];

// ============================================
// USERS (7 Roles)
// ============================================
export const mockUsers: User[] = [
  // 1. EMPLOYEE
  {
    id: 'usr-001',
    username: 'john.doe',
    email: 'john.doe@mining.com',
    role: 'EMPLOYEE',
    employeeId: 'emp-001'
  },
  {
    id: 'usr-002',
    username: 'jane.smith',
    email: 'jane.smith@mining.com',
    role: 'EMPLOYEE',
    employeeId: 'emp-002'
  },
  // 2. ADMIN_DEPT (Operations)
  {
    id: 'usr-003',
    username: 'admin.ops',
    email: 'admin.ops@mining.com',
    role: 'ADMIN_DEPT',
    department: 'Operations'
  },
  // 3. HOD (Head of Operations)
  {
    id: 'usr-004',
    username: 'hod.ops',
    email: 'hod.ops@mining.com',
    role: 'HOD',
    department: 'Operations'
  },
  // 4. HR
  {
    id: 'usr-005',
    username: 'hr.admin',
    email: 'hr@mining.com',
    role: 'HR'
  },
  // 5. PM (Project Manager - all departments)
  {
    id: 'usr-006',
    username: 'pm.manager',
    email: 'pm@mining.com',
    role: 'PM'
  },
  // 6. GA
  {
    id: 'usr-007',
    username: 'ga.admin',
    email: 'ga@mining.com',
    role: 'GA'
  },
  // 7. SUPER_ADMIN
  {
    id: 'usr-008',
    username: 'super.admin',
    email: 'superadmin@mining.com',
    role: 'SUPER_ADMIN'
  }
];

// ============================================
// EMPLOYEES
// ============================================
export const mockEmployees: Employee[] = [
  {
    id: 'emp-001',
    userId: 'usr-001',
    employeeType: 'EMPLOYEE',
    employeeName: 'John Doe',
    jobTitle: 'Mining Engineer',
    department: 'Operations',
    section: 'Production',
    email: 'john.doe@mining.com',
    phone: '+62 812-3456-7890',
    dateOfHire: '2020-03-15',
    pointOfHire: 'Jakarta'
  },
  {
    id: 'emp-002',
    userId: 'usr-002',
    employeeType: 'EMPLOYEE',
    employeeName: 'Jane Smith',
    jobTitle: 'Safety Officer',
    department: 'HSE',
    section: 'Safety',
    email: 'jane.smith@mining.com',
    phone: '+62 813-9876-5432',
    dateOfHire: '2021-06-20',
    pointOfHire: 'Surabaya'
  },
  {
    id: 'emp-003',
    employeeType: 'VISITOR',
    employeeName: 'Michael Chen',
    jobTitle: 'External Auditor',
    department: 'External',
    section: 'Audit',
    email: 'michael.chen@vendor.com',
    phone: '+62 814-5566-7788',
    pointOfHire: 'Singapore'
  },
  {
    id: 'emp-004',
    employeeType: 'EMPLOYEE',
    employeeName: 'Sarah Johnson',
    jobTitle: 'Geologist',
    department: 'Exploration',
    section: 'Geology',
    email: 'sarah.johnson@mining.com',
    phone: '+62 815-6677-8899',
    dateOfHire: '2022-09-05',
    pointOfHire: 'Balikpapan'
  }
];

// ============================================
// REFERENCE DATA
// ============================================
export const referenceData: ReferenceData = {
  hotels: [
    { code: 'HTL001', name: 'Grand Mining Hotel', location: 'Site A' },
    { code: 'HTL002', name: 'Camp Residence', location: 'Site B' },
    { code: 'HTL003', name: 'City Center Hotel', location: 'Jakarta' },
    { code: 'HTL004', name: 'Airport Hotel', location: 'Balikpapan' },
    { code: 'HTL005', name: 'Site C Camp', location: 'Site C' }
  ],
  locations: [
    { code: 'LOC001', name: 'Site A', type: 'SITE' },
    { code: 'LOC002', name: 'Site B', type: 'SITE' },
    { code: 'LOC003', name: 'Site C', type: 'SITE' },
    { code: 'LOC004', name: 'Jakarta', type: 'CITY' },
    { code: 'LOC005', name: 'Surabaya', type: 'CITY' },
    { code: 'LOC006', name: 'Balikpapan', type: 'CITY' },
    { code: 'LOC007', name: 'Soekarno-Hatta Airport', type: 'AIRPORT' },
    { code: 'LOC008', name: 'Sepinggan Airport', type: 'AIRPORT' }
  ],
  purposes: [
    { code: 'PUR001', name: 'Site Inspection' },
    { code: 'PUR002', name: 'Training' },
    { code: 'PUR003', name: 'Business Meeting' },
    { code: 'PUR004', name: 'Emergency Response' },
    { code: 'PUR005', name: 'Project Assignment' },
    { code: 'PUR006', name: 'Audit' },
    { code: 'PUR007', name: 'Vendor Coordination' }
  ],
  departments: [
    { code: 'DEPT001', name: 'Operations' },
    { code: 'DEPT002', name: 'Engineering' },
    { code: 'DEPT003', name: 'HSE' },
    { code: 'DEPT004', name: 'Exploration' },
    { code: 'DEPT005', name: 'HR' },
    { code: 'DEPT006', name: 'Finance' }
  ]
};

// ============================================
// TRF DATA (dengan Parallel Approval)
// ============================================
export const mockTRFs: TRF[] = [
  // 1. TRF DRAFT (Employee baru buat)
  {
    id: 'trf-001',
    trfNumber: 'TRF-20240224-001',
    employeeId: 'emp-001',
    employee: mockEmployees[0],
    department: 'Operations',
    travelPurpose: 'Site Inspection',
    startDate: '2024-03-01',
    endDate: '2024-03-05',
    purposeRemarks: 'Monthly site inspection for Q1 evaluation',
    status: 'DRAFT',
    accommodation: {
      hotelName: 'Grand Mining Hotel',
      checkInDate: '2024-03-01',
      checkOutDate: '2024-03-05',
      remarks: 'Single room requested'
    },
    travelArrangements: [
      {
        id: 'ta-001',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'FLIGHT',
        travelDate: '2024-03-01',
        fromLocation: 'Jakarta',
        toLocation: 'Site A',
        specialArrangement: false,
        remarks: 'Morning flight preferred'
      }
    ],
    createdAt: '2024-02-20T08:00:00Z',
    updatedAt: '2024-02-20T08:00:00Z'
  },

  // 2. TRF SUBMITTED (Menunggu Admin Dept verify)
  {
    id: 'trf-002',
    trfNumber: 'TRF-20240224-002',
    employeeId: 'emp-002',
    employee: mockEmployees[1],
    department: 'HSE',
    travelPurpose: 'Training',
    startDate: '2024-03-10',
    endDate: '2024-03-12',
    purposeRemarks: 'Safety training certification',
    status: 'SUBMITTED',
    accommodation: {
      hotelName: 'City Center Hotel',
      checkInDate: '2024-03-10',
      checkOutDate: '2024-03-12',
      remarks: 'Near training center'
    },
    travelArrangements: [
      {
        id: 'ta-002',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'FLIGHT',
        travelDate: '2024-03-10',
        fromLocation: 'Surabaya',
        toLocation: 'Jakarta',
        specialArrangement: false,
        remarks: ''
      }
    ],
    submittedAt: '2024-02-22T14:20:00Z',
    createdAt: '2024-02-22T14:00:00Z',
    updatedAt: '2024-02-22T14:20:00Z'
  },

  // 3. TRF PENDING_APPROVAL (Sudah diverifikasi Admin Dept, tunggu HoD & HR parallel)
  {
    id: 'trf-003',
    trfNumber: 'TRF-20240224-003',
    employeeId: 'emp-001',
    employee: mockEmployees[0],
    department: 'Operations',
    travelPurpose: 'Business Meeting',
    startDate: '2024-03-15',
    endDate: '2024-03-17',
    purposeRemarks: 'Coordination with subcontractors',
    status: 'PENDING_APPROVAL',
    adminDeptVerify: {
      verified: true,
      verifiedAt: '2024-02-23T10:00:00Z',
      verifiedBy: 'usr-003',
      verifierName: 'Admin OPS',
      remarks: 'Dates confirmed, budget available'
    },
    parallelApproval: {
      hod: { status: 'PENDING' },
      hr: { status: 'PENDING' }
    },
    accommodation: {
      hotelName: 'Grand Mining Hotel',
      checkInDate: '2024-03-15',
      checkOutDate: '2024-03-17',
      remarks: ''
    },
    travelArrangements: [
      {
        id: 'ta-003',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'CAR',
        travelDate: '2024-03-15',
        fromLocation: 'Jakarta',
        toLocation: 'Site A',
        specialArrangement: false,
        remarks: ''
      }
    ],
    submittedAt: '2024-02-23T09:00:00Z',
    createdAt: '2024-02-23T08:00:00Z',
    updatedAt: '2024-02-23T10:00:00Z'
  },

  // 4. TRF HOD_APPROVED (HoD approved, tunggu HR)
  {
    id: 'trf-004',
    trfNumber: 'TRF-20240224-004',
    employeeId: 'emp-004',
    employee: mockEmployees[3],
    department: 'Exploration',
    travelPurpose: 'Project Assignment',
    startDate: '2024-03-20',
    endDate: '2024-03-30',
    purposeRemarks: 'New exploration site survey',
    status: 'HOD_APPROVED',
    adminDeptVerify: {
      verified: true,
      verifiedAt: '2024-02-21T09:00:00Z',
      verifiedBy: 'usr-003',
      verifierName: 'Admin OPS',
      remarks: 'Project approved'
    },
    parallelApproval: {
      hod: {
        status: 'APPROVED',
        actionAt: '2024-02-21T14:00:00Z',
        actionBy: 'usr-004',
        actionByName: 'HOD OPS',
        remarks: 'Approved for site survey'
      },
      hr: { status: 'PENDING' }
    },
    accommodation: {
      hotelName: 'Site C Camp',
      checkInDate: '2024-03-20',
      checkOutDate: '2024-03-30',
      remarks: 'Extended stay'
    },
    travelArrangements: [
      {
        id: 'ta-004',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'CAR',
        travelDate: '2024-03-20',
        fromLocation: 'Balikpapan',
        toLocation: 'Site C',
        specialArrangement: false,
        remarks: ''
      }
    ],
    submittedAt: '2024-02-21T08:00:00Z',
    createdAt: '2024-02-21T07:30:00Z',
    updatedAt: '2024-02-21T14:00:00Z'
  },

  // 5. TRF PARALLEL_APPROVED (HoD & HR approved, tunggu PM)
  {
    id: 'trf-005',
    trfNumber: 'TRF-20240224-005',
    employeeId: 'emp-002',
    employee: mockEmployees[1],
    department: 'HSE',
    travelPurpose: 'Emergency Response',
    startDate: '2024-02-25',
    endDate: '2024-02-28',
    purposeRemarks: 'Emergency drill coordination',
    status: 'PARALLEL_APPROVED',
    adminDeptVerify: {
      verified: true,
      verifiedAt: '2024-02-20T10:00:00Z',
      verifiedBy: 'usr-003',
      verifierName: 'Admin OPS',
      remarks: 'Urgent - emergency response'
    },
    parallelApproval: {
      hod: {
        status: 'APPROVED',
        actionAt: '2024-02-20T14:00:00Z',
        actionBy: 'usr-004',
        actionByName: 'HOD OPS',
        remarks: 'Approved for emergency'
      },
      hr: {
        status: 'APPROVED',
        actionAt: '2024-02-20T16:00:00Z',
        actionBy: 'usr-005',
        actionByName: 'HR Admin',
        remarks: 'Employee eligible'
      }
    },
    accommodation: {
      hotelName: 'Camp Residence',
      checkInDate: '2024-02-25',
      checkOutDate: '2024-02-28',
      remarks: 'Emergency booking'
    },
    travelArrangements: [
      {
        id: 'ta-005',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'FLIGHT',
        travelDate: '2024-02-25',
        fromLocation: 'Jakarta',
        toLocation: 'Site B',
        specialArrangement: true,
        justification: 'Emergency response - immediate departure',
        remarks: 'First flight available'
      }
    ],
    submittedAt: '2024-02-20T09:00:00Z',
    createdAt: '2024-02-20T08:30:00Z',
    updatedAt: '2024-02-20T16:00:00Z'
  },

  // 6. TRF PM_APPROVED (Approved, tunggu GA process)
  {
    id: 'trf-006',
    trfNumber: 'TRF-20240224-006',
    employeeId: 'emp-001',
    employee: mockEmployees[0],
    department: 'Operations',
    travelPurpose: 'Audit',
    startDate: '2024-04-01',
    endDate: '2024-04-03',
    purposeRemarks: 'Quarterly compliance audit',
    status: 'PM_APPROVED',
    adminDeptVerify: {
      verified: true,
      verifiedAt: '2024-02-18T10:00:00Z',
      verifiedBy: 'usr-003',
      verifierName: 'Admin OPS',
      remarks: 'Audit scheduled'
    },
    parallelApproval: {
      hod: {
        status: 'APPROVED',
        actionAt: '2024-02-18T14:00:00Z',
        actionBy: 'usr-004',
        actionByName: 'HOD OPS',
        remarks: 'Approved'
      },
      hr: {
        status: 'APPROVED',
        actionAt: '2024-02-18T16:00:00Z',
        actionBy: 'usr-005',
        actionByName: 'HR Admin',
        remarks: 'Valid'
      }
    },
    pmApproval: {
      approved: true,
      approvedAt: '2024-02-19T10:00:00Z',
      approvedBy: 'usr-006',
      approverName: 'PM Manager',
      remarks: 'Final approval granted'
    },
    accommodation: {
      hotelName: 'Grand Mining Hotel',
      checkInDate: '2024-04-01',
      checkOutDate: '2024-04-03',
      remarks: ''
    },
    travelArrangements: [
      {
        id: 'ta-006',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'FLIGHT',
        travelDate: '2024-04-01',
        fromLocation: 'Jakarta',
        toLocation: 'Site A',
        specialArrangement: false,
        remarks: ''
      }
    ],
    submittedAt: '2024-02-18T09:00:00Z',
    createdAt: '2024-02-18T08:00:00Z',
    updatedAt: '2024-02-19T10:00:00Z'
  },

  // 7. TRF GA_PROCESSED (Completed dengan voucher)
  {
    id: 'trf-007',
    trfNumber: 'TRF-20240224-007',
    employeeId: 'emp-002',
    employee: mockEmployees[1],
    department: 'HSE',
    travelPurpose: 'Training',
    startDate: '2024-02-10',
    endDate: '2024-02-12',
    purposeRemarks: 'Safety certification',
    status: 'GA_PROCESSED',
    adminDeptVerify: {
      verified: true,
      verifiedAt: '2024-02-05T10:00:00Z',
      verifiedBy: 'usr-003',
      verifierName: 'Admin OPS',
      remarks: 'Training approved'
    },
    parallelApproval: {
      hod: {
        status: 'APPROVED',
        actionAt: '2024-02-05T14:00:00Z',
        actionBy: 'usr-004',
        actionByName: 'HOD OPS',
        remarks: 'Approved'
      },
      hr: {
        status: 'APPROVED',
        actionAt: '2024-02-05T16:00:00Z',
        actionBy: 'usr-005',
        actionByName: 'HR Admin',
        remarks: 'Eligible'
      }
    },
    pmApproval: {
      approved: true,
      approvedAt: '2024-02-06T09:00:00Z',
      approvedBy: 'usr-006',
      approverName: 'PM Manager',
      remarks: 'Approved'
    },
    gaProcess: {
      processed: true,
      processedAt: '2024-02-07T10:00:00Z',
      processedBy: 'usr-007',
      processorName: 'GA Admin',
      voucherDetails: {
        hotelVoucher: 'VCH-2024-001: Grand Mining Hotel, 2 nights',
        flightTicket: 'TKT-2024-001: GA-123 Jakarta-Site A, 10 Feb 08:00',
        transportation: 'Airport pickup arranged',
        other: 'Breakfast included'
      },
      files: ['ticket.pdf', 'voucher.pdf'],
      remarksToEmployee: 'Please collect tickets at GA office. Flight at 08:00, arrive 2 hours early.'
    },
    accommodation: {
      hotelName: 'Grand Mining Hotel',
      checkInDate: '2024-02-10',
      checkOutDate: '2024-02-12',
      remarks: ''
    },
    travelArrangements: [
      {
        id: 'ta-007',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'FLIGHT',
        travelDate: '2024-02-10',
        fromLocation: 'Jakarta',
        toLocation: 'Site A',
        specialArrangement: false,
        remarks: ''
      }
    ],
    submittedAt: '2024-02-05T08:00:00Z',
    approvedAt: '2024-02-06T09:00:00Z',
    approvedBy: 'usr-006',
    approverName: 'PM Manager',
    createdAt: '2024-02-05T07:00:00Z',
    updatedAt: '2024-02-07T10:00:00Z'
  },

  // 8. TRF REJECTED (di-reject oleh PM)
  {
    id: 'trf-008',
    trfNumber: 'TRF-20240224-008',
    employeeId: 'emp-004',
    employee: mockEmployees[3],
    department: 'Exploration',
    travelPurpose: 'Conference',
    startDate: '2024-05-01',
    endDate: '2024-05-05',
    purposeRemarks: 'International geology conference',
    status: 'REJECTED',
    adminDeptVerify: {
      verified: true,
      verifiedAt: '2024-02-15T10:00:00Z',
      verifiedBy: 'usr-003',
      verifierName: 'Admin OPS',
      remarks: 'Valid request'
    },
    parallelApproval: {
      hod: {
        status: 'APPROVED',
        actionAt: '2024-02-15T14:00:00Z',
        actionBy: 'usr-004',
        actionByName: 'HOD OPS',
        remarks: 'Approved'
      },
      hr: {
        status: 'APPROVED',
        actionAt: '2024-02-15T16:00:00Z',
        actionBy: 'usr-005',
        actionByName: 'HR Admin',
        remarks: 'Valid'
      }
    },
    pmApproval: {
      approved: false,
      approvedAt: '2024-02-16T10:00:00Z',
      approvedBy: 'usr-006',
      approverName: 'PM Manager',
      remarks: 'Budget cut for Q2 - please reschedule to Q3'
    },
    accommodation: {
      hotelName: 'City Center Hotel',
      checkInDate: '2024-05-01',
      checkOutDate: '2024-05-05',
      remarks: ''
    },
    travelArrangements: [],
    submittedAt: '2024-02-15T09:00:00Z',
    approvedAt: '2024-02-16T10:00:00Z',
    approvedBy: 'usr-006',
    approverName: 'PM Manager',
    createdAt: '2024-02-15T08:00:00Z',
    updatedAt: '2024-02-16T10:00:00Z'
  },

  // 9. TRF NEEDS_REVISION (dikembalikan oleh HR)
  {
    id: 'trf-009',
    trfNumber: 'TRF-20240224-009',
    employeeId: 'emp-001',
    employee: mockEmployees[0],
    department: 'Operations',
    travelPurpose: 'Site Inspection',
    startDate: '2024-03-25',
    endDate: '2024-03-28',
    purposeRemarks: 'Monthly inspection',
    status: 'NEEDS_REVISION',
    adminDeptVerify: {
      verified: true,
      verifiedAt: '2024-02-24T10:00:00Z',
      verifiedBy: 'usr-003',
      verifierName: 'Admin OPS',
      remarks: 'OK'
    },
    parallelApproval: {
      hod: {
        status: 'APPROVED',
        actionAt: '2024-02-24T14:00:00Z',
        actionBy: 'usr-004',
        actionByName: 'HOD OPS',
        remarks: 'Approved'
      },
      hr: {
        status: 'REJECTED',
        actionAt: '2024-02-24T16:00:00Z',
        actionBy: 'usr-005',
        actionByName: 'HR Admin',
        remarks: 'MCU expired - please renew medical checkup first'
      }
    },
    accommodation: {
      hotelName: 'Grand Mining Hotel',
      checkInDate: '2024-03-25',
      checkOutDate: '2024-03-28',
      remarks: ''
    },
    travelArrangements: [],
    submittedAt: '2024-02-24T09:00:00Z',
    createdAt: '2024-02-24T08:00:00Z',
    updatedAt: '2024-02-24T16:00:00Z'
  }
];

// ============================================
// STATUS HISTORY
// ============================================
export const mockStatusHistory: StatusHistory[] = [
  {
    id: 'sh-001',
    trfId: 'trf-001',
    changedBy: 'usr-001',
    changedByName: 'John Doe',
    newStatus: 'DRAFT',
    changedAt: '2024-02-20T08:00:00Z'
  },
  {
    id: 'sh-002',
    trfId: 'trf-002',
    changedBy: 'usr-002',
    changedByName: 'Jane Smith',
    oldStatus: 'DRAFT',
    newStatus: 'SUBMITTED',
    changedAt: '2024-02-22T14:20:00Z'
  },
  {
    id: 'sh-003',
    trfId: 'trf-003',
    changedBy: 'usr-001',
    changedByName: 'John Doe',
    oldStatus: 'DRAFT',
    newStatus: 'SUBMITTED',
    changedAt: '2024-02-23T09:00:00Z'
  },
  {
    id: 'sh-004',
    trfId: 'trf-003',
    changedBy: 'usr-003',
    changedByName: 'Admin OPS',
    oldStatus: 'SUBMITTED',
    newStatus: 'PENDING_APPROVAL',
    remarks: 'Dates confirmed, budget available',
    changedAt: '2024-02-23T10:00:00Z'
  },
  {
    id: 'sh-005',
    trfId: 'trf-007',
    changedBy: 'usr-007',
    changedByName: 'GA Admin',
    oldStatus: 'PM_APPROVED',
    newStatus: 'GA_PROCESSED',
    remarks: 'Voucher issued, tickets booked',
    changedAt: '2024-02-07T10:00:00Z'
  }
];

// ============================================
// DASHBOARD DATA
// ============================================
export const dashboardStats: DashboardStats = {
  totalTravelIn: 156,
  totalTravelOut: 142,
  siteEntry: 23,
  onSiteActive: 89
};

export const roomAvailability: RoomAvailability[] = [
  { hotelName: 'Grand Mining Hotel', total: 120, occupied: 98, available: 22 },
  { hotelName: 'Camp Residence', total: 80, occupied: 45, available: 35 },
  { hotelName: 'Site C Camp', total: 60, occupied: 52, available: 8 },
  { hotelName: 'City Center Hotel', total: 40, occupied: 28, available: 12 }
];

export const weeklyTravel: WeeklyTravel[] = [
  { day: 'Mon', travelIn: 12, travelOut: 8 },
  { day: 'Tue', travelIn: 15, travelOut: 10 },
  { day: 'Wed', travelIn: 8, travelOut: 12 },
  { day: 'Thu', travelIn: 20, travelOut: 15 },
  { day: 'Fri', travelIn: 18, travelOut: 14 },
  { day: 'Sat', travelIn: 5, travelOut: 6 },
  { day: 'Sun', travelIn: 3, travelOut: 4 }
];

export const recentActivities: Activity[] = [
  {
    id: 'act-001',
    date: '2024-02-24T16:00:00Z',
    type: 'REVISION',
    description: 'TRF returned by HR - MCU expired',
    trfNumber: 'TRF-20240224-009',
    status: 'NEEDS_REVISION'
  },
  {
    id: 'act-002',
    date: '2024-02-24T10:00:00Z',
    type: 'VERIFICATION',
    description: 'TRF verified by Admin Dept',
    trfNumber: 'TRF-20240224-003',
    status: 'PENDING_APPROVAL'
  },
  {
    id: 'act-003',
    date: '2024-02-22T14:20:00Z',
    type: 'SUBMISSION',
    description: 'New TRF submitted by Jane Smith',
    trfNumber: 'TRF-20240224-002',
    status: 'SUBMITTED'
  }
];