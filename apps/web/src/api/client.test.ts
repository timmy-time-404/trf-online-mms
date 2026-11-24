// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, ApiError } from './client';
import { APP_SESSION_INVALID_EVENT } from '@/lib/appSession';

afterEach(() => vi.unstubAllGlobals());
describe('API transport', () => {
  it('sends cookies and JSON to the same origin', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'created' }));
    vi.stubGlobal('fetch', fetcher);
    expect(await apiRequest('/trfs', { method: 'POST', body: { test: true } })).toEqual({ id: 'created' });
    expect(fetcher).toHaveBeenCalledWith('/api/trfs', expect.objectContaining({
      method: 'POST', credentials: 'include', body: '{"test":true}',
    }));
  });
  it('invalidates the session on 401 and retains the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Sesi berakhir.' }, { status: 401 })));
    const listener = vi.fn();
    window.addEventListener(APP_SESSION_INVALID_EVENT, listener, { once: true });
    await expect(apiRequest('/trfs')).rejects.toMatchObject({ status: 401, message: 'Sesi berakhir.' });
    expect(listener).toHaveBeenCalledOnce();
  });
  it('handles a non-JSON gateway failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
    await expect(apiRequest('/trfs')).rejects.toBeInstanceOf(ApiError);
  });
});
