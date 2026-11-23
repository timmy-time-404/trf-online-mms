import {
  invokeAuthenticatedAppFunction,
} from '@/lib/appSession';

export type EarlyRecallStatus =
  | 'DRAFT'
  | 'PENDING_HR_VALIDATION'
  | 'NEEDS_REVISION'
  | 'HR_VALIDATED'
  | 'PENDING_PM_APPROVAL'
  | 'PM_APPROVED'
  | 'GA_PROCESSING'
  | 'TRAVEL_BOOKED'
  | 'RETURNED_TO_SITE'
  | 'OS_GENERATED'
  | 'REJECTED'
  | 'CANCELLED';

export interface EarlyRecallEmployee {
  id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  job_title: string;
  phone?: string | null;
}

export interface EarlyRecallLinkedTRF {
  id: string;
  trf_number: string;
  status: string;
  start_date: string;
  end_date: string;
  travel_arrangements: unknown;
  ga_process: unknown;
}

export interface EarlyRecallOSLedger {
  id: string;
  os_number: string;
  employee_id: string;
  source_type: string;
  generated_date: string;
  original_days: number;
  remaining_days: number;
  used_days: number;
  expired_days: number;
  cancelled_days: number;
  cycle_number: number;
  status: string;
  created_at: string;
}

export interface EarlyRecallHistoryRecord {
  id: string;
  early_recall_id: string;
  from_status?: string | null;
  to_status: string;
  actor_type: string;
  changed_by_user_id?: string | null;
  changed_by_role?: string | null;
  remarks?: string | null;
  metadata: Record<
    string,
    unknown
  >;
  created_at: string;
}

export interface EarlyRecallRecord {
  id: string;
  recall_number: string;

  employee_id: string;
  department: string;

  source_trf_id?: string | null;
  linked_trf_id?: string | null;

  requested_by_user_id: string;
  request_source_role: string;

  approved_leave_start: string;
  approved_leave_end: string;
  approved_leave_days: number;

  proposed_return_date: string;
  estimated_leave_days_used: number;
  estimated_unused_leave_days: number;

  actual_return_date?: string | null;
  actual_leave_days_used?: number | null;
  unused_leave_days?: number | null;

  reason: string;
  remarks?: string | null;
  status: EarlyRecallStatus;

  hr_validated_by_user_id?: string | null;
  hr_validated_at?: string | null;
  hr_validation_remarks?: string | null;

  pm_approved_by_user_id?: string | null;
  pm_approved_at?: string | null;
  pm_approval_remarks?: string | null;

  ga_processed_by_user_id?: string | null;
  ga_processing_started_at?: string | null;
  travel_booked_at?: string | null;
  ga_remarks?: string | null;

  employee_acknowledged_at?: string | null;

  actual_return_confirmed_by_user_id?: string | null;
  actual_return_confirmed_at?: string | null;

  os_generated_days: number;
  os_generated_at?: string | null;
  os_ledger_id?: string | null;

  rejected_by_user_id?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;

  cancelled_by_user_id?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;

  created_at: string;
  updated_at: string;

  employee: EarlyRecallEmployee;
  linked_trf?: EarlyRecallLinkedTRF | null;
  os_ledger?: EarlyRecallOSLedger | null;
  history?: EarlyRecallHistoryRecord[];
}

export interface EarlyRecallNotificationResult {
  event: string;
  attempted: boolean;
  success: boolean;
  skippedReason?: string;
  error?: string;
}

export interface EarlyRecallListResponse {
  success: true;
  action: 'list';
  items: EarlyRecallRecord[];
  total: number;
}

export interface EarlyRecallDetailResponse {
  success: true;
  action: 'detail';
  item: EarlyRecallRecord;
}

export interface EarlyRecallMutationResponse {
  success: true;
  action: string;
  result: Record<
    string,
    unknown
  >;
  item: EarlyRecallRecord;
  notifications: EarlyRecallNotificationResult[];
}

export interface CreateEarlyRecallInput {
  employeeId: string;
  sourceTrfId?: string | null;
  approvedLeaveStart: string;
  approvedLeaveEnd: string;
  proposedReturnDate: string;
  reason: string;
  remarks?: string | null;
}

export interface UpdateEarlyRecallInput
  extends CreateEarlyRecallInput {
  earlyRecallId: string;
}

const invokeWorkflow = <
  TResponse,
>(
  body: Record<
    string,
    unknown
  >,
): Promise<TResponse> =>
  invokeAuthenticatedAppFunction<TResponse>(
    'early-recall-workflow',
    body,
  );

export const listEarlyRecalls = (
  filters: {
    status?: EarlyRecallStatus;
    search?: string;
  } = {},
): Promise<EarlyRecallListResponse> =>
  invokeWorkflow<EarlyRecallListResponse>({
    action: 'list',
    ...filters,
  });

export const getEarlyRecallDetail = (
  earlyRecallId: string,
): Promise<EarlyRecallDetailResponse> =>
  invokeWorkflow<EarlyRecallDetailResponse>({
    action: 'detail',
    earlyRecallId,
  });

export const createEarlyRecall = (
  input: CreateEarlyRecallInput,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'create',
    ...input,
  });

export const updateEarlyRecall = (
  input: UpdateEarlyRecallInput,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'update',
    ...input,
  });

export const submitEarlyRecall = (
  earlyRecallId: string,
  remarks?: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'submit',
    earlyRecallId,
    remarks,
  });

export const validateEarlyRecallByHR = (
  earlyRecallId: string,
  remarks?: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'hr_validate',
    earlyRecallId,
    remarks,
  });

export const returnEarlyRecallForRevision = (
  earlyRecallId: string,
  revisionReason: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'return_revision',
    earlyRecallId,
    revisionReason,
  });

export const approveEarlyRecallByPM = (
  earlyRecallId: string,
  remarks?: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'pm_approve',
    earlyRecallId,
    remarks,
  });

export const startEarlyRecallGAProcessing = (
  earlyRecallId: string,
  remarks?: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'ga_start',
    earlyRecallId,
    remarks,
  });

export const markEarlyRecallTravelBooked = (
  earlyRecallId: string,
  remarks?: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'travel_booked',
    earlyRecallId,
    remarks,
  });

export const acknowledgeEarlyRecall = (
  earlyRecallId: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'acknowledge',
    earlyRecallId,
  });

export const confirmEarlyRecallActualReturn = (
  earlyRecallId: string,
  actualReturnDate: string,
  remarks?: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'confirm_return',
    earlyRecallId,
    actualReturnDate,
    remarks,
  });

export const rejectEarlyRecall = (
  earlyRecallId: string,
  rejectionReason: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'reject',
    earlyRecallId,
    rejectionReason,
  });

export const cancelEarlyRecall = (
  earlyRecallId: string,
  cancellationReason: string,
): Promise<EarlyRecallMutationResponse> =>
  invokeWorkflow<EarlyRecallMutationResponse>({
    action: 'cancel',
    earlyRecallId,
    cancellationReason,
  });
