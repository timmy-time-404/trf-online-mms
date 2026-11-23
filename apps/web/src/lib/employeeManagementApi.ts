import {
  invokeAuthenticatedAppFunction,
} from '@/lib/appSession';

export const EMPLOYEE_MANAGEMENT_UPDATED_EVENT =
  'employee-management-updated';

export interface EmployeeManagementRoster {
  id: string;
  code: string;
  name: string;
  site_days: number;
  leave_days: number;
}

export interface EmployeeManagementSite {
  id: string;
  name: string;
  type: string;
}

export interface EmployeeManagementMasterData {
  departments: string[];
  rosters: EmployeeManagementRoster[];
  sites: EmployeeManagementSite[];
  employee_types: Array<
    'EMPLOYEE' | 'VISITOR'
  >;
}

export interface EmployeeManagementRecord {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  employee_type:
    | 'EMPLOYEE'
    | 'VISITOR';
  email: string | null;
  phone: string;
  department: string;
  section: string;
  job_title: string;
  join_date: string | null;
  point_of_hire: string;
  employee_is_active: boolean;

  user_id: string | null;
  username: string | null;
  user_role: string | null;
  user_is_active: boolean;
  must_change_password: boolean;

  roster_assignment_id: string | null;
  roster_pattern_id: string | null;
  roster_code: string | null;
  roster_name: string | null;
  site_days: number | null;
  leave_days: number | null;
  roster_effective_from: string | null;
  roster_effective_to: string | null;

  site_cycle_id: string | null;
  cycle_number: number | null;
  cycle_status: string | null;
  site_location_id: string | null;
  site_name: string | null;
  planned_site_in: string | null;
  planned_site_out: string | null;
  planned_leave_start: string | null;
  planned_leave_end: string | null;
  actual_site_in: string | null;
  actual_site_out: string | null;
  actual_leave_start: string | null;
  actual_leave_end: string | null;

  schedule_editable: boolean;
}

export interface TemporaryCredential {
  username: string;
  temporaryPassword: string;
  shownOnce: true;
  mustChangePassword: true;
}

export interface EmployeeManagementMasterResponse {
  success: true;
  action: 'master_data';
  requestId: string;
  masterData: EmployeeManagementMasterData;
}

export interface EmployeeManagementListResponse {
  success: true;
  action: 'list';
  requestId: string;
  items: EmployeeManagementRecord[];
  total: number;
  returned: number;
}

export interface EmployeeManagementMutationResponse {
  success: true;
  action:
    | 'create'
    | 'update'
    | 'set_active'
    | 'reset_password';
  requestId: string;
  result: Record<string, unknown>;
  credentials?: TemporaryCredential;
}

export interface EmployeeManagementProfileInput {
  employeeName: string;
  employeeType:
    | 'EMPLOYEE'
    | 'VISITOR';
  email: string;
  phone: string;
  department: string;
  section?: string;
  jobTitle: string;
  joinDate: string;
  pointOfHire?: string;

  rosterCode: string;
  siteLocationId: string;
  plannedD1: string;
}

export interface CreateEmployeeOnboardingInput
  extends EmployeeManagementProfileInput {
  operationKey: string;
  employeeCode: string;
}

export interface UpdateEmployeeManagementInput
  extends EmployeeManagementProfileInput {
  operationKey: string;
  employeeId: string;
}

export interface SetEmployeeActiveInput {
  operationKey: string;
  employeeId: string;
  isActive: boolean;
  remarks: string;
}

export interface ResetEmployeePasswordInput {
  operationKey: string;
  employeeId: string;
  remarks: string;
}

const invokeEmployeeManagement = <
  TResponse,
>(
  body: Record<string, unknown>,
): Promise<TResponse> =>
  invokeAuthenticatedAppFunction<TResponse>(
    'employee-management',
    body,
  );

export const createEmployeeOperationKey = (
  action: string,
  employeeIdOrCode = 'NEW',
): string => [
  'EMPLOYEE_MANAGEMENT',
  action.toUpperCase(),
  employeeIdOrCode,
  crypto.randomUUID(),
].join(':');

export const getEmployeeManagementMasterData =
  (): Promise<EmployeeManagementMasterResponse> =>
    invokeEmployeeManagement<EmployeeManagementMasterResponse>({
      action: 'master_data',
    });

export const listEmployeeManagementRecords = (
  search = '',
  includeInactive = true,
): Promise<EmployeeManagementListResponse> =>
  invokeEmployeeManagement<EmployeeManagementListResponse>({
    action: 'list',
    search,
    includeInactive,
  });

export const createEmployeeOnboarding = (
  input: CreateEmployeeOnboardingInput,
): Promise<EmployeeManagementMutationResponse> =>
  invokeEmployeeManagement<EmployeeManagementMutationResponse>({
    action: 'create',
    ...input,
  });

export const updateEmployeeManagement = (
  input: UpdateEmployeeManagementInput,
): Promise<EmployeeManagementMutationResponse> =>
  invokeEmployeeManagement<EmployeeManagementMutationResponse>({
    action: 'update',
    ...input,
  });

export const setEmployeeManagementActive = (
  input: SetEmployeeActiveInput,
): Promise<EmployeeManagementMutationResponse> =>
  invokeEmployeeManagement<EmployeeManagementMutationResponse>({
    action: 'set_active',
    ...input,
  });

export const resetEmployeeTemporaryPassword = (
  input: ResetEmployeePasswordInput,
): Promise<EmployeeManagementMutationResponse> =>
  invokeEmployeeManagement<EmployeeManagementMutationResponse>({
    action: 'reset_password',
    ...input,
  });

export const dispatchEmployeeManagementUpdated =
  (): void => {
    if (
      typeof window === 'undefined'
    ) {
      return;
    }

    window.dispatchEvent(
      new Event(
        EMPLOYEE_MANAGEMENT_UPDATED_EVENT,
      ),
    );
  };
