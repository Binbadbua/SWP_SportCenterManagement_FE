import { useState } from 'react';
import { api } from '../api/endpoints.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime } from '../lib/format.js';
import { isHomework, withoutHomeworkPrefix } from '../lib/homework.js';
import { readNotification } from '../lib/notifications.js';
import { useToast } from './Toast.jsx';
import { Button, EmptyState, ErrorNotice, IconButton, Loading, StatusTag } from './ui.jsx';

// Notifications of the signed-in account (GET /api/notifications/me), for members and staff, each with its sender
// (lib/notifications.js). Clicking a message marks it as read.
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
        <p className="muted">{unread ? `${unread} chưa đọc` : 'Đã đọc hết'}</p>
        <Button variant="secondary" size="sm" onClick={markAll} disabled={!unread || busy}>
          Đánh dấu đã đọc tất cả
        </Button>
      </div>
      {list.length ? (
        <ul className="notif-list">
          {list.map((n) => ({ n, ...readNotification(n) })).map(({ n, sender, message }) => (
            <li key={n.id} className={`notif ${n.isRead ? '' : 'notif--unread'}`}>
              <button
                type="button"
                onClick={() => markOne(n)}
                className="notif__btn"
                disabled={busy}
                title={n.isRead ? undefined : 'Đánh dấu đã đọc'}
              >
                <span className="notif__dot" aria-hidden="true" />
                <span>
                  <span className="notif__title">
                    {isHomework(n) ? (
                      <>
                        <StatusTag tone="info">Bài tập về nhà</StatusTag>
                        {withoutHomeworkPrefix(n.title)}
                      </>
                    ) : (
                      n.title
                    )}
                  </span>
                  <span className="notif__msg">{message}</span>
                  <span className="muted notif__time">
                    Từ <span className="notif__from">{sender}</span> · {formatDateTime(n.createdAt)}
                  </span>
                </span>
              </button>
              <IconButton icon="trash" label={`Xóa “${n.title}”`} onClick={() => remove(n)} disabled={busy} />
            </li>
          ))}
        </ul>
      ) : (
        !rows.error && (
          <EmptyState title="Chưa có thông báo">
            Tin từ trung tâm — đổi lịch, nhắc lịch — sẽ hiện ở đây.
          </EmptyState>
        )
      )}
    </div>
  );
}
