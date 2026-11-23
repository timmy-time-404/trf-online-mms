import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
describe('standalone cookie session adapter', () => {
  it('logs in without requiring or storing a JavaScript session token', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      user: { id: 'test-user', username: 'superadmin', role: 'SUPER_ADMIN', isActive: true, mustChangePassword: false },
      expiresAt: '2026-12-01T00:00:00.000Z',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const session = await import('./appSession');
    expect((await session.loginWithAppSession('superadmin', 'test-password')).user.role).toBe('SUPER_ADMIN');
    expect(session.getStoredAppSessionToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ credentials: 'same-origin', method: 'POST' }));
    const options = fetchMock.mock.calls[0]?.[1];
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.headers).not.toHaveProperty('X-App-Session');
    await session.logoutAppSession();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });
  it.each(['https://untrusted.example/api', '//untrusted/api'])('rejects cross-origin API %s before sending credentials', async (apiUrl) => {
    vi.stubEnv('VITE_API_BASE_URL', apiUrl);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const session = await import('./appSession');
    await expect(session.loginWithAppSession('admin', 'test-password')).rejects.toThrow('domain aplikasi');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
