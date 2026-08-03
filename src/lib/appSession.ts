import type {
  User,
  UserRole,
} from '@/types';

const SESSION_STORAGE_KEY =
  'trf-app-session-token';

export const APP_SESSION_INVALID_EVENT =
  'trf-app-session-invalid';

let invalidSessionEventDispatched = false;

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

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

interface LoginResponse {
  sessionToken: string;
  expiresAt: string;
  user: AppSessionApiUser;
}

interface SessionResponse {
  expiresAt: string;
  user: AppSessionApiUser;
}

interface ChangePasswordResponse {
  success: boolean;
  user: AppSessionApiUser;
}

export class AppSessionApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AppSessionApiError';
    this.status = status;
  }
}

const assertEnvironment = (): void => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AppSessionApiError(
      'Supabase environment variables are missing.',
      500,
    );
  }
};

const getFunctionUrl = (
  functionName: string,
): string => {
  assertEnvironment();

  return `${supabaseUrl}/functions/v1/${functionName}`;
};

const toUser = (
  apiUser: AppSessionApiUser,
): User => ({
  id: apiUser.id,
  username: apiUser.username,
  email: apiUser.email,
  role: apiUser.role as UserRole,
  employeeId: apiUser.employeeId,
  department: apiUser.department,
  is_active: apiUser.isActive,
  mustChangePassword:
    apiUser.mustChangePassword,
});

const parseResponse = async <T>(
  response: Response,
): Promise<T> => {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Request gagal.';

    throw new AppSessionApiError(
      message,
      response.status,
    );
  }

  return payload as T;
};

const notifyInvalidAppSession = (): void => {
  clearAppSessionToken();

  if (
    typeof window === 'undefined' ||
    invalidSessionEventDispatched
  ) {
    return;
  }

  invalidSessionEventDispatched = true;

  window.dispatchEvent(
    new Event(APP_SESSION_INVALID_EVENT),
  );
};

const requestFunction = async <T>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    requireSession?: boolean;
  } = {},
): Promise<T> => {
  assertEnvironment();

  const sessionToken =
    getStoredAppSessionToken();

  if (
    options.requireSession &&
    !sessionToken
  ) {
    throw new AppSessionApiError(
      'Sesi tidak tersedia.',
      401,
    );
  }

  const response = await fetch(
    getFunctionUrl(functionName),
    {
      method: options.method ?? 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        ...(sessionToken
          ? {
              'X-App-Session':
                sessionToken,
            }
          : {}),
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    },
  );

  /*
   * Semua 401 dari endpoint yang mewajibkan X-App-Session
   * berarti session aplikasi tidak lagi dapat digunakan.
   * Bersihkan token dan beri tahu auth store tepat satu kali
   * agar request paralel tidak memicu logout/redirect berulang.
   */
  if (
    options.requireSession &&
    response.status === 401
  ) {
    notifyInvalidAppSession();
  }

  return parseResponse<T>(response);
};

export const getStoredAppSessionToken =
  (): string | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(
      SESSION_STORAGE_KEY,
    );
  };

export const storeAppSessionToken = (
  token: string,
): void => {
  invalidSessionEventDispatched = false;

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    token,
  );
};

export const clearAppSessionToken =
  (): void => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(
      SESSION_STORAGE_KEY,
    );
  };

export const loginWithAppSession = async (
  username: string,
  password: string,
): Promise<{
  user: User;
  expiresAt: string;
}> => {
  const response =
    await requestFunction<LoginResponse>(
      'app-login',
      {
        body: {
          username,
          password,
        },
      },
    );

  storeAppSessionToken(
    response.sessionToken,
  );

  return {
    user: toUser(response.user),
    expiresAt: response.expiresAt,
  };
};

export const getCurrentAppSession =
  async (): Promise<{
    user: User;
    expiresAt: string;
  }> => {
    try {
      const response =
        await requestFunction<SessionResponse>(
          'app-session',
          {
            requireSession: true,
          },
        );

      return {
        user: toUser(response.user),
        expiresAt: response.expiresAt,
      };
    } catch (error) {
      if (
        error instanceof AppSessionApiError &&
        error.status === 401
      ) {
        clearAppSessionToken();
      }

      throw error;
    }
  };

export const logoutAppSession =
  async (): Promise<void> => {
    const token =
      getStoredAppSessionToken();

    if (!token) {
      clearAppSessionToken();
      return;
    }

    try {
      await requestFunction<{
        success: boolean;
      }>('app-logout', {
        requireSession: true,
      });
    } finally {
      clearAppSessionToken();
    }
  };

export const changeAppPassword = async (
  newPassword: string,
): Promise<User> => {
  const response =
    await requestFunction<ChangePasswordResponse>(
      'app-change-password',
      {
        requireSession: true,
        body: {
          newPassword,
        },
      },
    );

  return toUser(response.user);
};

/**
 * Generic helper for the next Early Recall Edge Function.
 * Actor identity is resolved from X-App-Session on the server.
 */
export const invokeAuthenticatedAppFunction =
  async <TResponse>(
    functionName: string,
    body: unknown,
  ): Promise<TResponse> =>
    requestFunction<TResponse>(
      functionName,
      {
        requireSession: true,
        body,
      },
    );
