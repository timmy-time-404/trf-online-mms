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
// USERS & EMPLOYEES
// ============================================

export const mockUsers: User[] = [
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
  {
    id: 'usr-003',
    username: 'manager.wilson',
    email: 'manager.wilson@mining.com',
    role: 'APPROVER',
    employeeId: 'emp-003'
  },
  {
    id: 'usr-004',
    username: 'hr.admin',
    email: 'hr@mining.com',
    role: 'HR'
  },
  {
    id: 'usr-005',
    username: 'ga.admin',
    email: 'ga@mining.com',
    role: 'GA'
  }
];

export const mockEmployees: Employee[] = [
  {
    id: 'emp-001',
    userId: 'usr-001',
    employeeType: 'EMPLOYEE',
    employeeName: 'John Doe',
    jobTitle: 'Mining Engineer',
    department: 'Operations',
    tenant: 'Main Contractor',
    section: 'Production',
    email: 'john.doe@mining.com',
    phone: '+62 812-3456-7890',
    dateOfHire: '2020-03-15',
    mcuStatus: 'VALID',
    pointOfHire: 'Jakarta',
    validUntil: '2025-03-15'
  },
  {
    id: 'emp-002',
    userId: 'usr-002',
    employeeType: 'EMPLOYEE',
    employeeName: 'Jane Smith',
    jobTitle: 'Safety Officer',
    department: 'HSE',
    tenant: 'Main Contractor',
    section: 'Safety',
    email: 'jane.smith@mining.com',
    phone: '+62 813-9876-5432',
    dateOfHire: '2021-06-20',
    mcuStatus: 'VALID',
    pointOfHire: 'Surabaya',
    validUntil: '2025-06-20'
  },
  {
    id: 'emp-003',
    userId: 'usr-003',
    employeeType: 'EMPLOYEE',
    employeeName: 'Robert Wilson',
    jobTitle: 'Operations Manager',
    department: 'Operations',
    tenant: 'Main Contractor',
    section: 'Management',
    email: 'manager.wilson@mining.com',
    phone: '+62 811-2233-4455',
    dateOfHire: '2018-01-10',
    mcuStatus: 'VALID',
    pointOfHire: 'Jakarta',
    validUntil: '2025-01-10'
  },
  {
    id: 'emp-004',
    employeeType: 'VISITOR',
    employeeName: 'Michael Chen',
    jobTitle: 'External Auditor',
    department: 'External',
    tenant: 'Vendor A',
    section: 'Audit',
    email: 'michael.chen@vendor.com',
    phone: '+62 814-5566-7788',
    mcuStatus: 'PENDING',
    pointOfHire: 'Singapore',
    validUntil: '2024-12-31'
  },
  {
    id: 'emp-005',
    employeeType: 'EMPLOYEE',
    employeeName: 'Sarah Johnson',
    jobTitle: 'Geologist',
    department: 'Exploration',
    tenant: 'Main Contractor',
    section: 'Geology',
    email: 'sarah.johnson@mining.com',
    phone: '+62 815-6677-8899',
    dateOfHire: '2022-09-05',
    mcuStatus: 'VALID',
    pointOfHire: 'Balikpapan',
    validUntil: '2025-09-05'
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
  ],
  tenants: [
    { code: 'TEN001', name: 'Main Contractor' },
    { code: 'TEN002', name: 'Subcontractor A' },
    { code: 'TEN003', name: 'Subcontractor B' },
    { code: 'TEN004', name: 'Vendor A' },
    { code: 'TEN005', name: 'Vendor B' }
  ]
};

// ============================================
// TRF DATA
// ============================================

