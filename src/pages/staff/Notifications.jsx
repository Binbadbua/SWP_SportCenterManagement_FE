import { useState } from "react";
import { api } from "../../api/endpoints.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { audit } from "../../lib/audit.js";
import { AccountRole } from "../../lib/enums.js";
import { useToast } from "../../components/Toast.jsx";
import NotificationInbox from "../../components/NotificationInbox.jsx";
import { Button, ErrorNotice, Field } from "../../components/ui.jsx";

// Every staff member reads their own notifications here; the center manager can also send them
// (POST /api/notifications takes a list of account IDs).
const AUDIENCES = [
  { value: "role:1", label: "All members" },
  { value: "role:2", label: "All coaches" },
  { value: "role:3", label: "All receptionists" },
  { value: "all", label: "Everyone" },
  { value: "one", label: "One account…" },
];

export default function StaffNotifications() {
  const { user } = useAuth();
  const isManager = user?.role === "CenterManager";
  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Notifications</h1>
          <p className="muted">
            {isManager
              ? "Send a message to members or staff, and read the ones sent to you."
              : "Messages sent to your account."}
          </p>
        </div>
      </header>
      {isManager ? (
        <div className="two-col">
          <SendPanel />
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

function SendPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const accounts = useApi(() => api.accounts.list(), []);
  const [v, setV] = useState({ audience: "role:1", accountId: "", title: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));

  const active = (accounts.data ?? []).filter((a) => a.status === 1);
  const recipients =
    v.audience === "all"
      ? active
      : v.audience === "one"
        ? active.filter((a) => a.id === v.accountId)
        : active.filter((a) => `role:${a.role}` === v.audience);

  const send = async (e) => {
    e.preventDefault();
    const found = {};
    if (v.audience === "one" && !v.accountId) found.accountId = "Pick an account.";
    else if (!recipients.length) found.audience = "There is no active account in this group.";
    if (!v.title.trim()) found.title = "Enter a title.";
    if (!v.message.trim()) found.message = "Enter a message.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSending(true);
    try {
      await api.notifications.send({
        accountIds: recipients.map((a) => a.id),
        title: v.title.trim(),
        message: v.message.trim(),
      });
      const count = `${recipients.length} ${recipients.length === 1 ? "account" : "accounts"}`;
      const to =
        v.audience === "one"
          ? recipients[0].fullName || recipients[0].username
          : AUDIENCES.find((a) => a.value === v.audience)?.label;
      audit(
        user,
        "SEND_NOTIFICATION",
        `Sent “${v.title.trim()}” to ${to} (${count})\nMessage: ${v.message.trim().replace(/\s+/g, " ")}`,
      );
      toast.success(`Sent to ${count}.`);
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
      <ErrorNotice error={accounts.error} onRetry={accounts.reload} />
      <Field
        label="Send to"
        name="audience"
        type="select"
        value={v.audience}
        onChange={set}
        options={AUDIENCES}
        error={errors.audience}
        help={
          accounts.loading
            ? "Loading accounts…"
            : `${recipients.length} active ${recipients.length === 1 ? "account" : "accounts"}`
        }
      />
      {v.audience === "one" && (
        <Field
          label="Account"
          name="accountId"
          type="select"
          value={v.accountId}
          onChange={set}
          error={errors.accountId}
          options={active.map((a) => ({
            value: a.id,
            label: `${a.fullName || a.username} · ${AccountRole.label(a.role)}`,
          }))}
        />
      )}
      <Field label="Title" name="title" required value={v.title} onChange={set} error={errors.title} />
      <Field
        label="Message"
        name="message"
        type="textarea"
        required
        value={v.message}
        onChange={set}
        error={errors.message}
      />
      <Button type="submit" disabled={sending || accounts.loading}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
