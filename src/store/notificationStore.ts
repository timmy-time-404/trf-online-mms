// Notification Store - handles in-app notifications
// (e.g. HR/GA sending a note to an employee when they edit & approve a TRF)

import { create } from 'zustand';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import type { Notification } from '@/types';

interface DBNotificationRow {
  id: string;
  user_id: string;
  trf_id?: string | null;
  trf_number?: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

const transformNotificationFromDB = (row: DBNotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  trfId: row.trf_id ?? undefined,
  trfNumber: row.trf_number ?? undefined,
  title: row.title,
  message: row.message,
  isRead: row.is_read,
  createdBy: row.created_by ?? undefined,
  createdByName: row.created_by_name ?? undefined,
  createdAt: row.created_at,
});

export interface CreateNotificationInput {
  userId: string;
  trfId?: string;
  trfNumber?: string;
  title: string;
  message: string;
  createdBy?: string;
  createdByName?: string;
}

interface NotificationState {
  notifications: Notification[];
  isLoading: boolean;

  unreadCount: () => number;
  fetchNotifications: (userId: string) => Promise<void>;
  createNotification: (input: CreateNotificationInput) => Promise<boolean>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  isLoading: false,

  unreadCount: () => get().notifications.filter((n) => !n.isRead).length,

  fetchNotifications: async (userId: string) => {
    if (!isSupabaseEnabled() || !userId) return;
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Fetch notifications error:', error);
        return;
      }

      const rows = (data as DBNotificationRow[]) || [];
      set({ notifications: rows.map(transformNotificationFromDB) });
    } finally {
      set({ isLoading: false });
    }
  },

  createNotification: async (input: CreateNotificationInput) => {
    if (!isSupabaseEnabled()) return false;
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: input.userId,
        trf_id: input.trfId ?? null,
        trf_number: input.trfNumber ?? null,
        title: input.title,
        message: input.message,
        is_read: false,
        created_by: input.createdBy ?? null,
        created_by_name: input.createdByName ?? null,
      });

      if (error) {
        console.error('Create notification error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Create notification error:', err);
      return false;
    }
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    }));

    if (!isSupabaseEnabled()) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) console.error('Mark as read error:', error);
  },

  markAllAsRead: async (userId: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }));

    if (!isSupabaseEnabled() || !userId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) console.error('Mark all as read error:', error);
  },
}));
