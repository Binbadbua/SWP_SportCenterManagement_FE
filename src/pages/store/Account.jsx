import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { isStaff, useAuth } from "../../context/AuthContext.jsx";
import { sportImage } from "../../lib/images.js";
import {
  AttendanceStatus,
  BookingStatus,
  InvoiceStatus,
  MembershipStatus,
  PaymentMethod,
  SupportRequestStatus,
} from "../../lib/enums.js";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
  fromDateInput,
  initials,
  realPhone,
  toDateInput,
  todayUtcDateString,
} from "../../lib/format.js";
import { useToast } from "../../components/Toast.jsx";
import NotificationInbox from "../../components/NotificationInbox.jsx";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  SampleDataNotice,
  StatusTag,
} from "../../components/ui.jsx";

const TABS = [
  { key: "bookings", label: "Bookings" },
  { key: "attendance", label: "Attendance" },
  { key: "membership", label: "Membership" },
  { key: "training", label: "Training" },
  { key: "invoices", label: "Invoices" },
  { key: "notifications", label: "Notifications" },
  { key: "support", label: "Support" },
  { key: "profile", label: "Profile" },
];

const GENDERS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
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
          {params.get("profile") === "incomplete" &&
            " We couldn’t save your phone, date of birth, gender and training goal yet — add them under Profile."}
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
        {tab === "membership" && <MembershipTab />}
        {tab === "training" && <TrainingTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "support" && <SupportTab />}
        {tab === "profile" && <ProfileTab />}
      </div>
    </div>
  );
}

/* The API answers 403 when a member asks for data only staff may read */
function StaffOnlyNotice({ what }) {
  return (
    <Notice tone="info" title={`Your ${what} can’t be shown here yet`}>
      The server only lets staff look up {what} (HTTP 403). Ask reception to
      check them for you.
    </Notice>
  );
}

/* ---- Bookings (API) ----------------------------------------------------- */
function BookingsTab({ memberId }) {
  const toast = useToast();
  const bookings = useApi(() => api.bookings.mine(), [], {
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
      await api.bookings.cancel(b.id, b.memberId ?? memberId);
      toast.success(`Booking for ${b.className} cancelled.`);
      bookings.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (bookings.loading) return <Loading />;
  if (bookings.error?.status === 403) return <StaffOnlyNotice what="bookings" />;
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
  const rows = useApi(() => api.attendance.mine(), [], {
    sample: () => mock.attendance.filter((a) => a.memberId === memberId),
  });
  if (rows.loading) return <Loading />;
  if (rows.error?.status === 403) return <StaffOnlyNotice what="attendance records" />;
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
            Your coach marks attendance at each session.
          </EmptyState>
        )
      )}
    </>
  );
}

/* ---- Membership (API) --------------------------------------------------- */
function MembershipTab() {
  const rows = useApi(() => api.memberships.mine(), []);
  if (rows.loading) return <Loading />;
  const list = rows.data ?? [];
  const today = todayUtcDateString();
  const current = list.find(
    (m) => m.status === 1 && String(m.endDate).slice(0, 10) >= today,
  );
  const left = current ? daysUntil(current.endDate) : null;
  return (
    <>
      <ErrorNotice error={rows.error} onRetry={rows.reload} />
      {current && (
        <p className="stat-line">
          <span className="display stat-line__num">{current.packageName}</span>
          <span className="muted">
            active until {formatDate(current.endDate)}
            {left !== null && ` · ${left} ${left === 1 ? "day" : "days"} left`}
          </span>
        </p>
      )}
      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Package</th>
                <th>From</th>
                <th>Until</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td className="cell-strong">{m.packageName}</td>
                  <td className="num">{formatDate(m.startDate)}</td>
                  <td className="num">{formatDate(m.endDate)}</td>
                  <td>
                    <StatusTag tone={MembershipStatus.tone(m.status)}>
                      {MembershipStatus.label(m.status)}
                    </StatusTag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !rows.error && (
          <EmptyState
            title="No membership yet"
            action={<Button to="/memberships">See plans</Button>}
          >
            Pay for a plan at reception and it shows up here with its end date.
          </EmptyState>
        )
      )}
    </>
  );
}

