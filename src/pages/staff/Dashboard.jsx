import { Link } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatDate, formatMoney, formatTimeRange, todayUtcDateString, } from "../../lib/format.js";
import Icon from "../../components/Icon.jsx";
import { Button, ErrorNotice, Loading, PreviewTag, SampleDataNotice, } from "../../components/ui.jsx";

// The last six calendar months, ending with the current one
const lastSixMonths = () =>
  Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    return { label: d.toLocaleString("en-US", { month: "short" }), year: d.getFullYear(), month: d.getMonth() + 1 };
  });

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
  const isManager = user.role === "CenterManager";
  const months = lastSixMonths();
  // GET /api/dashboard/revenue needs the period; it answers { totalRevenue, monthlyRevenue: [{ year, month, revenue }] }
  const revenueFrom = `${months[0].year}-${String(months[0].month).padStart(2, "0")}-01T00:00:00Z`;
  const revenueApi = useApi(() => api.dashboard.revenue(revenueFrom, new Date().toISOString()), [revenueFrom], { skip: !isManager, sample: mock.report.revenueByMonth });
  const membersApi = useApi(() => api.dashboard.membersSummary(), [], { skip: !isManager, sample: { activeMembers: mock.report.totals.activeMembers } });
  const membershipsApi = useApi(() => api.dashboard.membershipsSummary(), [], { skip: !isManager, sample: { activeMemberships: mock.report.totals.activeMemberships } });
  const classesSummaryApi = useApi(() => api.dashboard.classesSummary(), [], { skip: !isManager, sample: { bookingsThisMonth: mock.report.totals.bookingsThisMonth, revenueThisMonth: mock.report.totals.revenueThisMonth } });
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

  const activeMembers = membersApi.data?.activeMembers ?? 0;
  const activeMemberships = membershipsApi.data?.activeMemberships ?? 0;
  const bookingsThisMonth = classesSummaryApi.data?.totalBookings ?? 0;
  // Revenue items carry numeric year/month and revenue in VND; the sample data is already
  // [{ month: "Apr", value: <million VND> }]
  const rawRevenue = revenueApi.data?.monthlyRevenue ?? [];
  const revenueOf = (m) =>
    Number(rawRevenue.find((item) => Number(item.year) === m.year && Number(item.month) === m.month)?.revenue ?? 0);
  const revenueByMonth = revenueApi.usingSample
    ? revenueApi.data
    : months.map((m) => ({ month: m.label, value: Math.round(revenueOf(m) / 1e5) / 10 }));
  const revenueThisMonth = revenueApi.usingSample
    ? mock.report.totals.revenueThisMonth
    : revenueOf(months[months.length - 1]);

  const max = Math.max(...revenueByMonth.map((m) => m.value), 1);
  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <p className="label muted">{formatDate(today)}</p>
          <h1 className="staff-page__title display">
            {greeting()},{" "}
            {user.fullName || user.username}
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
          </div>
          <dl className="kpis">
            <div className="kpi">
              <dt>Active members</dt>
              <dd className="display num">
                {activeMembers}
              </dd>
            </div>
            <div className="kpi">
              <dt>Active memberships</dt>
              <dd className="display num">
                {activeMemberships}
              </dd>
            </div>
            <div className="kpi">
              <dt>Class bookings</dt>
              <dd className="display num">
                {Number(bookingsThisMonth || 0).toLocaleString("en")}
              </dd>
            </div>
            <div className="kpi">
              <dt>Revenue (VND)</dt>
              <dd
                className="display num"
                title={formatMoney(revenueThisMonth)}
              >
                {(Number(revenueThisMonth || 0) / 1e6).toLocaleString(
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
              aria-label={`Revenue by month in million VND`}
            >
              {Array.isArray(revenueByMonth) && revenueByMonth.map((m, i, arr) => {
                const val = m.value ?? m.revenue ?? 0;
                const monthLabel = m.month ?? m.name ?? `T${i+1}`;
                return (
                  <div
                    key={monthLabel}
                    className={`bars__col ${i === arr.length - 1 ? "is-current" : ""}`}
                  >
                    <span className="bars__value num">{val}M</span>
                    <span
                      className="bars__bar"
                      style={{ height: `${Math.round((val / max) * 160)}px` }}
                    />
                    <span className="bars__label">{monthLabel}</span>
                  </div>
                );
              })}
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
                {/* Only coaches take attendance (for their own sessions, listed here) */}
                {user.role === "Coach" && (
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
