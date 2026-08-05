import type {
  SupabaseClient,
} from "npm:@supabase/supabase-js@2.97.0";
import bcrypt from "npm:bcryptjs@2.4.3";

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

type EmployeeManagementAction =
  | "master_data"
  | "list"
  | "create"
  | "update"
  | "set_active"
  | "reset_password";

interface EmployeeManagementBody {
  action?: unknown;
  operationKey?: unknown;

  search?: unknown;
  includeInactive?: unknown;

  employeeId?: unknown;
  employeeCode?: unknown;
  employeeName?: unknown;
  employeeType?: unknown;
  email?: unknown;
  phone?: unknown;
  department?: unknown;
  section?: unknown;
  jobTitle?: unknown;
  joinDate?: unknown;
  pointOfHire?: unknown;

  rosterCode?: unknown;
  siteLocationId?: unknown;
  plannedD1?: unknown;

  isActive?: unknown;
  remarks?: unknown;
}

type JsonRecord = Record<string, unknown>;

class EmployeeManagementError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 400,
    code = "EMPLOYEE_MANAGEMENT_ERROR",
  ) {
    super(message);
    this.name = "EmployeeManagementError";
    this.status = status;
    this.code = code;
  }
}

const FUNCTION_NAME = "employee-management";
const ALLOWED_METHODS = "POST, OPTIONS";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPLOYEE_CODE_PATTERN = /^[0-9]{7}$/;
const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_ROLES: UserRole[] = [
  "HR",
  "SUPER_ADMIN",
];

const ALLOWED_ROSTERS = new Set([
  "4:2",
  "5:2",
  "6:2",
  "8:2",
  "10:2",
]);

const ALLOWED_EMPLOYEE_TYPES = new Set([
  "EMPLOYEE",
  "VISITOR",
]);

function requestId(): string {
  return crypto.randomUUID();
}

function getAction(
  value: unknown,
): EmployeeManagementAction {
  const action =
    typeof value === "string"
      ? value.trim()
      : "";

  const supported = new Set<
    EmployeeManagementAction
  >([
    "master_data",
    "list",
    "create",
    "update",
    "set_active",
    "reset_password",
  ]);

  if (
    !supported.has(
      action as EmployeeManagementAction,
    )
  ) {
    throw new EmployeeManagementError(
      "Action Employee Management tidak valid.",
      400,
      "INVALID_ACTION",
    );
  }

  return action as EmployeeManagementAction;
}

function assertRole(role: string): void {
  if (
    !ALLOWED_ROLES.includes(
      role as UserRole,
    )
  ) {
    throw new EmployeeManagementError(
      "Hanya HR dan Super Admin yang dapat mengelola employee.",
      403,
      "FORBIDDEN",
    );
  }
}

function optionalString(
  value: unknown,
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0
    ? trimmed
    : null;
}

