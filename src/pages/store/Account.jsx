import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import { preview } from "../../api/previewStore.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { isStaff, useAuth } from "../../context/AuthContext.jsx";
import { sportImage } from "../../lib/images.js";
import {
  AttendanceStatus,
  BookingStatus,
  InvoiceStatus,
  PaymentMethod,
} from "../../lib/enums.js";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
  initials,
  toDateInput,
} from "../../lib/format.js";
import { useToast } from "../../components/Toast.jsx";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  PreviewNotice,
  PreviewTag,
  SampleDataNotice,
  StatusTag,
} from "../../components/ui.jsx";

const TABS = [
  { key: "bookings", label: "Bookings" },
  { key: "attendance", label: "Attendance" },
  { key: "training", label: "Training" },
  { key: "invoices", label: "Invoices" },
  { key: "notifications", label: "Notifications" },
  { key: "profile", label: "Profile" },
];

export default function Account() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab"))
    ? params.get("tab")
    : "bookings";

  if (!user) {
    return (
      <div className="container page">
        <EmptyState
          title="Sign in to see your bookings"
          action={<Button to="/login?next=/account">Sign in</Button>}
        >
          Your classes, attendance and invoices live here.
        </EmptyState>
      </div>
    );
  }
  if (isStaff(user)) {
    return (
      <div className="container page">
        <EmptyState
          title="You’re signed in as staff"
          action={<Button to="/staff">Go to the staff area</Button>}
        >
          Member accounts are for members. Sign out and sign in as a member to
          preview this page.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page account">
      {params.get("welcome") && (
        <Notice tone="success" title={`Welcome, ${user.fullName}`}>
          Your account is ready. Pick a class to book your first session.
        </Notice>
      )}
      <header className="account__head">
        <div className="account__avatar" aria-hidden="true">
          {initials(user.fullName)}
        </div>
        <div>
          <h1 className="account__name">{user.fullName}</h1>
          <p className="muted">{user.email}</p>
        </div>
      </header>

      <nav className="tabs" aria-label="Account sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tabs__btn ${tab === t.key ? "is-active" : ""}`}
            aria-current={tab === t.key ? "page" : undefined}
            onClick={() => setParams({ tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="account__panel">
        {tab === "bookings" && <BookingsTab memberId={user.memberId} />}
        {tab === "attendance" && <AttendanceTab memberId={user.memberId} />}
        {tab === "training" && <TrainingTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "profile" && <ProfileTab />}
      </div>
    </div>
  );
}

/* ---- Bookings (API) ----------------------------------------------------- */
function BookingsTab({ memberId }) {
  const toast = useToast();
  const bookings = useApi(() => api.bookings.byMember(memberId), [memberId], {
    sample: () => mock.bookings.filter((b) => b.memberId === memberId),
  });
  // The booking response has no sport name, so look it up from the class list for the photo
  const classes = useApi(() => api.classes.list(), [], {
    sample: mock.classes,
  });
  const sportOf = (classId) =>
    (classes.data ?? []).find((c) => c.id === classId)?.categoryName;
  const [busyId, setBusyId] = useState(null);

  const cancel = async (b) => {
    if (!window.confirm(`Cancel your booking for ${b.className}?`)) return;
    setBusyId(b.id);
    try {
      await api.bookings.cancel(b.id, memberId);
      toast.success(`Booking for ${b.className} cancelled.`);
      bookings.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (bookings.loading) return <Loading />;
  return (
    <>
      {bookings.usingSample && <SampleDataNotice onRetry={bookings.reload} />}
      <ErrorNotice
        error={!bookings.usingSample ? bookings.error : null}
        onRetry={bookings.reload}
      />
      {!bookings.data?.length ? (
        !bookings.error && (
          <EmptyState
            title="No bookings yet"
            action={<Button to="/classes">Find a class</Button>}
          >
            When you book a class, it shows up here with its start date.
          </EmptyState>
        )
      ) : (
        <ul className="order-list">
          {bookings.data.map((b) => (
            <li key={b.id} className="order">
              <img
                className="order__img"
                src={sportImage(sportOf(b.classId), b.className)}
                alt=""
              />
              <div className="order__main">
                <StatusTag tone={BookingStatus.tone(b.status)}>
                  {BookingStatus.label(b.status)}
                </StatusTag>
                <p className="order__title">{b.className}</p>
                <p className="muted">
                  Starts {formatDate(b.classStartDate)} · booked{" "}
                  {formatDate(b.bookingDate)}
                </p>
              </div>
              <div className="order__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  to={`/classes/${b.classId}`}
                >
                  View class
                </Button>
                {b.status === 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancel(b)}
                    disabled={busyId === b.id}
                  >
                    {busyId === b.id ? "Cancelling…" : "Cancel"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---- Attendance (API) --------------------------------------------------- */
function AttendanceTab({ memberId }) {
  const rows = useApi(() => api.attendance.byMember(memberId), [memberId], {
    sample: () => mock.attendance.filter((a) => a.memberId === memberId),
  });
  if (rows.loading) return <Loading />;
  const list = rows.data ?? [];
  const present = list.filter((a) => a.status !== 2).length;
  return (
    <>
      {rows.usingSample && <SampleDataNotice onRetry={rows.reload} />}
      <ErrorNotice
        error={!rows.usingSample ? rows.error : null}
        onRetry={rows.reload}
      />
      {list.length ? (
        <>
          <p className="stat-line">
            <span className="display stat-line__num">
              {present}/{list.length}
            </span>
            <span className="muted">sessions attended</span>
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Start</th>
                  <th>Checked in</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-strong">{formatDate(a.sessionDate)}</td>
                    <td className="num">{formatTime(a.sessionStartTime)}</td>
                    <td className="num">{formatDateTime(a.checkInTime)}</td>
                    <td>
                      <StatusTag tone={AttendanceStatus.tone(a.status)}>
                        {AttendanceStatus.label(a.status)}
                      </StatusTag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        !rows.error && (
          <EmptyState title="No attendance yet">
            Your coach or reception marks attendance at each session.
          </EmptyState>
        )
      )}
    </>
  );
}

/* ---- Training (preview) ------------------------------------------------- */
function TrainingTab() {
  const plans = useApi(() => api.trainingPlans.list(), []);
  const results = useApi(() => api.trainingResults.list(), []);
  if (plans.loading || results.loading) return <Loading />;
  return (
    <>
      <h2 className="panel-title">Plans from your coach</h2>
      <div className="plan-list">
        {(plans.data ?? []).map((p) => (
          <article key={p.id} className="plan">
            <p className="label muted">
              {p.className} · {formatDate(p.createdDate)}
            </p>
            <h3 className="plan__title">{p.title}</h3>
            <p>{p.contentDescription}</p>
            <p className="muted">From {p.coachName}</p>
          </article>
        ))}
      </div>
      <h2 className="panel-title">Results</h2>
      <ul className="result-list">
        {(results.data ?? []).map((r) => (
          <li key={r.id} className="result">
            <div className="result__score">
              <span className="display">{r.performanceScore}</span>
              <span className="muted">/10</span>
            </div>
            <div>
              <p className="cell-strong">{r.planTitle}</p>
              <p>{r.coachComment}</p>
              <p className="muted">
                {r.coachName} · {formatDate(r.evaluationDate)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---- Invoices (preview) ------------------------------------------------- */
function InvoicesTab() {
  const rows = useApi(() => api.invoices.byMember(), []);
  if (rows.loading) return <Loading />;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Membership</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).map((i) => (
              <tr key={i.id}>
                <td className="num">{formatDate(i.paymentDate)}</td>
                <td className="cell-strong">{i.packageName}</td>
                <td>{PaymentMethod.label(i.paymentMethod)}</td>
                <td className="num">{formatMoney(i.amount)}</td>
                <td>
                  <StatusTag tone={InvoiceStatus.tone(i.status)}>
                    {InvoiceStatus.label(i.status)}
                  </StatusTag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---- Notifications (preview) -------------------------------------------- */
function NotificationsTab() {
  const rows = useApi(() => api.notifications.list(), []);
  const markAll = async () => {
    await Promise.all(
      (rows.data ?? [])
        .filter((n) => !n.isRead)
        .map((n) => api.notifications.update(n.id, { isRead: true })),
    );
    rows.reload();
  };
  const markOne = async (n) => {
    await api.notifications.update(n.id, { isRead: true });
    rows.reload();
  };
  if (rows.loading) return <Loading />;
  const unread = (rows.data ?? []).filter((n) => !n.isRead).length;
  return (
    <>
      <div className="panel-bar">
        <p className="muted">{unread ? `${unread} unread` : "All caught up"}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={markAll}
          disabled={!unread}
        >
          Mark all as read
        </Button>
      </div>
      <ul className="notif-list">
        {(rows.data ?? []).map((n) => (
          <li key={n.id} className={`notif ${n.isRead ? "" : "notif--unread"}`}>
            <button
              type="button"
              onClick={() => markOne(n)}
              className="notif__btn"
            >
              <span className="notif__dot" aria-hidden="true" />
              <span>
                <span className="notif__title">{n.title}</span>
                <span className="notif__msg">{n.message}</span>
                <span className="muted notif__time">
                  {formatDateTime(n.createdAt)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---- Profile (preview) -------------------------------------------------- */
function ProfileTab() {
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const base = useApi(() => api.members.me.get(), []);
  const [v, setV] = useState({
    fullName: user.fullName,
    email: user.email,
    phone: base.phone,
    dob: toDateInput(base.dob),
    gender: base.gender,
    trainingGoal: base.trainingGoal,
  });
  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.members.me.update({
        ...v,
        dob: v.dob ? `${v.dob}T00:00:00Z` : null,
      });
      updateUser({ fullName: v.fullName, email: v.email });
      toast.success("Profile saved successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to save profile");
    }
  };
  if (base.loading) return <Loading />;
  return (
    <form onSubmit={save} className="profile-form">
      <div className="form-grid">
        <Field
          className="field--full"
          label="Full name"
          name="fullName"
          required
          value={v.fullName}
          onChange={set}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          value={v.email}
          onChange={set}
        />
        <Field
          label="Phone"
          name="phone"
          type="tel"
          value={v.phone}
          onChange={set}
        />
        <Field
          label="Date of birth"
          name="dob"
          type="date"
          value={v.dob}
          onChange={set}
        />
        <Field
          label="Gender"
          name="gender"
          type="select"
          value={v.gender}
          onChange={set}
          options={[
            { value: "Male", label: "Male" },
            { value: "Female", label: "Female" },
            { value: "Other", label: "Other" },
          ]}
        />
        <Field
          className="field--full"
          label="Training goal"
          name="trainingGoal"
          type="textarea"
          value={v.trainingGoal}
          onChange={set}
        />
      </div>
      <div className="form-actions">
        <Button type="submit">Save changes</Button>
      </div>
      <p className="muted small">
        Testing against your database?{" "}
        <Link className="text-link" to="/login">
          Sign in again
        </Link>{" "}
        and paste your real member ID.
      </p>
    </form>
  );
}
