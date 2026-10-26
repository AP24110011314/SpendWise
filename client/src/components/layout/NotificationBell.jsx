import { useState, useEffect } from 'react';
import { Bell, Check, Mail } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';
import { createPortal } from 'react-dom';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notificationsData, refetch } = useQuery({
    queryKey: ['notifications', 'list', { unread: true, limit: 20 }],
    queryFn: () => notificationsApi.list({ unread: true, limit: 20 }),
    refetchInterval: 30000,
  });

  const notifications = Array.isArray(notificationsData)
    ? notificationsData
    : (notificationsData?.data || []);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleMarkRead = (id, e) => {
    e.stopPropagation();
    markReadMutation.mutate(id);
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    markAllReadMutation.mutate();
  };

  const dropdownContent = open ? (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/10 dark:bg-black/30 backdrop-blur-[1px]"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="fixed right-4 sm:right-6 top-16 w-80 sm:w-96 bg-white dark:bg-[#453a2d] rounded-xl border border-gray-200 dark:border-[#786144] shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#786144] bg-gray-50/70 dark:bg-[#3d3327]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFDF7]">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-[#F9E6A8] dark:border dark:border-[#CC6F00]/50">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-[#F2A900] dark:hover:text-[#F9E6A8] transition-colors disabled:opacity-50"
              disabled={markAllReadMutation.isPending}
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-[#786144]/60">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-[#bfa87c] text-sm">
              <Mail className="w-8 h-8 text-gray-300 dark:text-[#786144] mx-auto mb-2" />
              No notifications
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[#786144]/60" role="list" aria-label="Notifications">
              {notifications.map((notification) => {
                const id = notification._id || notification.id;
                const isUnread = !notification.readAt;
                return (
                  <li
                    key={id}
                    className={`px-4 py-3 transition-colors ${
                      isUnread
                        ? 'bg-amber-50/50 dark:bg-[#3d3327]/80'
                        : 'hover:bg-gray-50 dark:hover:bg-[#554737]/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mt-0.5 border border-amber-300 dark:border-[#CC6F00]/40">
                        <Mail className="w-4 h-4 text-amber-700 dark:text-[#F2A900]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isUnread ? 'font-medium text-gray-900 dark:text-[#FFFDF7]' : 'text-gray-600 dark:text-[#decaa0]'}`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-[#bfa87c] mt-1">
                          {notification.createdAt ? new Date(notification.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : ''}
                        </p>
                      </div>
                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkRead(id, e)}
                          className="p-1 text-gray-400 hover:text-amber-600 dark:text-[#bfa87c] dark:hover:text-[#F2A900] rounded transition-colors"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-[#F9E6A8] dark:hover:bg-[#554737] dark:hover:text-[#F2A900] transition-colors"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#F2A900] to-[#CC6F00] text-[#1e170e] text-xs font-bold rounded-full flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {createPortal(dropdownContent, document.body)}
    </div>
  );
}