import { useState } from "react";
import { api } from "../../api/endpoints.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { AccountRole } from "../../lib/enums.js";
import { formatDate, todayCenterDateString } from "../../lib/format.js";
import { HOMEWORK_PREFIX } from "../../lib/homework.js";
import { useToast } from "../../components/Toast.jsx";
import NotificationInbox from "../../components/NotificationInbox.jsx";
import { Button, ErrorNotice, Field } from "../../components/ui.jsx";

// Every staff member reads their own notifications here. The center manager can send to anyone;
// a coach to the members booked into their classes, e.g. homework or a change of plan
// (POST /api/notifications takes a list of account IDs and refuses a coach's send to anyone else).
const MANAGER_AUDIENCES = [
  { value: "role:1", label: "Tất cả học viên" },
  { value: "role:2", label: "Tất cả huấn luyện viên" },
  { value: "role:3", label: "Tất cả lễ tân" },
  { value: "all", label: "Mọi người" },
  { value: "one", label: "Một tài khoản…" },
];

export default function StaffNotifications() {
  const { user } = useAuth();
  const canSend = user?.role === "CenterManager" || user?.role === "Coach";
  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Thông báo</h1>
          <p className="muted">
            {user?.role === "CenterManager"
              ? "Gửi tin cho học viên hoặc nhân viên, và đọc các tin gửi tới bạn."
              : user?.role === "Coach"
                ? "Gửi bài tập hoặc tin tức cho học viên trong lớp của bạn, và đọc các tin gửi tới bạn."
                : "Các tin nhắn gửi tới tài khoản của bạn."}
          </p>
        </div>
      </header>
      {canSend ? (
        <div className="two-col">
          {user.role === "Coach" ? <CoachSendPanel /> : <ManagerSendPanel />}
          <section className="panel">
            <h2 className="panel-title">Hộp thư của bạn</h2>
            <NotificationInbox />
          </section>
        </div>
      ) : (
        <NotificationInbox />
      )}
    </div>
  );
}

function ManagerSendPanel() {
  const accounts = useApi(() => api.accounts.list(), []);
  const active = (accounts.data ?? []).filter((a) => a.status === 1);
  return (
    <SendForm
      audiences={MANAGER_AUDIENCES}
      loading={accounts.loading}
      error={accounts.error}
      onRetry={accounts.reload}
      people={active.map((a) => ({ value: a.id, label: `${a.fullName || a.username} · ${AccountRole.label(a.role)}` }))}
      recipientsFor={(audience, one) =>
        audience === "all"
          ? active.map((a) => a.id)
          : audience === "one"
            ? active.filter((a) => a.id === one).map((a) => a.id)
            : active.filter((a) => `role:${a.role}` === audience).map((a) => a.id)
      }
    />
  );
}

// The coach's members carry no account ID, so it is read from the member list (staff may read it)
function CoachSendPanel() {
  const roster = useApi(async () => {
    const [booked, members] = await Promise.all([api.coaches.members(), api.members.list()]);
    return { booked, members };
  }, []);
  const accountOf = new Map((roster.data?.members ?? [])
    .filter((m) => !m.accountStatus || m.accountStatus === 1)
    .map((m) => [m.id, m.accountId]));
  // One row per member and class they booked; only active accounts can receive
  const booked = (roster.data?.booked ?? []).filter((b) => accountOf.has(b.memberId));
  const classes = [...new Map(booked.map((b) => [b.classId, b.className])).entries()];
  const people = [...new Map(booked.map((b) => [b.memberId, b])).values()]
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
  return (
    <SendForm
      homework
      audiences={[
        { value: "all", label: "Tất cả học viên của tôi" },
        ...classes.map(([id, name]) => ({ value: `class:${id}`, label: `Học viên lớp ${name}` })),
        { value: "one", label: "Một học viên…" },
      ]}
      loading={roster.loading}
      error={roster.error}
      onRetry={roster.reload}
      people={people.map((p) => ({ value: p.memberId, label: p.fullName }))}
      recipientsFor={(audience, one) => {
        const rows = audience === "all"
          ? booked
          : audience === "one"
            ? booked.filter((b) => b.memberId === one)
            : booked.filter((b) => `class:${b.classId}` === audience);
        return [...new Set(rows.map((b) => accountOf.get(b.memberId)))];
      }}
    />
  );
}

