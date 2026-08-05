import {
  invokeAuthenticatedAppFunction,
} from '@/lib/appSession';

export const ROSTER_OPERATIONS_UPDATED_EVENT =
  'roster-operations-updated';

export type RosterAttentionActionCode =
  | 'RETURN_TO_SITE_CONFIRMATION_REQUIRED'
  | 'TRAVEL_OUT_CONFIRMATION_REQUIRED'
  | 'POTENTIAL_OVERSTAY'
  | 'SITE_OUT_DUE_TODAY';

export interface RosterAttentionQueueItem {
  action_code: RosterAttentionActionCode;
  priority: number;

  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string;

  roster_code: string;

  site_cycle_id: string;
  cycle_number: number;
  cycle_status: string;

  planned_site_in: string | null;
  planned_site_out: string | null;
  actual_site_in: string | null;
  actual_site_out: string | null;

  planned_leave_start: string | null;
  planned_leave_end: string | null;
  actual_leave_start: string | null;
  actual_leave_end: string | null;

  days_overdue: number;
  potential_extra_site_days: number;
  projected_os_days: number;

  source_reference: string | null;
  remarks: string | null;
}

export interface RosterAttentionQueueResponse {
  success: true;
  action: 'queue';
  requestId: string;
  asOfDate: string;
  items: RosterAttentionQueueItem[];
  total: number;
  counts: Partial<
    Record<
      RosterAttentionActionCode,
      number
    >
  >;
}

export interface OSLedgerEmployee {
  id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  job_title: string;
  is_active: boolean | null;
}

export interface OSLedgerItem {
  id: string;
  os_number: string;
  employee_id: string;
  source_type: string;
  source_reference: string | null;
  generated_date: string;
  original_days: number;
  remaining_days: number;
  used_days: number;
  expired_days: number;
  cancelled_days: number;
  cycle_number: number;
  status: string;

  earned_site_cycle_id: string | null;
  earned_site_cycle_number: number | null;
  earned_site_cycle_status: string | null;

  remarks: string | null;
  created_at: string;
  updated_at: string;
  employee: OSLedgerEmployee | null;
}

export interface OSLedgerResponse {
  success: true;
  action: 'os_ledger';
  requestId: string;
  items: OSLedgerItem[];
  total: number;
  summary: {
    employeeCount: number;
    activeBucketCount: number;
    totalRemainingDays: number;
  };
}

export interface OSAdjustmentEmployee {
  id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  job_title: string;
  is_active: boolean | null;
}

export interface OSAdjustmentCycle {
  id: string;
  employee_id: string;
  cycle_number: number;
  status: string;

  planned_site_in: string | null;
  planned_site_out: string | null;
  actual_site_in: string | null;
  actual_site_out: string | null;

  planned_leave_start: string | null;
  planned_leave_end: string | null;
  actual_leave_start: string | null;
  actual_leave_end: string | null;
}

export interface OSAdjustmentOptionsResponse {
  success: true;
  action: 'os_adjustment_options';
  requestId: string;
  employees: OSAdjustmentEmployee[];
  cycles: OSAdjustmentCycle[];
}

export type OSAdjustmentType =
  | 'ADD_BUCKET'
  | 'SET_REMAINING'
  | 'SET_CURRENT_CYCLE'
  | 'SET_ORIGIN_CYCLE'
  | 'CANCEL_BUCKET';

export interface AdjustOSInput {
  operationKey: string;
  adjustmentType: OSAdjustmentType;

  employeeId?: string | null;
  osLedgerId?: string | null;

  days?: number | null;
  newRemainingDays?: number | null;
  newCycleNumber?: number | null;
  earnedSiteCycleId?: string | null;

  generatedDate?: string | null;
  referenceNumber: string;
  remarks: string;
}

export interface MyRosterEmployee {
  id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  job_title: string;
}

export interface MyRosterDefinition {
  assignment_id: string;
  roster_pattern_id: string;
  roster_code: string;
  site_days: number;
  leave_days: number;
  effective_from: string;
  effective_to: string | null;
  source_type: string;
  source_reference: string | null;
}

export interface MyRosterCurrentCycle {
  id: string;
  cycle_number: number;
  status: string;

  planned_site_in: string | null;
  planned_site_out: string | null;
  actual_site_in: string | null;
  actual_site_out: string | null;

  planned_leave_start: string | null;
  planned_leave_end: string | null;
  actual_leave_start: string | null;
  actual_leave_end: string | null;

  site_day_number: number;
  completed_site_days: number;
  days_until_site_out: number;
  overstay_days: number;
  progress_percent: number;

  source_type: string;
  source_reference: string | null;
}

export interface MyRosterOSBucket {
  id: string;
  os_number: string;
  source_type: string;
  source_reference?: string | null;
  generated_date: string;
  original_days: number;
  remaining_days: number;
  used_days: number;
  expired_days?: number;
  cancelled_days?: number;
  cycle_number: number;
  status: string;
  remarks: string | null;
}

export interface MyRosterCycleHistoryItem {
  id: string;
  cycle_number: number;
  status: string;