export const mockTRFs: TRF[] = [
  {
    id: 'trf-001',
    trfNumber: 'TRF-20240224-001',
    employeeId: 'emp-001',
    employee: mockEmployees[0],
    travelPurpose: 'Site Inspection',
    startDate: '2024-03-01',
    endDate: '2024-03-05',
    purposeRemarks: 'Monthly site inspection for Q1 evaluation',
    status: 'APPROVED',
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
      },
      {
        id: 'ta-002',
        travelType: 'TRAVEL_OUT',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'FLIGHT',
        travelDate: '2024-03-05',
        fromLocation: 'Site A',
        toLocation: 'Jakarta',
        specialArrangement: false,
        remarks: 'Afternoon flight'
      }
    ],
    submittedAt: '2024-02-20T08:30:00Z',
    approvedAt: '2024-02-21T10:15:00Z',
    approvedBy: 'usr-003',
    approverName: 'Robert Wilson',
    createdAt: '2024-02-20T08:00:00Z',
    updatedAt: '2024-02-21T10:15:00Z'
  },
  {
    id: 'trf-002',
    trfNumber: 'TRF-20240224-002',
    employeeId: 'emp-002',
    employee: mockEmployees[1],
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
        id: 'ta-003',
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
  {
    id: 'trf-003',
    trfNumber: 'TRF-20240224-003',
    employeeId: 'emp-004',
    employee: mockEmployees[3],
    travelPurpose: 'Audit',
    startDate: '2024-02-25',
    endDate: '2024-02-28',
    purposeRemarks: 'Quarterly compliance audit',
    status: 'DRAFT',
    accommodation: {
      hotelName: 'Camp Residence',
      checkInDate: '2024-02-25',
      checkOutDate: '2024-02-28',
      remarks: ''
    },
    travelArrangements: [
      {
        id: 'ta-004',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'FLIGHT',
        travelDate: '2024-02-25',
        fromLocation: 'Singapore',
        toLocation: 'Site B',
        specialArrangement: true,
        justification: 'VIP visitor - expedited processing required',
        remarks: 'Airport pickup arranged'
      }
    ],
    createdAt: '2024-02-23T09:00:00Z',
    updatedAt: '2024-02-23T09:00:00Z'
  },
  {
    id: 'trf-004',
    trfNumber: 'TRF-20240224-004',
    employeeId: 'emp-005',
    employee: mockEmployees[4],
    travelPurpose: 'Project Assignment',
    startDate: '2024-03-15',
    endDate: '2024-03-30',
    purposeRemarks: 'New exploration site survey',
    status: 'REJECTED',
    accommodation: {
      hotelName: 'Site C Camp',
      checkInDate: '2024-03-15',
      checkOutDate: '2024-03-30',
      remarks: 'Extended stay'
    },
    travelArrangements: [
      {
        id: 'ta-005',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'CAR',
        travelDate: '2024-03-15',
        fromLocation: 'Balikpapan',
        toLocation: 'Site C',
        specialArrangement: false,
        remarks: ''
      }
    ],
    submittedAt: '2024-02-18T11:00:00Z',
    approvedAt: '2024-02-19T16:30:00Z',
    approvedBy: 'usr-003',
    approverName: 'Robert Wilson',
    createdAt: '2024-02-18T10:30:00Z',
    updatedAt: '2024-02-19T16:30:00Z'
  },
  {
    id: 'trf-005',
    trfNumber: 'TRF-20240224-005',
    employeeId: 'emp-001',
    employee: mockEmployees[0],
    travelPurpose: 'Business Meeting',
    startDate: '2024-03-20',
    endDate: '2024-03-22',
    purposeRemarks: 'Coordination meeting with subcontractors',
    status: 'REVISED',
    accommodation: {
      hotelName: 'Grand Mining Hotel',
      checkInDate: '2024-03-20',
      checkOutDate: '2024-03-22',
      remarks: ''
    },
    travelArrangements: [
      {
        id: 'ta-006',
        travelType: 'TRAVEL_IN',
        arrangementType: 'BY_SITE_SERVICE',
        transportation: 'CAR',
        travelDate: '2024-03-20',
        fromLocation: 'Jakarta',
        toLocation: 'Site A',
        specialArrangement: false,
        remarks: ''
      }
    ],
    submittedAt: '2024-02-21T13:00:00Z',
    createdAt: '2024-02-21T12:00:00Z',
    updatedAt: '2024-02-22T09:00:00Z'
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
    trfId: 'trf-001',
    changedBy: 'usr-001',
    changedByName: 'John Doe',
    oldStatus: 'DRAFT',
    newStatus: 'SUBMITTED',
    changedAt: '2024-02-20T08:30:00Z'
  },
  {
    id: 'sh-003',
    trfId: 'trf-001',
    changedBy: 'usr-003',
    changedByName: 'Robert Wilson',
    oldStatus: 'SUBMITTED',
    newStatus: 'APPROVED',
    remarks: 'Approved for site inspection',
    changedAt: '2024-02-21T10:15:00Z'
  },
  {
    id: 'sh-004',
    trfId: 'trf-002',
    changedBy: 'usr-002',
    changedByName: 'Jane Smith',
    newStatus: 'DRAFT',
    changedAt: '2024-02-22T14:00:00Z'
  },
  {
    id: 'sh-005',
    trfId: 'trf-002',
    changedBy: 'usr-002',
    changedByName: 'Jane Smith',
    oldStatus: 'DRAFT',
    newStatus: 'SUBMITTED',
    changedAt: '2024-02-22T14:20:00Z'
  },
  {
    id: 'sh-006',
    trfId: 'trf-004',
    changedBy: 'usr-005',
    changedByName: 'Sarah Johnson',
    newStatus: 'DRAFT',
    changedAt: '2024-02-18T10:30:00Z'
  },
  {
    id: 'sh-007',
    trfId: 'trf-004',
    changedBy: 'usr-005',
    changedByName: 'Sarah Johnson',
    oldStatus: 'DRAFT',
    newStatus: 'SUBMITTED',
    changedAt: '2024-02-18T11:00:00Z'
  },
  {
    id: 'sh-008',
    trfId: 'trf-004',
    changedBy: 'usr-003',
    changedByName: 'Robert Wilson',
    oldStatus: 'SUBMITTED',
    newStatus: 'REJECTED',
    remarks: 'Budget constraints - please reschedule to next quarter',
    changedAt: '2024-02-19T16:30:00Z'
  },
  {
    id: 'sh-009',
    trfId: 'trf-005',
    changedBy: 'usr-001',
    changedByName: 'John Doe',
    newStatus: 'DRAFT',
    changedAt: '2024-02-21T12:00:00Z'
  },
  {
    id: 'sh-010',
    trfId: 'trf-005',
    changedBy: 'usr-001',
    changedByName: 'John Doe',
    oldStatus: 'DRAFT',
    newStatus: 'SUBMITTED',
    changedAt: '2024-02-21T13:00:00Z'
  },
  {
    id: 'sh-011',
    trfId: 'trf-005',
    changedBy: 'usr-003',
    changedByName: 'Robert Wilson',
    oldStatus: 'SUBMITTED',
    newStatus: 'REVISED',
    remarks: 'Please update travel dates to avoid weekend',
    changedAt: '2024-02-22T09:00:00Z'
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
    date: '2024-02-24T10:30:00Z',
    type: 'SUBMISSION',
    description: 'New TRF submitted by Jane Smith',
    trfNumber: 'TRF-20240224-002',
    status: 'SUBMITTED'
  },
  {
    id: 'act-002',
    date: '2024-02-23T16:45:00Z',
    type: 'APPROVAL',
    description: 'TRF approved by Robert Wilson',
    trfNumber: 'TRF-20240224-001',
    status: 'APPROVED'
  },
  {
    id: 'act-003',
    date: '2024-02-22T09:00:00Z',
    type: 'REVISION',
    description: 'TRF returned for revision by Robert Wilson',
    trfNumber: 'TRF-20240224-005',
    status: 'REVISED'
  },
  {
    id: 'act-004',
    date: '2024-02-21T10:15:00Z',
    type: 'APPROVAL',
    description: 'TRF approved by Robert Wilson',
    trfNumber: 'TRF-20240224-001',
    status: 'APPROVED'
  },
  {
    id: 'act-005',
    date: '2024-02-20T14:20:00Z',
    type: 'SUBMISSION',
    description: 'New TRF submitted by John Doe',
    trfNumber: 'TRF-20240224-005',
    status: 'SUBMITTED'
  }
];
