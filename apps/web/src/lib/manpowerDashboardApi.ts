import {
  invokeAuthenticatedAppFunction,
} from '@/lib/appSession';

export type ManpowerStatus =
  | 'ONSITE'
  | 'FIELD_BREAK';

export interface ManpowerDashboardScope {
  role:
    | 'HOD'
    | 'HR'
    | 'PM'
    | 'SUPER_ADMIN';
  department: string | null;
  visibility:
    | 'OWN_DEPARTMENT_ONLY'
    | 'ALL_DEPARTMENTS';
}

export interface ManpowerDashboardSummary {
  onsite: number;
  field_break: number;
  classified_total: number;
  unclassified: number;
  active_employee_total: number;
}

export interface ManpowerDepartmentRow {
  department: string;
  onsite: number;
  field_break: number;
  total: number;
}

export interface ManpowerEmployeeRow {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string | null;
  job_title: string | null;
  point_of_hire: string | null;
  status: ManpowerStatus;
  travel_out: string | null;
  travel_in: string | null;
  travel_in_source:
    | 'ACTUAL'
    | 'PLANNED'
    | null;
  remarks:
    | 'Onsite'
    | 'Field Break';
  site_cycle_id: string | null;
  cycle_number: number | null;
  cycle_status: string | null;
}

export interface UnclassifiedManpowerEmployee {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string | null;
  point_of_hire: string | null;
  reason:
    | 'MULTIPLE_MATCHING_INTERVALS'
    | 'NO_SITE_CYCLE'
    | 'ACTUAL_SITE_IN_NOT_CONFIRMED'
    | 'NO_ACTUAL_INTERVAL_FOR_DATE'
    | string;
  matching_interval_count: number;
  cycle_number: number | null;
  cycle_status: string | null;
  planned_site_in: string | null;
  planned_site_out: string | null;
  actual_site_in: string | null;
  actual_site_out: string | null;
  planned_leave_start: string | null;
  planned_leave_end: string | null;
  actual_leave_start: string | null;
  actual_leave_end: string | null;
}

export interface ManpowerDashboardDataQuality {
  duplicate_interval_employee_count: number;
  missing_point_of_hire_count: number;
  missing_department_count: number;
  unclassified_count: number;
  unclassified_employees:
    UnclassifiedManpowerEmployee[];
}

export interface ManpowerDashboardSnapshot {
  as_of_date: string;
  generated_at: string;
  scope: ManpowerDashboardScope;
  summary: ManpowerDashboardSummary;
  departments: ManpowerDepartmentRow[];
  employees: ManpowerEmployeeRow[];
  data_quality: ManpowerDashboardDataQuality;
  classification_rules: {
    onsite: string;
    field_break: string;
    unclassified: string;
  };
}

export interface ManpowerDashboardResponse {
  success: true;
  action: 'snapshot';
  requestId: string;
  snapshot: ManpowerDashboardSnapshot;
}

export const getManpowerDashboardSnapshot = (
  asOfDate: string,
): Promise<ManpowerDashboardResponse> =>
  invokeAuthenticatedAppFunction<ManpowerDashboardResponse>(
    'manpower-dashboard',
    {
      action: 'snapshot',
      asOfDate,
    },
  );
