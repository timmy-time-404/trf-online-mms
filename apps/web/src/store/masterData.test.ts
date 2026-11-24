// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/api/client', () => ({ apiRequest: request }));
import { useAuthStore, useTRFStore, useDashboardStore } from './index';
import { useNotificationStore } from './notificationStore';
import type { Notification } from '@/types';
const user = { id: 'admin', username: 'admin', email: 'admin@example.invalid', role: 'SUPER_ADMIN' as const };
const notification: Notification = { id: 'n1', userId: 'admin', title: 'Title', message: 'Note', isRead: false, createdAt: '2026-11-24T00:00:00Z' };
beforeEach(() => {
  vi.resetAllMocks(); useAuthStore.getState().login(user);
});
describe('master data API adapters', () => {
  it('returns the one-time password without storing it in business state', async () => {
    request.mockResolvedValue({ user, temporaryPassword: 'test-once-only' });
    expect(await useTRFStore.getState().createUser({ ...user })).toBe('test-once-only');
    expect(useTRFStore.getState().users).toEqual([user]);
    expect(JSON.stringify(useTRFStore.getState())).not.toContain('test-once-only');
  });
  it('uses soft-deactivation and enable endpoints', async () => {
    request.mockResolvedValue({ ...user, is_active: false });
    await useTRFStore.getState().deleteUser('other');
    expect(request).toHaveBeenCalledWith('/users/other', { method: 'DELETE' });
    await useTRFStore.getState().enableUser('other');
    expect(request).toHaveBeenCalledWith('/users/other/enable', { method: 'POST' });
  });
  it('encodes location filters without trusting query syntax in a keyword', async () => {
    request.mockResolvedValue([]);
    await useTRFStore.getState().searchLocations('A&B?', 'CITY');
    expect(request).toHaveBeenCalledWith('/locations?keyword=A%26B%3F&type=CITY');
  });
  it('ignores a stale user-list response after logout', async () => {
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(new Promise((done) => { resolve = done; }));
    const pending = useTRFStore.getState().fetchUsers();
    useAuthStore.getState().invalidateSession(); resolve([user]); await pending;
    expect(useTRFStore.getState().users).toEqual([]);
  });
  it('loads server-scoped statistics and clears them when the session ends', async () => {
    const stats = { totalTravelIn: 3, totalTravelOut: 2, siteEntry: 0, onSiteActive: 1, daysInSite: 2 };
    request.mockImplementation((path: string) => Promise.resolve(path === '/dashboard/stats' ? stats : []));
    await useDashboardStore.getState().fetchDashboardStats({ ...user, role: 'GA' });
    expect(useDashboardStore.getState().stats).toEqual(stats);
    expect(request).toHaveBeenCalledWith('/dashboard/stats');
    useAuthStore.getState().invalidateSession();
    expect(useDashboardStore.getState().stats.totalTravelIn).toBe(0);
  });
});
describe('private notification adapter', () => {
  it('loads only the session endpoint and counts unread items', async () => {
    request.mockResolvedValue([notification]);
    await useNotificationStore.getState().fetchNotifications('ignored-client-user');
    expect(request).toHaveBeenCalledWith('/notifications');
    expect(useNotificationStore.getState().unreadCount()).toBe(1);
  });
  it('does not falsely mark an item read when the server rejects it', async () => {
    useNotificationStore.setState({ notifications: [notification] });
    request.mockRejectedValue(new Error('404'));
    await expect(useNotificationStore.getState().markAsRead('n1')).rejects.toThrow('404');
    expect(useNotificationStore.getState().unreadCount()).toBe(1);
  });
  it('does not restore old notifications after switching sessions', async () => {
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(new Promise((done) => { resolve = done; }));
    const pending = useNotificationStore.getState().fetchNotifications(user.id);
    useAuthStore.getState().invalidateSession(); resolve([notification]); await pending;
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });
});
