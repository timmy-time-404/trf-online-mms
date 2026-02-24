// TRF Online System - Type Definitions

export type UserRole = 'EMPLOYEE' | 'APPROVER' | 'HR' | 'GA';

export type EmployeeType = 'EMPLOYEE' | 'VISITOR';

export type MCUStatus = 'PENDING' | 'VALID' | 'EXPIRED';

export type TRFStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REVISED' | 'REJECTED';

export type TravelType = 'TRAVEL_IN' | 'TRAVEL_OUT';

export type ArrangementType = 'BY_SITE_SERVICE' | 'SELF_ARRANGEMENT';

export type TransportationType = 'CAR' | 'FLIGHT' | 'TRAIN' | 'SELF_ARRANGEMENT';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId?: string;
}

export interface Employee {
  id: string;
  userId?: string;
  employeeType: EmployeeType;
  employeeName: string;
  jobTitle?: string;
  department?: string;
  tenant?: string;
  section?: string;
  email?: string;
  phone?: string;
  dateOfHire?: string;
  mcuStatus: MCUStatus;
  pointOfHire?: string;
  validUntil?: string;
}

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

export interface TRF {
  id: string;
  trfNumber: string;
  employeeId: string;
  employee?: Employee;
  travelPurpose: string;
  startDate: string;
  endDate: string;
  purposeRemarks?: string;
  status: TRFStatus;
  accommodation?: Accommodation;
  travelArrangements: TravelArrangement[];
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  approverName?: string;
  createdAt: string;
  updatedAt: string;
}

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