// `homework` (coaches): the message may be homework, sent as a notification whose title carries
// HOMEWORK_PREFIX (lib/homework.js) and whose last line is the due date. Every message is signed with its sender
// (lib/notifications.js), since the API keeps none.
function SendForm({ audiences, people, recipientsFor, loading, error, onRetry, homework = false }) {
  const toast = useToast();
  const { user } = useAuth();
  const [v, setV] = useState({ audience: audiences[0].value, accountId: "", kind: "notice", due: "", title: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));
  const recipients = recipientsFor(v.audience, v.accountId);
  const isHomework = homework && v.kind === "homework";

  const send = async (e) => {
    e.preventDefault();
    const found = {};
    if (v.audience === "one" && !v.accountId) found.accountId = "Vui lòng chọn người nhận.";
    else if (!recipients.length) found.audience = "Nhóm này không có tài khoản nào đang hoạt động.";
    if (!v.title.trim()) found.title = "Vui lòng nhập tiêu đề.";
    if (!v.message.trim()) found.message = "Vui lòng nhập nội dung.";
    if (isHomework && v.due && v.due < todayCenterDateString()) found.due = "Hạn hoàn thành phải từ hôm nay trở đi.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const title = isHomework ? `${HOMEWORK_PREFIX}${v.title.trim()}` : v.title.trim();
    const message = isHomework && v.due
      ? `${v.message.trim()}\n\nHạn hoàn thành: ${formatDate(v.due)}`
      : v.message.trim();
    setSending(true);
    try {
      await api.notifications.send({ accountIds: recipients, title, message });
      toast.success(isHomework
        ? `Đã giao bài tập cho ${recipients.length} học viên.`
        : `Đã gửi tới ${recipients.length} tài khoản.`);
      setV((s) => ({ ...s, title: "", message: "", due: "" }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="panel" onSubmit={send} noValidate>
      <h2 className="panel-title">{homework ? "Gửi thông báo hoặc bài tập" : "Gửi thông báo"}</h2>
      <ErrorNotice error={error} onRetry={onRetry} />
      {homework && (
        <Field
          label="Loại tin"
          name="kind"
          type="select"
          value={v.kind}
          onChange={set}
          placeholder="Chọn loại tin…"
          options={[
            { value: "notice", label: "Thông báo" },
            { value: "homework", label: "Bài tập về nhà" },
          ]}
          help={isHomework ? "Học viên thấy tin này với nhãn “Bài tập về nhà” trong hộp thư." : undefined}
        />
      )}
      <Field
        label="Gửi tới"
        name="audience"
        type="select"
        value={v.audience}
        onChange={set}
        options={audiences}
        error={errors.audience}
        help={loading ? "Đang tải danh sách…" : `${recipients.length} tài khoản đang hoạt động`}
      />
      {v.audience === "one" && (
        <Field
          label="Người nhận"
          name="accountId"
          type="select"
          value={v.accountId}
          onChange={set}
          error={errors.accountId}
          options={people}
        />
      )}
      <Field
        label={isHomework ? "Tên bài tập" : "Tiêu đề"}
        name="title"
        required
        value={v.title}
        onChange={set}
        error={errors.title}
        placeholder={isHomework ? "Ví dụ: 3 hiệp plank 45 giây" : undefined}
      />
      <Field
        label={isHomework ? "Hướng dẫn" : "Nội dung"}
        name="message"
        type="textarea"
        required
        value={v.message}
        onChange={set}
        error={errors.message}
      />
      {isHomework && (
        <Field
          label="Hạn hoàn thành"
          name="due"
          type="date"
          min={todayCenterDateString()}
          value={v.due}
          onChange={set}
          error={errors.due}
          help="Không bắt buộc. Ghi ở cuối nội dung tin."
        />
      )}
      <Button type="submit" disabled={sending || loading}>
        {sending ? "Đang gửi…" : isHomework ? "Giao bài tập" : "Gửi"}
      </Button>
    </form>
  );
}
