import type {
  SupabaseClient,
} from "npm:@supabase/supabase-js@2.97.0";

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

type ManpowerDashboardAction =
  | "snapshot";

interface ManpowerDashboardBody {
  action?: unknown;
  asOfDate?: unknown;
}

type JsonRecord = Record<string, unknown>;

class ManpowerDashboardError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 400,
    code = "MANPOWER_DASHBOARD_ERROR",
  ) {
    super(message);
    this.name = "ManpowerDashboardError";
    this.status = status;
    this.code = code;
  }
}

const FUNCTION_NAME = "manpower-dashboard";
const ALLOWED_METHODS = "POST, OPTIONS";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_ROLES: UserRole[] = [
  "HOD",
  "HR",
  "PM",
  "SUPER_ADMIN",
];

function requestId(): string {
  return crypto.randomUUID();
}

function getAction(
  value: unknown,
): ManpowerDashboardAction {
  if (value !== "snapshot") {
    throw new ManpowerDashboardError(
      "Action Manpower Dashboard tidak valid.",
      400,
      "INVALID_ACTION",
    );
  }

  return "snapshot";
}

function assertRole(role: string): void {
  if (
    !ALLOWED_ROLES.includes(
      role as UserRole,
    )
  ) {
    throw new ManpowerDashboardError(
      "Role Anda tidak memiliki akses ke Manpower Dashboard.",
      403,
      "FORBIDDEN",
    );
  }
}

function requireDate(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !DATE_PATTERN.test(value)
  ) {
    throw new ManpowerDashboardError(
      "As of Date harus menggunakan format YYYY-MM-DD.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const parsed = Date.parse(
    `${value}T00:00:00Z`,
  );

  if (!Number.isFinite(parsed)) {
    throw new ManpowerDashboardError(
      "As of Date tidak valid.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return value;
}

function rpcStatus(code?: string): number {
  if (code === "42501") return 403;
  if (code === "22023") return 400;
  if (code === "P0002") return 404;
  return 500;
}

async function loadSnapshot(
  admin: SupabaseClient,
  actorUserId: string,
  asOfDate: string,
): Promise<JsonRecord> {
  const { data, error } = await admin.rpc(
    "get_manpower_dashboard_snapshot",
    {
      p_actor_user_id: actorUserId,
      p_as_of_date: asOfDate,
    },
  );

  if (error) {
    throw new ManpowerDashboardError(
      error.message ||
        "Gagal mengambil snapshot Manpower Dashboard.",
      rpcStatus(error.code),
      error.code || "DATABASE_ERROR",
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new ManpowerDashboardError(
      "Respons snapshot Manpower Dashboard tidak valid.",
      500,
      "INVALID_DATABASE_RESPONSE",
    );
  }

  return data as JsonRecord;
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
        throw new ManpowerDashboardError(
          "Ubah temporary password sebelum membuka Manpower Dashboard.",
          403,
          "PASSWORD_CHANGE_REQUIRED",
        );
      }

      assertRole(context.user.role);

      const body =
        (await req.json()) as
          ManpowerDashboardBody;

      const action = getAction(
        body.action,
      );

      const asOfDate = requireDate(
        body.asOfDate,
      );

      const snapshot =
        await loadSnapshot(
          admin,
          context.user.id,
          asOfDate,
        );

      return jsonResponse(
        req,
        200,
        {
          success: true,
          action,
          requestId:
            currentRequestId,
          snapshot,
        },
        ALLOWED_METHODS,
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
        ManpowerDashboardError
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
            "Manpower Dashboard gagal diproses.",
          requestId:
            currentRequestId,
        },
        ALLOWED_METHODS,
      );
    }
  },
);