function requireString(
  value: unknown,
  label: string,
  maximumLength = 500,
): string {
  const parsed = optionalString(value);

  if (!parsed) {
    throw new EmployeeManagementError(
      `${label} wajib diisi.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  if (parsed.length > maximumLength) {
    throw new EmployeeManagementError(
      `${label} maksimal ${maximumLength} karakter.`,
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
  const parsed = requireString(
    value,
    label,
    50,
  );

  if (!UUID_PATTERN.test(parsed)) {
    throw new EmployeeManagementError(
      `${label} tidak valid.`,
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
  const parsed = requireString(
    value,
    label,
    10,
  );

  if (
    !DATE_PATTERN.test(parsed) ||
    Number.isNaN(
      Date.parse(`${parsed}T00:00:00Z`),
    )
  ) {
    throw new EmployeeManagementError(
      `${label} harus menggunakan format YYYY-MM-DD.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function requireEmployeeCode(
  value: unknown,
): string {
  const code = requireString(
    value,
    "Employee ID",
    7,
  );

  if (!EMPLOYEE_CODE_PATTERN.test(code)) {
    throw new EmployeeManagementError(
      "Employee ID wajib tepat 7 digit angka.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return code;
}

function requireEmail(
  value: unknown,
): string {
  const email = requireString(
    value,
    "Email",
    200,
  ).toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new EmployeeManagementError(
      "Format email tidak valid.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return email;
}

function requireEmployeeType(
  value: unknown,
): string {
  const type = requireString(
    value,
    "Employee Type",
    30,
  ).toUpperCase();

  if (!ALLOWED_EMPLOYEE_TYPES.has(type)) {
    throw new EmployeeManagementError(
      "Employee Type harus EMPLOYEE atau VISITOR.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return type;
}

function requireRosterCode(
  value: unknown,
): string {
  const code = requireString(
    value,
    "Roster",
    10,
  );

  if (!ALLOWED_ROSTERS.has(code)) {
    throw new EmployeeManagementError(
      "Roster harus 4:2, 5:2, 6:2, 8:2, atau 10:2.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return code;
}

function requirePhone(
  value: unknown,
): string {
  const phone = requireString(
    value,
    "Nomor WhatsApp",
    30,
  );

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 8) {
    throw new EmployeeManagementError(
      "Nomor WhatsApp minimal 8 digit.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return phone;
}

function requireBoolean(
  value: unknown,
  label: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new EmployeeManagementError(
      `${label} wajib berupa boolean.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return value;
}

function normalizeOperationKey(
  value: unknown,
  action: EmployeeManagementAction,
): string {
  const provided = optionalString(value);

  if (provided) {
    if (provided.length > 200) {
      throw new EmployeeManagementError(
        "Operation key maksimal 200 karakter.",
        400,
        "VALIDATION_ERROR",
      );
    }

    return provided;
  }

  return [
    "EMPLOYEE_MANAGEMENT",
    action.toUpperCase(),
    crypto.randomUUID(),
  ].join(":");
}

function randomIndex(
  maximumExclusive: number,
): number {
  if (
    !Number.isInteger(maximumExclusive) ||
    maximumExclusive <= 0
  ) {
    throw new Error(
      "Invalid random-index boundary.",
    );
  }

  const maximumUint32 = 0xffffffff;
  const usableRange =
    maximumUint32 -
    (maximumUint32 % maximumExclusive);

  const buffer = new Uint32Array(1);

  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= usableRange);

  return buffer[0] % maximumExclusive;
}

function chooseCharacter(
  characters: string,
): string {
  return characters[
    randomIndex(characters.length)
  ];
}

function shuffleCharacters(
  characters: string[],
): string[] {
  const output = [...characters];

  for (
    let index = output.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      randomIndex(index + 1);

    [
      output[index],
      output[swapIndex],
    ] = [
      output[swapIndex],
      output[index],
    ];
  }

  return output;
}

function generateTemporaryPassword(): string {
  const uppercase =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase =
    "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all =
    uppercase +
    lowercase +
    digits +
    symbols;

  const output = [
    chooseCharacter(uppercase),
    chooseCharacter(lowercase),
    chooseCharacter(digits),
    chooseCharacter(symbols),
  ];

  while (output.length < 14) {
    output.push(
      chooseCharacter(all),
    );
  }

  return shuffleCharacters(output).join("");
}

function rpcStatus(
  code?: string,
): number {
  if (code === "23505") return 409;
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "55000") return 409;
  return 400;
}

async function runRpc<T>(
  admin: SupabaseClient,
  functionName: string,
  args: JsonRecord,
): Promise<T> {
  const { data, error } =
    await admin.rpc(
      functionName,
      args,
    );

  if (error) {
    throw new EmployeeManagementError(
      error.message ||
        "Employee Management gagal diproses.",
      rpcStatus(error.code),
      error.code ||
        "DATABASE_ERROR",
    );
  }

  return data as T;
}

function commonProfileArguments(
  body: EmployeeManagementBody,
): JsonRecord {
  return {
    p_employee_name:
      requireString(
        body.employeeName,
        "Nama employee",
        200,
      ),
    p_employee_type:
      requireEmployeeType(
        body.employeeType,
      ),
    p_email: requireEmail(
      body.email,
    ),
    p_phone: requirePhone(
      body.phone,
    ),
    p_department:
      requireString(
        body.department,
        "Department",
        200,
      ),
    p_section:
      optionalString(body.section),
    p_job_title:
      requireString(
        body.jobTitle,
        "Job Title",
        200,
      ),
    p_join_date:
      requireDate(
        body.joinDate,
        "Date of Hire",
      ),
    p_point_of_hire:
      optionalString(
        body.pointOfHire,
      ),
    p_roster_code:
      requireRosterCode(
        body.rosterCode,
      ),
    p_site_location_id:
      requireUuid(
        body.siteLocationId,
        "Site",
      ),
    p_planned_d1:
      requireDate(
        body.plannedD1,
        "D1",
      ),
  };
}

Deno.serve(
  async (req: Request) => {
    const currentRequestId =
      requestId();

    if (req.method === "OPTIONS") {
      return jsonResponse(
        req,
        200,
        {
          success: true,
          requestId:
            currentRequestId,
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
          message:
            "Method tidak diizinkan.",
          requestId:
            currentRequestId,
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
          message:
            "Origin tidak diizinkan.",
          requestId:
            currentRequestId,
        },
        ALLOWED_METHODS,
      );
    }

    try {
      const admin =
        createAdminClient(
          FUNCTION_NAME,
        );

      const context =
        await authenticateSession(
          req,
          admin,
          { touch: true },
        );

      if (
        context.user
          .must_change_password === true
      ) {
        throw new EmployeeManagementError(
          "Ubah temporary password sebelum menggunakan Employee Management.",
          403,
          "PASSWORD_CHANGE_REQUIRED",
        );
      }

      assertRole(context.user.role);

      const body =
        (await req.json()) as
          EmployeeManagementBody;

      const action =
        getAction(body.action);

      if (action === "master_data") {
        const masterData =
          await runRpc<JsonRecord>(
            admin,
            "get_employee_management_master_data",
            {
              p_actor_user_id:
                context.user.id,
            },
          );

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId:
              currentRequestId,
            masterData,
          },
          ALLOWED_METHODS,
        );
      }

      if (action === "list") {
        const records =
          await runRpc<JsonRecord>(
            admin,
            "list_employee_management_records",
            {
              p_actor_user_id:
                context.user.id,
              p_search:
                optionalString(
                  body.search,
                ),
              p_include_inactive:
                body.includeInactive ===
                undefined
                  ? true
                  : requireBoolean(
                      body.includeInactive,
                      "Include inactive",
                    ),
            },
          );

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId:
              currentRequestId,
            ...records,
          },
          ALLOWED_METHODS,
        );
      }

      if (action === "create") {
        const operationKey =
          normalizeOperationKey(
            body.operationKey,
            action,
          );

        const employeeCode =
          requireEmployeeCode(
            body.employeeCode,
          );

        const temporaryPassword =
          generateTemporaryPassword();

        const passwordHash =
          await bcrypt.hash(
            temporaryPassword,
            10,
          );

        const result =
          await runRpc<JsonRecord>(
            admin,
            "create_employee_onboarding",
            {
              p_actor_user_id:
                context.user.id,
              p_operation_key:
                operationKey,
              p_employee_code:
                employeeCode,
              ...commonProfileArguments(
                body,
              ),
              p_password_hash:
                passwordHash,
            },
          );

        if (result.idempotent === true) {
          throw new EmployeeManagementError(
            "Permintaan create sudah pernah diproses. Lakukan Reset Password untuk menghasilkan temporary password baru.",
            409,
            "IDEMPOTENT_CREATE_REPLAY",
          );
        }

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId:
              currentRequestId,
            result,
            credentials: {
              username:
                employeeCode,
              temporaryPassword,
              shownOnce: true,
              mustChangePassword:
                true,
            },
          },
          ALLOWED_METHODS,
        );
      }

      if (action === "update") {
        const result =
          await runRpc<JsonRecord>(
            admin,
            "update_employee_management",
            {
              p_actor_user_id:
                context.user.id,
              p_operation_key:
                normalizeOperationKey(
                  body.operationKey,
                  action,
                ),
              p_employee_id:
                requireUuid(
                  body.employeeId,
                  "Employee",
                ),
              ...commonProfileArguments(
                body,
              ),
            },
          );

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId:
              currentRequestId,
            result,
          },
          ALLOWED_METHODS,
        );
      }

      if (action === "set_active") {
        const result =
          await runRpc<JsonRecord>(
            admin,
            "set_employee_management_active",
            {
              p_actor_user_id:
                context.user.id,
              p_operation_key:
                normalizeOperationKey(
                  body.operationKey,
                  action,
                ),
              p_employee_id:
                requireUuid(
                  body.employeeId,
                  "Employee",
                ),
              p_is_active:
                requireBoolean(
                  body.isActive,
                  "Status aktif",
                ),
              p_remarks:
                requireString(
                  body.remarks,
                  "Remarks",
                  1000,
                ),
            },
          );

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId:
              currentRequestId,
            result,
          },
          ALLOWED_METHODS,
        );
      }

      if (
        action === "reset_password"
      ) {
        const operationKey =
          normalizeOperationKey(
            body.operationKey,
            action,
          );

        const temporaryPassword =
          generateTemporaryPassword();

        const passwordHash =
          await bcrypt.hash(
            temporaryPassword,
            10,
          );

        const result =
          await runRpc<JsonRecord>(
            admin,
            "reset_employee_temporary_password",
            {
              p_actor_user_id:
                context.user.id,
              p_operation_key:
                operationKey,
              p_employee_id:
                requireUuid(
                  body.employeeId,
                  "Employee",
                ),
              p_password_hash:
                passwordHash,
              p_remarks:
                requireString(
                  body.remarks,
                  "Remarks",
                  1000,
                ),
            },
          );

        if (result.idempotent === true) {
          throw new EmployeeManagementError(
            "Reset password dengan operation key ini sudah pernah diproses. Jalankan reset password baru.",
            409,
            "IDEMPOTENT_PASSWORD_RESET_REPLAY",
          );
        }

        return jsonResponse(
          req,
          200,
          {
            success: true,
            action,
            requestId:
              currentRequestId,
            result,
            credentials: {
              username:
                result.username,
              temporaryPassword,
              shownOnce: true,
              mustChangePassword:
                true,
            },
          },
          ALLOWED_METHODS,
        );
      }

      const exhaustive: never =
        action;

      throw new EmployeeManagementError(
        `Unsupported action: ${exhaustive}`,
      );
    } catch (error) {
      if (
        error instanceof
        SessionAuthError
      ) {
        return jsonResponse(
          req,
          error.status,
          {
            success: false,
            code: error.code,
            message: error.message,
            requestId:
              currentRequestId,
          },
          ALLOWED_METHODS,
        );
      }

      if (
        error instanceof
        EmployeeManagementError
      ) {
        return jsonResponse(
          req,
          error.status,
          {
            success: false,
            code: error.code,
            message: error.message,
            requestId:
              currentRequestId,
          },
          ALLOWED_METHODS,
        );
      }

      console.error(
        `[${FUNCTION_NAME}] unhandled error`,
        {
          requestId:
            currentRequestId,
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
          code: "UNHANDLED_ERROR",
          message:
            "Employee Management gagal diproses.",
          requestId:
            currentRequestId,
        },
        ALLOWED_METHODS,
      );
    }
  },
);
