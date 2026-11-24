import { apiRequest } from '@/api/client';
import type { User, UserRole } from '@/types';

/**
 * Login session against the TRF API. The session lives in an HttpOnly cookie
 * (ADR-0006); JavaScript never sees or stores the token.
 */

/** Token key used by the old Supabase build; only removed, never written. */
const LEGACY_SESSION_STORAGE_KEY = 'trf-app-session-token';

export const APP_SESSION_INVALID_EVENT = 'trf-app-session-invalid';

let invalidSessionEventQueued = false;

/** One global event when the API rejects the session; App.tsx then returns to login. */
const dispatchInvalidAppSessionEvent = (): void => {
  if (typeof window === 'undefined' || invalidSessionEventQueued) return;
  invalidSessionEventQueued = true;
  window.dispatchEvent(new Event(APP_SESSION_INVALID_EVENT));
  // Parallel requests that all receive 401 trigger a single logout.
  window.setTimeout(() => { invalidSessionEventQueued = false; }, 0);
};

interface AppSessionApiUser {
  id: string;
  username: string;
  email: string;
  role: string;
  employeeId?: string;
  department?: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

interface SessionResponse { user: AppSessionApiUser; expiresAt?: string }
interface ChangePasswordResponse { success: boolean; user: AppSessionApiUser }

export class AppSessionApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AppSessionApiError';
    this.status = status;
  }
}

const toUser = (apiUser: AppSessionApiUser): User => ({
  id: apiUser.id,
  username: apiUser.username,
  email: apiUser.email,
  role: apiUser.role as UserRole,
  employeeId: apiUser.employeeId,
  department: apiUser.department,
  is_active: apiUser.isActive,
  mustChangePassword: apiUser.mustChangePassword,
});

const apiBase = () => import.meta.env.VITE_API_BASE_URL || '/api';

async function requestAuth<T>(path: string, body?: unknown): Promise<T> {
  const base = apiBase();
  // Same-origin path only, so the session cookie is never sent to another host.
  if (!/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(base)) {
    throw new AppSessionApiError('API harus menggunakan path pada domain aplikasi.', 500);
  }
  const response = await fetch(`${base}/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== 'login') dispatchInvalidAppSessionEvent();
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message : 'Request gagal.';
    throw new AppSessionApiError(message, response.status);
  }
  return payload as T;
}

const toSession = (response: SessionResponse) => {
  if (!response.expiresAt) throw new AppSessionApiError('Expiry sesi tidak tersedia.', 500);
  return { user: toUser(response.user), expiresAt: response.expiresAt };
};

/** Removes the token an older build may have left in localStorage. */
export const clearAppSessionToken = (): void => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
};

export const loginWithAppSession = async (username: string, password: string) => {
  clearAppSessionToken();
  return toSession(await requestAuth<SessionResponse>('login', { username, password }));
};

export const getCurrentAppSession = async () => toSession(await requestAuth<SessionResponse>('me'));

export const logoutAppSession = async (): Promise<void> => {
  try { await requestAuth('logout', {}); } finally { clearAppSessionToken(); }
};

export const changeAppPassword = async (currentPassword: string, newPassword: string): Promise<User> => {
  const response = await apiRequest<ChangePasswordResponse>('/auth/change-password', {
    method: 'POST', body: { currentPassword, newPassword },
  });
  return toUser(response.user);
};
