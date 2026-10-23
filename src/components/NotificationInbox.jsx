import { useState } from 'react';
import { api } from '../api/endpoints.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime } from '../lib/format.js';
import { useToast } from './Toast.jsx';
import { Button, EmptyState, ErrorNotice, IconButton, Loading } from './ui.jsx';

// Notifications of the signed-in account (GET /api/notifications/me), for members and staff.
// Clicking a message marks it as read.
export default function NotificationInbox() {
  const toast = useToast();
  const rows = useApi(() => api.notifications.mine(), []);
  const [busy, setBusy] = useState(false);
  const run = async (action) => {
    setBusy(true);
    try {
      await action();
      rows.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const markAll = () => run(() => api.notifications.markAllRead());
  const markOne = (n) => !n.isRead && run(() => api.notifications.markRead(n.id));
  const remove = (n) => run(() => api.notifications.remove(n.id));

  if (rows.loading) return <Loading />;
  const list = rows.data ?? [];
  const unread = list.filter((n) => !n.isRead).length;
  return (
    <div className="inbox">
      <ErrorNotice error={rows.error} onRetry={rows.reload} />
      <div className="panel-bar">
        <p className="muted">{unread ? `${unread} unread` : 'All caught up'}</p>
        <Button variant="secondary" size="sm" onClick={markAll} disabled={!unread || busy}>
          Mark all as read
        </Button>
      </div>
      {list.length ? (
        <ul className="notif-list">
          {list.map((n) => (
            <li key={n.id} className={`notif ${n.isRead ? '' : 'notif--unread'}`}>
              <button
                type="button"
                onClick={() => markOne(n)}
                className="notif__btn"
                disabled={busy}
                title={n.isRead ? undefined : 'Mark as read'}
              >
                <span className="notif__dot" aria-hidden="true" />
                <span>
                  <span className="notif__title">{n.title}</span>
                  <span className="notif__msg">{n.message}</span>
                  <span className="muted notif__time">{formatDateTime(n.createdAt)}</span>
                </span>
              </button>
              <IconButton icon="trash" label={`Delete “${n.title}”`} onClick={() => remove(n)} disabled={busy} />
            </li>
          ))}
        </ul>
      ) : (
        !rows.error && (
          <EmptyState title="No notifications">
            Messages from the center — schedule changes, reminders — show up here.
          </EmptyState>
        )
      )}
    </div>
  );
}
