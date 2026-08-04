import type { SupabaseClient } from "npm:@supabase/supabase-js@2.97.0";

import {
  authenticateSession,
  createAdminClient,
  isOriginAllowed,
  jsonResponse,
  SessionAuthError,
} from "../_shared/appSessionAuth.ts";

type UserRole =
  | "EMPLOYEE"
  | "ADMIN_DEPT"
  | "HOD"
  | "HR"
  | "PM"
  | "GA"
  | "SUPER_ADMIN";

type RosterAction =
  | "queue"
  | "os_ledger"
  | "confirm_site_out"
  | "confirm_leave_start"
  | "confirm_return"
  | "consume_os";

interface RosterRequestBody {
  action?: unknown;
  asOfDate?: unknown;
  siteCycleId?: unknown;
  actualSiteOut?: unknown;
  actualLeaveStart?: unknown;
  returnToSiteDate?: unknown;
  siteOutTrfId?: unknown;
  siteInTrfId?: unknown;
  employeeId?: unknown;
  requestedDays?: unknown;
  operationKey?: unknown;
  referenceType?: unknown;
  referenceId?: unknown;
  referenceNumber?: unknown;
  remarks?: unknown;
}

interface QueueItem {
  action_code: string;
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

interface OSLedgerRow {
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
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeRow {
  id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  job_title: string;
  is_active: boolean | null;
}

class RosterWorkflowError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status = 400,
    code?: string,
  ) {
    super(message);
    this.name = "RosterWorkflowError";
    this.status = status;
    this.code = code;
  }
}

const FUNCTION_NAME = "roster-operations";
const ALLOWED_METHODS = "POST, OPTIONS";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ACTION_ROLES: Record<
  RosterAction,
  UserRole[]
> = {
  queue: ["GA", "HR", "SUPER_ADMIN"],
  os_ledger: ["HR", "SUPER_ADMIN"],
  confirm_site_out: ["GA", "HR", "SUPER_ADMIN"],
  confirm_leave_start: ["GA", "HR", "SUPER_ADMIN"],
  confirm_return: ["GA", "HR", "SUPER_ADMIN"],
  consume_os: ["HR", "SUPER_ADMIN"],
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getAction(value: unknown): RosterAction {
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(
      ACTION_ROLES,
      value,
    )
  ) {
    throw new RosterWorkflowError(
      "Action Roster & OS tidak valid.",
      400,
      "INVALID_ACTION",
    );
  }

  return value as RosterAction;
}

function assertRole(
  action: RosterAction,
  role: string,
): void {
  if (
    !ACTION_ROLES[action].includes(
      role as UserRole,
    )
  ) {
    throw new RosterWorkflowError(
      "Role Anda tidak memiliki akses untuk tindakan ini.",
      403,
      "FORBIDDEN",
    );
  }
}

