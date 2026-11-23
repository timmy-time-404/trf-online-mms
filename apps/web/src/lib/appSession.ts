import type {
  User,
  UserRole,
} from '@/types';

const SESSION_STORAGE_KEY =
  'trf-app-session-token';

export const APP_SESSION_INVALID_EVENT =
  'trf-app-session-invalid';

let invalidSessionEventQueued = false;

/**
 * Mengirim satu event global ketika application session
 * ditolak oleh backend.
 *
 * App.tsx menggunakan event ini untuk membersihkan Zustand
 * auth state dan mengarahkan pengguna ke halaman login.
 */
const dispatchInvalidAppSessionEvent =
  (): void => {
    if (
      typeof window === 'undefined' ||
      invalidSessionEventQueued
    ) {
      return;
    }

    invalidSessionEventQueued = true;

    window.dispatchEvent(
      new Event(
        APP_SESSION_INVALID_EVENT,
      ),
    );

    /*
     * Lock hanya berlaku pada event loop saat ini agar beberapa
     * request paralel yang sama-sama menerima 401 tidak memicu
     * logout dan redirect berulang kali.
     */
    window.setTimeout(() => {
      invalidSessionEventQueued = false;
    }, 0);
  };

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

interface AppSessionEnvelope {
  id?: string;
  token?: string;
  expiresAt?: string;
}

interface LoginResponse {
  success?: boolean;

  /*
   * Kontrak backend production terbaru:
   * response.session.token
   * response.session.expiresAt
   */
  session?: AppSessionEnvelope;

  /*
   * Backward compatibility untuk kontrak lama.
   */
  sessionToken?: string;
  expiresAt?: string;

  user: AppSessionApiUser;
}

interface SessionResponse {
  success?: boolean;
  session?: AppSessionEnvelope;
  expiresAt?: string;
  user: AppSessionApiUser;
}

interface ChangePasswordResponse {
  success: boolean;
  user: AppSessionApiUser;
}

export class AppSessionApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
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

const getApiErrorMessage = (
  payload: unknown,
): string => {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return 'Request gagal.';
  }

  if (
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  if (
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return 'Request gagal.';
};

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
    throw new AppSessionApiError(
      getApiErrorMessage(payload),
      response.status,
    );
  }

  return payload as T;
};

export const getStoredAppSessionToken =
  (): string | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    const value =
      window.localStorage.getItem(
        SESSION_STORAGE_KEY,
      );

    if (
      !value ||
      value === 'undefined' ||
      value === 'null' ||
      value === '[object Object]'
    ) {
      return null;
    }

    return value;
  };

export const storeAppSessionToken = (
  token: string,
): void => {
  if (
    typeof window === 'undefined'
  ) {
    return;
  }

  if (
    !token ||
    typeof token !== 'string'
  ) {
    throw new AppSessionApiError(
      'Token sesi dari server tidak valid.',
      500,
    );
  }

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

  /*
   * Jangan kirim stale X-App-Session ke app-login.
   * Header hanya dikirim untuk endpoint yang benar-benar
   * membutuhkan application session.
   */
  const shouldAttachSession =
    options.requireSession === true &&
    Boolean(sessionToken);

  const response = await fetch(
    getFunctionUrl(functionName),
    {
      method: options.method ?? 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization:
          `Bearer ${supabaseAnonKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(shouldAttachSession &&
        sessionToken
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

  if (
    response.status === 401 &&
    shouldAttachSession
  ) {
    clearAppSessionToken();
    dispatchInvalidAppSessionEvent();
  }

  return parseResponse<T>(response);
};

export const loginWithAppSession = async (
  username: string,
  password: string,
): Promise<{
  user: User;
  expiresAt: string;
}> => {
  /*
   * Token lama tidak boleh ikut terbawa saat login baru.
   */
  clearAppSessionToken();

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

  const sessionToken =
    response.session?.token ??
    response.sessionToken;

  const expiresAt =
    response.session?.expiresAt ??
    response.expiresAt;

  if (
    !sessionToken ||
    typeof sessionToken !== 'string'
  ) {
    throw new AppSessionApiError(
      'Respons login tidak memiliki session token yang valid.',
      500,
    );
  }

  if (
    !expiresAt ||
    typeof expiresAt !== 'string'
  ) {
    throw new AppSessionApiError(
      'Respons login tidak memiliki session expiry yang valid.',
      500,
    );
  }

  storeAppSessionToken(
    sessionToken,
  );

  return {
    user: toUser(response.user),
    expiresAt,
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

      const expiresAt =
        response.session?.expiresAt ??
        response.expiresAt;

      if (
        !expiresAt ||
        typeof expiresAt !== 'string'
      ) {
        throw new AppSessionApiError(
          'Respons validasi sesi tidak memiliki expiry yang valid.',
          500,
        );
      }

      return {
        user: toUser(response.user),
        expiresAt,
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
 * Generic helper untuk Edge Function yang menggunakan
 * custom application session melalui X-App-Session.
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
