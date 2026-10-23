import { useState } from "react";
import { api } from "../../api/endpoints.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { AccountRole } from "../../lib/enums.js";
import { useToast } from "../../components/Toast.jsx";
import NotificationInbox from "../../components/NotificationInbox.jsx";
import { Button, ErrorNotice, Field } from "../../components/ui.jsx";

// Every staff member reads their own notifications here. The center manager can send to anyone;
// a coach to the members booked into their classes, e.g. homework or a change of plan
// (POST /api/notifications takes a list of account IDs and refuses a coach's send to anyone else).
const MANAGER_AUDIENCES = [
  { value: "role:1", label: "All members" },
  { value: "role:2", label: "All coaches" },
  { value: "role:3", label: "All receptionists" },
  { value: "all", label: "Everyone" },
  { value: "one", label: "One account…" },
];

export default function StaffNotifications() {
  const { user } = useAuth();
  const canSend = user?.role === "CenterManager" || user?.role === "Coach";
  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Notifications</h1>
          <p className="muted">
            {user?.role === "CenterManager"
              ? "Send a message to members or staff, and read the ones sent to you."
              : user?.role === "Coach"
                ? "Send homework or news to the members in your classes, and read the messages sent to you."
                : "Messages sent to your account."}
          </p>
        </div>
      </header>
      {canSend ? (
        <div className="two-col">
          {user.role === "Coach" ? <CoachSendPanel /> : <ManagerSendPanel />}
          <section className="panel">
            <h2 className="panel-title">Your inbox</h2>
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
      audiences={[
        { value: "all", label: "All my members" },
        ...classes.map(([id, name]) => ({ value: `class:${id}`, label: `Members of ${name}` })),
        { value: "one", label: "One member…" },
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

function SendForm({ audiences, people, recipientsFor, loading, error, onRetry }) {
  const toast = useToast();
  const [v, setV] = useState({ audience: audiences[0].value, accountId: "", title: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));
  const recipients = recipientsFor(v.audience, v.accountId);

  const send = async (e) => {
    e.preventDefault();
    const found = {};
    if (v.audience === "one" && !v.accountId) found.accountId = "Pick a person.";
    else if (!recipients.length) found.audience = "There is no active account in this group.";
    if (!v.title.trim()) found.title = "Enter a title.";
    if (!v.message.trim()) found.message = "Enter a message.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSending(true);
    try {
      await api.notifications.send({ accountIds: recipients, title: v.title.trim(), message: v.message.trim() });
      toast.success(`Sent to ${recipients.length} ${recipients.length === 1 ? "account" : "accounts"}.`);
      setV((s) => ({ ...s, title: "", message: "" }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="panel" onSubmit={send} noValidate>
      <h2 className="panel-title">Send a notification</h2>
      <ErrorNotice error={error} onRetry={onRetry} />
      <Field
        label="Send to"
        name="audience"
        type="select"
        value={v.audience}
        onChange={set}
        options={audiences}
        error={errors.audience}
        help={loading ? "Loading people…" : `${recipients.length} active ${recipients.length === 1 ? "account" : "accounts"}`}
      />
      {v.audience === "one" && (
        <Field
          label="Person"
          name="accountId"
          type="select"
          value={v.accountId}
          onChange={set}
          error={errors.accountId}
          options={people}
        />
      )}
      <Field label="Title" name="title" required value={v.title} onChange={set} error={errors.title} />
      <Field label="Message" name="message" type="textarea" required value={v.message} onChange={set} error={errors.message} />
      <Button type="submit" disabled={sending || loading}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