function optionalString(
  value: unknown,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireString(
  value: unknown,
  label: string,
): string {
  const parsed = optionalString(value);

  if (!parsed) {
    throw new RosterWorkflowError(
      `${label} wajib diisi.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function optionalUuid(
  value: unknown,
  label: string,
): string | null {
  const parsed = optionalString(value);

  if (!parsed) return null;

  if (!UUID_PATTERN.test(parsed)) {
    throw new RosterWorkflowError(
      `${label} harus berupa UUID yang valid.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function requireUuid(
  value: unknown,
  label: string,
): string {
  const parsed = optionalUuid(value, label);

  if (!parsed) {
    throw new RosterWorkflowError(
      `${label} wajib diisi.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function requireDate(
  value: unknown,
  label: string,
): string {
  const parsed = requireString(value, label);

  if (
    !DATE_PATTERN.test(parsed) ||
    Number.isNaN(
      Date.parse(`${parsed}T00:00:00Z`),
    )
  ) {
    throw new RosterWorkflowError(
      `${label} harus menggunakan format YYYY-MM-DD.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function requirePositiveInteger(
  value: unknown,
  label: string,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    throw new RosterWorkflowError(
      `${label} harus berupa bilangan bulat lebih dari 0.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function databaseErrorStatus(
  code?: string,
): number {
  switch (code) {
    case "42501":
      return 403;

    case "P0002":
      return 404;

    case "22023":
    case "23503":
    case "23514":
    case "55000":
    case "P0001":
      return 400;

    default:
      return 500;
  }
}

async function runRpc(
  admin: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await admin.rpc(
    name,
    parameters,
  );

  if (error) {
    console.error(
      `[${FUNCTION_NAME}] RPC ${name} failed`,
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    throw new RosterWorkflowError(
      error.message ||
        "Operasi database gagal diproses.",
      databaseErrorStatus(error.code),
      error.code,
    );
  }

  if (Array.isArray(data) && data.length === 1) {
    return data[0];
  }

  return data;
}

async function loadQueue(
  admin: SupabaseClient,
  actorUserId: string,
  asOfDate: string,
): Promise<QueueItem[]> {
  const { data, error } = await admin.rpc(
    "get_roster_attention_queue",
    {
      p_actor_user_id: actorUserId,
      p_as_of_date: asOfDate,
    },
  );

  if (error) {
    throw new RosterWorkflowError(
      error.message ||
        "Gagal mengambil attention queue Roster.",
      databaseErrorStatus(error.code),
      error.code,
    );
  }

  return (data ?? []) as QueueItem[];
}

async function loadOSLedger(
  admin: SupabaseClient,
): Promise<Array<
  OSLedgerRow & {
    employee: EmployeeRow | null;
  }
>> {
  const { data: ledgerData, error: ledgerError } =
    await admin
      .from("employee_os_ledger")
      .select(
        "id, os_number, employee_id, source_type, source_reference, generated_date, original_days, remaining_days, used_days, expired_days, cancelled_days, cycle_number, status, remarks, created_at, updated_at",
      )
      .gt("remaining_days", 0)
      .order("generated_date", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      })
      .limit(1000);

  if (ledgerError) {
    throw new RosterWorkflowError(
      "Gagal mengambil saldo OS aktif.",
      500,
      ledgerError.code,
    );
  }

  const ledgerRows =
    (ledgerData ?? []) as OSLedgerRow[];

  const employeeIds = Array.from(
    new Set(
      ledgerRows.map(
        (row) => row.employee_id,
      ),
    ),
  );

  let employees: EmployeeRow[] = [];

  if (employeeIds.length > 0) {
    const { data, error } = await admin
      .from("employees")
      .select(
        "id, employee_code, employee_name, department, job_title, is_active",
      )
      .in("id", employeeIds);

    if (error) {
      throw new RosterWorkflowError(
        "Gagal mengambil identitas employee untuk saldo OS.",
        500,
        error.code,
      );
    }

    employees = (data ?? []) as EmployeeRow[];
  }

  const employeeMap = new Map(
    employees.map((employee) => [
      employee.id,
      employee,
    ]),
  );

  return ledgerRows.map((row) => ({
    ...row,
    employee:
      employeeMap.get(row.employee_id) ??
      null,
  }));
}

Deno.serve(
  async (req: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();

    if (req.method === "OPTIONS") {
      if (!isOriginAllowed(req)) {
        return jsonResponse(
          req,
          403,
          {
            success: false,
            message: "Origin tidak diizinkan.",
            requestId,
          },
          ALLOWED_METHODS,
        );
      }

      return jsonResponse(
        req,
        200,
        {
          success: true,
          requestId,
        },
        ALLOWED_METHODS,
      );
    }

    if (req.method !== "POST") {
      return jsonResponse(
        req,
        405,
        {
          success: false,
          message: "Method tidak diizinkan.",
          requestId,
        },
        ALLOWED_METHODS,
        { Allow: ALLOWED_METHODS },
      );
    }

    if (!isOriginAllowed(req)) {
      return jsonResponse(
        req,
        403,
        {
          success: false,
          message: "Origin tidak diizinkan.",
          requestId,
        },
        ALLOWED_METHODS,
      );
    }

    try {
      const admin = createAdminClient(
        FUNCTION_NAME,
      );

      const context = await authenticateSession(
        req,
        admin,
        { touch: true },
      );

      if (
        context.user.must_change_password ===
        true
      ) {
        throw new RosterWorkflowError(
          "Ubah temporary password sebelum menggunakan Roster & OS.",
          403,
          "PASSWORD_CHANGE_REQUIRED",
        );
      }

      const body =
        (await req.json()) as RosterRequestBody;

      const action = getAction(body.action);
      assertRole(action, context.user.role);

      if (action === "queue") {
        const asOfDate = body.asOfDate
          ? requireDate(
              body.asOfDate,
              "As-of Date",
            )
          : todayIsoDate();

        const items = await loadQueue(
          admin,
          context.user.id,
          asOfDate,
        );

        const counts = items.reduce<
          Record<string, number>
        >((result, item) => {
          result[item.action_code] =
            (result[item.action_code] ?? 0) +
            1;
          return result;
        }, {});

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId,
            asOfDate,
            items,
            total: items.length,
            counts,
          },
          ALLOWED_METHODS,
        );
      }

      if (action === "os_ledger") {
        const items = await loadOSLedger(admin);

        const totalRemainingDays = items.reduce(
          (total, item) =>
            total + item.remaining_days,
          0,
        );

        const employeeCount = new Set(
          items.map((item) => item.employee_id),
        ).size;

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId,
            items,
            total: items.length,
            summary: {
              employeeCount,
              activeBucketCount: items.length,
              totalRemainingDays,
            },
          },
          ALLOWED_METHODS,
        );
      }

      let result: unknown;

      switch (action) {
        case "confirm_site_out":
          result = await runRpc(
            admin,
            "confirm_employee_actual_site_out",
            {
              p_actor_user_id:
                context.user.id,
              p_site_cycle_id: requireUuid(
                body.siteCycleId,
                "Site Cycle ID",
              ),
              p_actual_site_out: requireDate(
                body.actualSiteOut,
                "Actual Site Out",
              ),
              p_site_out_trf_id: optionalUuid(
                body.siteOutTrfId,
                "Site-Out TRF ID",
              ),
              p_remarks: requireString(
                body.remarks,
                "Remarks",
              ),
            },
          );
          break;

        case "confirm_leave_start":
          result = await runRpc(
            admin,
            "confirm_employee_leave_start",
            {
              p_actor_user_id:
                context.user.id,
              p_site_cycle_id: requireUuid(
                body.siteCycleId,
                "Site Cycle ID",
              ),
              p_actual_leave_start: requireDate(
                body.actualLeaveStart,
                "Actual Leave Start",
              ),
              p_remarks: requireString(
                body.remarks,
                "Remarks",
              ),
            },
          );
          break;

        case "confirm_return":
          result = await runRpc(
            admin,
            "confirm_employee_return_to_site",
            {
              p_actor_user_id:
                context.user.id,
              p_site_cycle_id: requireUuid(
                body.siteCycleId,
                "Site Cycle ID",
              ),
              p_return_to_site_date: requireDate(
                body.returnToSiteDate,
                "Return to Site / D1",
              ),
              p_site_in_trf_id: optionalUuid(
                body.siteInTrfId,
                "Site-In TRF ID",
              ),
              p_remarks: requireString(
                body.remarks,
                "Remarks",
              ),
            },
          );
          break;

        case "consume_os":
          result = await runRpc(
            admin,
            "consume_employee_os_fifo",
            {
              p_actor_user_id:
                context.user.id,
              p_employee_id: requireUuid(
                body.employeeId,
                "Employee ID",
              ),
              p_requested_days:
                requirePositiveInteger(
                  body.requestedDays,
                  "Jumlah OS",
                ),
              p_operation_key: requireString(
                body.operationKey,
                "Operation Key",
              ),
              p_reference_type:
                requireString(
                  body.referenceType,
                  "Reference Type",
                ),
              p_reference_id: optionalUuid(
                body.referenceId,
                "Reference ID",
              ),
              p_reference_number:
                optionalString(
                  body.referenceNumber,
                ),
              p_remarks: requireString(
                body.remarks,
                "Remarks",
              ),
            },
          );
          break;

        default: {
          const exhaustive: never = action;
          throw new RosterWorkflowError(
            `Unsupported action: ${exhaustive}`,
          );
        }
      }

      return jsonResponse(
        req,
        200,
        {
          success: true,
          action,
          requestId,
          result,
        },
        ALLOWED_METHODS,
      );
    } catch (error) {
      if (error instanceof SessionAuthError) {
        return jsonResponse(
          req,
          error.status,
          {
            success: false,
            code: error.code,
            message: error.message,
            requestId,
          },
          ALLOWED_METHODS,
        );
      }

      if (
        error instanceof RosterWorkflowError
      ) {
        return jsonResponse(
          req,
          error.status,
          {
            success: false,
            code: error.code,
            message: error.message,
            requestId,
          },
          ALLOWED_METHODS,
        );
      }

      console.error(
        `[${FUNCTION_NAME}] unhandled error`,
        {
          requestId,
          message:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      return jsonResponse(
        req,
        500,
        {
          success: false,
          message:
            "Roster & OS gagal diproses.",
          requestId,
        },
        ALLOWED_METHODS,
      );
    }
  },
);