  planned_site_in: string | null;
  planned_site_out: string | null;
  actual_site_in: string | null;
  actual_site_out: string | null;

  planned_leave_start: string | null;
  planned_leave_end: string | null;
  actual_leave_start: string | null;
  actual_leave_end: string | null;

  planned_site_days: number | null;
  actual_site_days: number | null;
  planned_leave_days: number | null;
  actual_leave_days: number | null;

  source_type: string;
  source_reference: string | null;
}

export interface MyRosterSummary {
  success: true;
  as_of_date: string;

  employee: MyRosterEmployee;
  roster: MyRosterDefinition | null;
  current_cycle: MyRosterCurrentCycle | null;

  os_summary: {
    has_available_os: boolean;
    total_available_days: number;
    active_bucket_count: number;
  };

  active_os_buckets: MyRosterOSBucket[];
  recent_os_history: MyRosterOSBucket[];
  cycle_history: MyRosterCycleHistoryItem[];

  data_quality: {
    employee_mapping_ready: boolean;
    active_roster_assignment_count: number;
    active_site_cycle_count: number;
    has_active_roster: boolean;
    has_active_cycle: boolean;
  };
}

export interface MyRosterSummaryResponse {
  success: true;
  action: 'my_summary';
  requestId: string;
  asOfDate: string;
  summary: MyRosterSummary;
}

export interface RosterMutationResponse {
  success: true;
  action:
    | 'confirm_site_out'
    | 'confirm_leave_start'
    | 'confirm_return'
    | 'consume_os'
    | 'adjust_os';
  requestId: string;
  result: Record<string, unknown> | null;
}

export interface ConfirmSiteOutInput {
  siteCycleId: string;
  actualSiteOut: string;
  siteOutTrfId?: string | null;
  remarks: string;
}

export interface ConfirmLeaveStartInput {
  siteCycleId: string;
  actualLeaveStart: string;
  remarks: string;
}

export interface ConfirmReturnInput {
  siteCycleId: string;
  returnToSiteDate: string;
  siteInTrfId?: string | null;
  remarks: string;
}

export interface ConsumeOSInput {
  employeeId: string;
  requestedDays: number;
  operationKey: string;
  referenceType: string;
  referenceId?: string | null;
  referenceNumber?: string | null;
  remarks: string;
}

const invokeRosterOperations = <
  TResponse,
>(
  body: Record<string, unknown>,
): Promise<TResponse> =>
  invokeAuthenticatedAppFunction<TResponse>(
    'roster-operations',
    body,
  );

export const getLocalDateInputValue = (
  date = new Date(),
): string => {
  const localTime = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000,
  );

  return localTime
    .toISOString()
    .slice(0, 10);
};

export const getMyRosterSummary = (
  asOfDate = getLocalDateInputValue(),
): Promise<MyRosterSummaryResponse> =>
  invokeRosterOperations<MyRosterSummaryResponse>(
    {
      action: 'my_summary',
      asOfDate,
    },
  );

export const getRosterAttentionQueue = (
  asOfDate = getLocalDateInputValue(),
): Promise<RosterAttentionQueueResponse> =>
  invokeRosterOperations<RosterAttentionQueueResponse>(
    {
      action: 'queue',
      asOfDate,
    },
  );

export const getActiveOSLedger =
  (): Promise<OSLedgerResponse> =>
    invokeRosterOperations<OSLedgerResponse>({
      action: 'os_ledger',
    });

export const getOSAdjustmentOptions =
  (): Promise<OSAdjustmentOptionsResponse> =>
    invokeRosterOperations<OSAdjustmentOptionsResponse>({
      action: 'os_adjustment_options',
    });

export const adjustEmployeeOS = (
  input: AdjustOSInput,
): Promise<RosterMutationResponse> =>
  invokeRosterOperations<RosterMutationResponse>(
    {
      action: 'adjust_os',
      ...input,
    },
  );

export const confirmRosterSiteOut = (
  input: ConfirmSiteOutInput,
): Promise<RosterMutationResponse> =>
  invokeRosterOperations<RosterMutationResponse>(
    {
      action: 'confirm_site_out',
      ...input,
    },
  );

export const confirmRosterLeaveStart = (
  input: ConfirmLeaveStartInput,
): Promise<RosterMutationResponse> =>
  invokeRosterOperations<RosterMutationResponse>(
    {
      action: 'confirm_leave_start',
      ...input,
    },
  );

export const confirmRosterReturn = (
  input: ConfirmReturnInput,
): Promise<RosterMutationResponse> =>
  invokeRosterOperations<RosterMutationResponse>(
    {
      action: 'confirm_return',
      ...input,
    },
  );

export const consumeEmployeeOS = (
  input: ConsumeOSInput,
): Promise<RosterMutationResponse> =>
  invokeRosterOperations<RosterMutationResponse>(
    {
      action: 'consume_os',
      ...input,
    },
  );

export const dispatchRosterOperationsUpdated =
  (): void => {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(
      new Event(
        ROSTER_OPERATIONS_UPDATED_EVENT,
      ),
    );
  };
