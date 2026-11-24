import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuthStore } from '@/store';
import { useNotificationStore } from '@/store/notificationStore';
import { cn } from '@/lib/utils';

const timeAgo = (dateString: string): string => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();

  useEffect(() => {
    if (!currentUser?.id) return;

    fetchNotifications(currentUser.id);

    // Polling ringan agar notifikasi baru (mis. dari HR/GA) muncul tanpa reload
    const interval = setInterval(() => {
      fetchNotifications(currentUser.id);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser?.id, fetchNotifications]);

  if (!currentUser) return null;

  const unread = unreadCount();

  const handleNotificationClick = (id: string, trfId?: string) => {
    markAsRead(id);
    if (trfId) navigate(`/trf/${trfId}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-500">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">Notifikasi</h3>
          {unread > 0 && (
            <button
              onClick={() => markAllAsRead(currentUser.id)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tandai semua dibaca
            </button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              Belum ada notifikasi
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n.id, n.trfId)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3',
                    !n.isRead && 'bg-blue-50/60',
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        !n.isRead ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400',
                      )}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm leading-snug',
                        !n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700',
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