/* ---- Training (API) ----------------------------------------------------- */
function TrainingTab() {
  const plans = useApi(() => api.trainingPlans.mine(), []);
  const results = useApi(() => api.trainingResults.mine(), []);
  // Plans and results only carry IDs: class and coach names come from the class list
  const classes = useApi(() => api.classes.list(), [], {
    sample: mock.classes,
  });
  const classOf = (id) => (classes.data ?? []).find((c) => c.id === id);
  const planOf = (id) => (plans.data ?? []).find((p) => p.id === id);
  if (plans.loading || results.loading) return <Loading />;
  return (
    <>
      <h2 className="panel-title">Plans from your coach</h2>
      <ErrorNotice error={plans.error} onRetry={plans.reload} />
      {plans.data?.length ? (
        <div className="plan-list">
          {plans.data.map((p) => {
            const cls = classOf(p.classId);
            return (
              <article key={p.id} className="plan">
                <p className="label muted">
                  {cls?.className ?? "Class"} · {formatDate(p.createdDate)}
                </p>
                <h3 className="plan__title">{p.title}</h3>
                <p>{p.contentDescription}</p>
                {cls?.coachName && <p className="muted">From {cls.coachName}</p>}
              </article>
            );
          })}
        </div>
      ) : (
        !plans.error && (
          <p className="muted">
            No plans yet. Your coach writes one for you after you join a class.
          </p>
        )
      )}
      <h2 className="panel-title">Results</h2>
      <ErrorNotice error={results.error} onRetry={results.reload} />
      {results.data?.length ? (
        <ul className="result-list">
          {results.data.map((r) => {
            const plan = planOf(r.planId);
            const coachName = classOf(plan?.classId)?.coachName;
            return (
              <li key={r.id} className="result">
                <div className="result__score">
                  <span className="display">{r.performanceScore}</span>
                  <span className="muted">/10</span>
                </div>
                <div>
                  <p className="cell-strong">{plan?.title ?? "Training result"}</p>
                  <p>{r.coachComment}</p>
                  <p className="muted">
                    {coachName ? `${coachName} · ` : ""}
                    {formatDate(r.evaluationDate)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !results.error && (
          <p className="muted">No results yet. Your coach scores your progress against your plan.</p>
        )
      )}
    </>
  );
}

/* ---- Invoices (API) ----------------------------------------------------- */
function InvoicesTab() {
  const rows = useApi(() => api.invoices.mine(), []);
  if (rows.loading) return <Loading />;
  const list = [...(rows.data ?? [])].sort((a, b) =>
    String(b.paymentDate).localeCompare(String(a.paymentDate)),
  );
  return (
    <>
      <ErrorNotice error={rows.error} onRetry={rows.reload} />
      {list.length ? (
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
              {list.map((i) => (
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
      ) : (
        !rows.error && (
          <EmptyState title="No invoices yet">
            Reception creates an invoice when you pay for a membership.
          </EmptyState>
        )
      )}
    </>
  );
}

/* ---- Notifications (API) ------------------------------------------------ */
function NotificationsTab() {
  return <NotificationInbox />;
}

/* ---- Support requests (API) --------------------------------------------- */
// The member writes to reception; reception answers from Staff → Support requests
function SupportTab() {
  const toast = useToast();
  const requests = useApi(() => api.supportRequests.list(), []);
  const [content, setContent] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) return setError("Write what you need help with.");
    if (text.length > 2000) return setError("Keep it under 2000 characters.");
    setError(null);
    setSending(true);
    try {
      await api.supportRequests.create({ content: text });
      toast.success("Sent. Reception will answer here.");
      setContent("");
      requests.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <form className="support-form" onSubmit={send} noValidate>
        <Field
          label="Ask reception"
          name="content"
          type="textarea"
          value={content}
          onChange={(_, v) => setContent(v)}
          error={error}
          help="A question about a class, your membership, a payment or anything else. The answer shows up below."
        />
        <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send request"}</Button>
      </form>
      <h2 className="panel-title">Your requests</h2>
      {requests.loading ? (
        <Loading />
      ) : (
        <>
          <ErrorNotice error={requests.error} onRetry={requests.reload} />
          {requests.data?.length ? (
            <ul className="support-list">
              {requests.data.map((r) => (
                <li key={r.id} className="support-item">
                  <div className="support-item__head">
                    <StatusTag tone={SupportRequestStatus.tone(r.status)}>{SupportRequestStatus.label(r.status)}</StatusTag>
                    <span className="muted small">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="pre-wrap">{r.content}</p>
                  {r.resolution && (
                    <p className="support-item__answer pre-wrap">
                      <strong>Reception:</strong> {r.resolution}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            !requests.error && <p className="muted">No requests yet.</p>
          )}
        </>
      )}
    </>
  );
}

/* ---- Profile (API) ------------------------------------------------------ */
function validateProfile(v) {
  const e = {};
  if (!v.fullName.trim()) e.fullName = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim()))
    e.email = "Enter a valid email, like name@example.com.";
  if (!/^0\d{9}$/.test(v.phone.replace(/\s/g, "")))
    e.phone = "Enter a 10-digit phone number starting with 0.";
  if (!v.dob) e.dob = "Enter your date of birth.";
  return e;
}

function ProfileTab() {
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const me = useApi(() => api.members.me.get(), []);
  const p = me.data;
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Keep the name in the header in step with the saved profile
  useEffect(() => {
    if (p?.fullName && p.fullName !== user.fullName) updateUser({ fullName: p.fullName });
  }, [p?.fullName, user.fullName, updateUser]);

  const startEdit = () => {
    setV({
      fullName: p.fullName ?? "",
      email: p.email ?? user.email ?? "",
      phone: realPhone(p.phone),
      dob: toDateInput(p.dob),
      gender: p.gender ?? "",
      trainingGoal: p.trainingGoal ?? "",
    });
    setErrors({});
    setEditing(true);
  };
  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));

  const save = async (e) => {
    e.preventDefault();
    const found = validateProfile(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      // PUT /api/members/me replaces every field, so the whole profile is sent
      await api.members.me.update({
        accountId: p.accountId,
        fullName: v.fullName.trim(),
        email: v.email.trim(),
        phone: v.phone.replace(/\s/g, ""),
        dob: fromDateInput(v.dob),
        gender: v.gender,
        trainingGoal: v.trainingGoal.trim(),
        avatar: p.avatar ?? "",
      });
      updateUser({ fullName: v.fullName.trim(), email: v.email.trim() });
      toast.success("Profile saved.");
      setEditing(false);
      me.reload();
    } catch (err) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (me.loading) return <Loading />;

  if (!p) {
    // The profile endpoint failed: show what the sign-in token knows, read-only
    return (
      <>
        <ErrorNotice
          error={me.error ?? "Your profile could not be loaded."}
          onRetry={me.reload}
        />
        <dl className="profile-view">
          <div>
            <dt>Full name</dt>
            <dd>{user.fullName || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email || "—"}</dd>
          </div>
        </dl>
      </>
    );
  }

  if (!editing) {
    return (
      <div className="profile-form">
        <dl className="profile-view">
          <div>
            <dt>Full name</dt>
            <dd>{p.fullName || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{p.email || "—"}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className="num">{realPhone(p.phone) || "—"}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd className="num">{formatDate(p.dob)}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{GENDERS.find((g) => g.value === p.gender)?.label ?? (p.gender || "—")}</dd>
          </div>
          <div className="profile-view__full">
            <dt>Training goal</dt>
            <dd>{p.trainingGoal || "—"}</dd>
          </div>
        </dl>
        <div className="form-actions">
          <Button variant="secondary" icon="edit" onClick={startEdit}>
            Edit profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="profile-form" noValidate>
      <div className="form-grid">
        <Field
          className="field--full"
          label="Full name"
          name="fullName"
          required
          value={v.fullName}
          onChange={set}
          error={errors.fullName}
          autoComplete="name"
        />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          value={v.email}
          onChange={set}
          error={errors.email}
          autoComplete="email"
        />
        <Field
          label="Phone"
          name="phone"
          type="tel"
          required
          value={v.phone}
          onChange={set}
          error={errors.phone}
          autoComplete="tel"
        />
        <Field
          label="Date of birth"
          name="dob"
          type="date"
          required
          value={v.dob}
          onChange={set}
          error={errors.dob}
        />
        <Field
          label="Gender"
          name="gender"
          type="select"
          value={v.gender}
          onChange={set}
          options={GENDERS}
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
        <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
