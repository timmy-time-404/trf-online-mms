import { create } from 'zustand';
import { apiRequest } from '@/api/client';
import type { Notification } from '@/types';

interface NotificationState {
  notifications: Notification[];
  isLoading: boolean;
  unreadCount: () => number;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  reset: () => void;
}
let version = 0;
export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [], isLoading: false,
  unreadCount: () => get().notifications.filter((item) => !item.isRead).length,
  reset: () => { version++; set({ notifications: [], isLoading: false }); },
  fetchNotifications: async (userId) => {
    if (!userId) return;
    const current = ++version;
    set({ isLoading: true });
    try {
      const notifications = await apiRequest<Notification[]>('/notifications');
      if (current === version) set({ notifications });
    } catch (error) { console.error('Fetch notifications failed:', error); }
    finally { if (current === version) set({ isLoading: false }); }
  },
  markAsRead: async (id) => {
    const current = version;
    const notification = await apiRequest<Notification>('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' });
    if (current === version) set((state) => ({ notifications: state.notifications.map((item) => item.id === id ? notification : item) }));
  },
  markAllAsRead: async (userId) => {
    if (!userId) return;
    const current = version;
    await apiRequest('/notifications/read-all', { method: 'POST' });
    if (current === version) set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, isRead: true })) }));
  },
}));
