import { Link } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  formatDate,
  formatMoney,
  formatTimeRange,
  todayUtcDateString,
} from "../../lib/format.js";
import Icon from "../../components/Icon.jsx";
import {
  Button,
  ErrorNotice,
  Loading,
  PreviewTag,
  SampleDataNotice,
} from "../../components/ui.jsx";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const QUICK = {
  CenterManager: [
    { to: "/staff/classes", label: "Add a class", icon: "plus" },
    { to: "/staff/schedule", label: "Schedule sessions", icon: "calendar" },
    { to: "/staff/invoices", label: "Review invoices", icon: "grid" },
  ],
  Receptionist: [
    { to: "/staff/members", label: "Register a member", icon: "user" },
    { to: "/staff/bookings", label: "Book a class", icon: "calendar" },
    { to: "/staff/invoices", label: "Take a payment", icon: "plus" },
  ],
  Coach: [
    { to: "/staff/attendance", label: "Take attendance", icon: "check" },
    { to: "/staff/training-plans", label: "Write a plan", icon: "edit" },
    { to: "/staff/training-results", label: "Record results", icon: "plus" },
  ],
};

export default function Dashboard() {
  const { user } = useAuth();
  const sessions = useApi(() => api.schedules.list(), [], {
    sample: mock.sessions,
  });
  const myClasses = useApi(
    () => api.coaches.classes(user.coachId),
    [user.coachId],
    {
      skip: user.role !== "Coach",
      sample: mock.coachClasses,
    },
  );

  const today = todayUtcDateString();
  const myClassIds = new Set((myClasses.data ?? []).map((c) => c.classId));
  const todays = (sessions.data ?? [])
    .filter((s) => s.date.slice(0, 10) === today)
    .filter((s) => user.role !== "Coach" || myClassIds.has(s.classId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const max = Math.max(...mock.report.revenueByMonth.map((m) => m.value));

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <p className="label muted">{formatDate(today)}</p>
          <h1 className="staff-page__title display">
            {greeting()},{" "}
            {user.fullName?.split(" ").slice(-1)[0] || user.username}
          </h1>
        </div>
      </header>

      {sessions.usingSample && <SampleDataNotice onRetry={sessions.reload} />}
      <ErrorNotice
        error={!sessions.usingSample ? sessions.error : null}
        onRetry={sessions.reload}
      />

      <div className="quick-actions">
        {QUICK[user.role]?.map((q) => (
          <Link key={q.to} to={q.to} className="quick-action">
            <Icon name={q.icon} />
            <span>{q.label}</span>
            <Icon name="arrowRight" size={20} />
          </Link>
        ))}
      </div>

      {user.role === "CenterManager" && (
        <section className="kpis-wrap">
          <div className="section-bar">
            <h2 className="panel-title">This month</h2>
            <PreviewTag>Preview · no report API yet</PreviewTag>
          </div>
          <dl className="kpis">
            <div className="kpi">
              <dt>Active members</dt>
              <dd className="display num">
                {mock.report.totals.activeMembers}
              </dd>
            </div>
            <div className="kpi">
              <dt>Active memberships</dt>
              <dd className="display num">
                {mock.report.totals.activeMemberships}
              </dd>
            </div>
            <div className="kpi">
              <dt>Class bookings</dt>
              <dd className="display num">
                {mock.report.totals.bookingsThisMonth.toLocaleString("en")}
              </dd>
            </div>
            <div className="kpi">
              <dt>Revenue (VND)</dt>
              <dd
                className="display num"
                title={formatMoney(mock.report.totals.revenueThisMonth)}
              >
                {(mock.report.totals.revenueThisMonth / 1e6).toLocaleString(
                  "en",
                  { maximumFractionDigits: 1 },
                )}
                M
              </dd>
            </div>
          </dl>
          <figure className="bars-figure">
            <div
              className="bars"
              role="img"
              aria-label={`Revenue by month in million VND: ${mock.report.revenueByMonth.map((m) => `${m.month} ${m.value}`).join(", ")}`}
            >
              {mock.report.revenueByMonth.map((m, i, arr) => (
                <div
                  key={m.month}
                  className={`bars__col ${i === arr.length - 1 ? "is-current" : ""}`}
                >
                  <span className="bars__value num">{m.value}M</span>
                  <span
                    className="bars__bar"
                    style={{ height: `${Math.round((m.value / max) * 160)}px` }}
                  />
                  <span className="bars__label">{m.month}</span>
                </div>
              ))}
            </div>
            <figcaption className="muted small">
              Revenue by month (million VND)
            </figcaption>
          </figure>
        </section>
      )}

      <section className="panel">
        <div className="section-bar">
          <h2 className="panel-title">
            {user.role === "Coach"
              ? "Your sessions today"
              : "Today on the floor"}
          </h2>
          <Button variant="secondary" size="sm" to="/staff/schedule">
            Full schedule
          </Button>
        </div>
        {sessions.loading ? (
          <Loading />
        ) : todays.length ? (
          <ul className="today-list">
            {todays.map((s) => (
              <li key={s.id}>
                <span className="today-list__time num">
                  {formatTimeRange(s.startTime, s.endTime)}
                </span>
                <span className="cell-strong">{s.className}</span>
                <span className="muted">{s.roomName}</span>
                {["Coach", "CenterManager"].includes(user.role) && (
                  <Link
                    className="btn btn--secondary btn--sm"
                    to={`/staff/attendance?session=${s.id}`}
                  >
                    Attendance
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No sessions today.</p>
        )}
      </section>
    </div>
  );
}
