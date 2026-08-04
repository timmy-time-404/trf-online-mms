import { createClient, type SupabaseClient } from "supabase";

export type JsonRecord = Record<string, unknown>;

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  last_used_at: string;
  created_at: string;
  updated_at: string;
  metadata: JsonRecord;
}

export interface SessionUserRow {
  id: string;
  username: string;
  email: string;
  role: string;
  employee_id: string | null;
  department: string | null;
  is_active: boolean | null;
  must_change_password: boolean | null;
}

export interface SessionContext {
  session: SessionRow;
  user: SessionUserRow;
  tokenHash: string;
}

export class SessionAuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SessionAuthError";
    this.status = status;
    this.code = code;
  }
}

const SESSION_TOKEN_PATTERN = /^trf_[A-Za-z0-9_-]{43}$/;
const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getServiceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;

  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (rawSecretKeys) {
    const parsed = JSON.parse(rawSecretKeys) as Record<string, string>;

    const defaultKey = parsed.default?.trim();
    if (defaultKey) return defaultKey;

    const firstKey = Object.values(parsed).find(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

    if (firstKey) return firstKey.trim();
  }

  throw new Error(
    "No Supabase service key is available in Edge Function secrets.",
  );
}

export function createAdminClient(functionName: string): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), getServiceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": `${functionName}/1.0`,
      },
    },
  });
}

export function getAllowedOrigins(): Set<string> {
  const configured = Deno.env.get("APP_ALLOWED_ORIGINS")?.trim();

  const defaults = [
    "https://meong-mms.id",
    "https://www.meong-mms.id",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];

  return new Set(
    (configured ? configured.split(",") : defaults)
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || getAllowedOrigins().has(origin);
}

export function corsHeaders(
  req: Request,
  allowedMethods: string,
): HeadersInit {
  const origin = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-app-session",
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export function jsonResponse(
  req: Request,
  status: number,
  body: JsonRecord,
  allowedMethods: string,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(corsHeaders(req, allowedMethods));

  if (extraHeaders) {
    const additional = new Headers(extraHeaders);
    additional.forEach((value, key) => headers.set(key, value));
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function extractSessionToken(req: Request): string {
  const token = req.headers.get("x-app-session")?.trim();

  if (!token || !SESSION_TOKEN_PATTERN.test(token)) {
    throw new SessionAuthError(
      401,
      "INVALID_SESSION",
      "Sesi tidak valid atau telah berakhir.",
    );
  }

  return token;
}
export async function sha256Hex(value: string): Promise<string> {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function loadSessionByHash(
  admin: SupabaseClient,
  tokenHash: string,
): Promise<SessionRow | null> {
  const { data, error } = await admin
    .from("app_sessions")
    .select(
      "id, user_id, expires_at, revoked_at, revoke_reason, last_used_at, created_at, updated_at, metadata",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(`Session lookup failed: ${error.message}`);
  }

  return data as SessionRow | null;
}

async function loadUser(
  admin: SupabaseClient,
  userId: string,
): Promise<SessionUserRow | null> {
  const { data, error } = await admin
    .from("users")
    .select(
      "id, username, email, role, employee_id, department, is_active, must_change_password",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Session user lookup failed: ${error.message}`);
  }

  return data as SessionUserRow | null;
}

async function revokeInactiveUserSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await admin
    .from("app_sessions")
    .update({
      revoked_at: now,
      revoke_reason: "ACCOUNT_INACTIVE",
      updated_at: now,
    })
    .eq("id", sessionId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(
      `Unable to revoke inactive-account session: ${error.message}`,
    );
  }
}

async function touchSession(
  admin: SupabaseClient,
  session: SessionRow,
): Promise<SessionRow> {
  const lastUsedTime = Date.parse(session.last_used_at);
  const shouldTouch =
    !Number.isFinite(lastUsedTime) ||
    Date.now() - lastUsedTime >= LAST_USED_TOUCH_INTERVAL_MS;

  if (!shouldTouch) return session;

  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("app_sessions")
    .update({
      last_used_at: now,
      updated_at: now,
    })
    .eq("id", session.id)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .select(
      "id, user_id, expires_at, revoked_at, revoke_reason, last_used_at, created_at, updated_at, metadata",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to touch session: ${error.message}`);
  }

  if (!data) {
    throw new SessionAuthError(
      401,
      "INVALID_SESSION",
      "Sesi tidak valid atau telah berakhir.",
    );
  }

  return data as SessionRow;
}

export async function authenticateSession(
  req: Request,
  admin: SupabaseClient,
  options?: {
    touch?: boolean;
  },
): Promise<SessionContext> {
  const rawToken = extractSessionToken(req);
  const tokenHash = await sha256Hex(rawToken);
  const session = await loadSessionByHash(admin, tokenHash);

  if (!session) {
    throw new SessionAuthError(
      401,
      "INVALID_SESSION",
      "Sesi tidak valid atau telah berakhir.",
    );
  }

  if (session.revoked_at) {
    throw new SessionAuthError(
      401,
      "SESSION_REVOKED",
      "Sesi tidak valid atau telah berakhir.",
    );
  }

  const expiresAt = Date.parse(session.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new SessionAuthError(
      401,
      "SESSION_EXPIRED",
      "Sesi tidak valid atau telah berakhir.",
    );
  }

  const user = await loadUser(admin, session.user_id);

  if (!user || user.is_active !== true) {
    await revokeInactiveUserSession(admin, session.id);

    throw new SessionAuthError(
      401,
      "ACCOUNT_INACTIVE",
      "Sesi tidak valid atau telah berakhir.",
    );
  }

  const activeSession =
    options?.touch === false
      ? session
      : await touchSession(admin, session);

  return {
    session: activeSession,
    user,
    tokenHash,
  };
}

