import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { apiRequest } from '../services/api';
import type { NotificationOut } from '../types/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageHeader,
  useToast,
} from '../components/ui';

export function NotificationsPage() {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'list', unreadOnly],
    queryFn: () => apiRequest<NotificationOut[]>(`/api/notifications?unread_only=${unreadOnly}`),
  });

  const handleMarkRead = async (id: number) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleMarkAllRead = async () => {
    const res = await apiRequest<{ marked_read: number }>('/api/notifications/mark-all-read', { method: 'POST' });
    notify(`Marked ${res.marked_read} notification(s) as read.`);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications & Reminders"
        subtitle="Follow-up reminders, request assignments, and supervisory escalations directed to your account."
        actions={
          <>
            <label className="inline-flex items-center gap-2 rounded-lg border border-[#DBE2EF] bg-white px-3 py-2 text-xs font-medium">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              Unread only
            </label>
            <Button size="sm" variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </Button>
          </>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          description="No notifications match the current filter."
        />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${
                n.is_read ? 'opacity-75' : 'border-l-4 border-l-[#3F72AF]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Bell className="h-4 w-4 text-[#3F72AF]" />
                  <span className="text-sm font-bold text-[#112D4E]">{n.title}</span>
                  <Badge tone={n.severity === 'critical' ? 'red' : n.severity === 'warning' ? 'amber' : 'blue'}>
                    {n.category}
                  </Badge>
                  {!n.is_read && <Badge tone="navy">New</Badge>}
                </div>
                <p className="text-xs text-[#112D4E]/80">{n.message}</p>
                <div className="text-[11px] text-[#112D4E]/55">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.is_read && (
                <Button size="sm" variant="outline" onClick={() => void handleMarkRead(n.id)}>
                  Mark Read
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
