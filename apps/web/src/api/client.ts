import { toast } from 'sonner';
import { APP_SESSION_INVALID_EVENT } from '@/lib/appSession';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.name = 'ApiError'; this.status = status; }
}
export const apiRequest = async <T>(path: string, options: { method?: string; body?: unknown; version?: number; idempotencyKey?: string } = {}): Promise<T> => {
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  if (!/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(base) || !/^\/[a-zA-Z0-9]/.test(path)) throw new ApiError(500, 'Konfigurasi API tidak valid.');
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET', credentials: 'include',
    headers: { Accept: 'application/json', ...(options.version===undefined ? {} : { 'If-Match': `"${options.version}"` }),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      // FormData sets its own multipart boundary header.
      ...(options.body === undefined || options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event(APP_SESSION_INVALID_EVENT));
    if (path.startsWith('/trfs') && response.status===409) toast.error('Data sudah diubah orang lain, muat ulang.');
    else if (response.status===400 && typeof payload?.message==='string') toast.error(payload.message);
    throw new ApiError(response.status, typeof payload?.message === 'string' ? payload.message : 'Permintaan gagal. Silakan coba kembali.');
  }
  return payload as T;
};
