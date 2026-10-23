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
    return { label: `T${d.getMonth() + 1}`, year: d.getFullYear(), month: d.getMonth() + 1 };
  });

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Chào buổi sáng" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
};

const QUICK = {
  CenterManager: [
    { to: "/staff/classes", label: "Thêm lớp học", icon: "plus" },
    { to: "/staff/schedule", label: "Xếp lịch buổi học", icon: "calendar" },
    { to: "/staff/invoices", label: "Xem hóa đơn", icon: "grid" },
  ],
  Receptionist: [
    { to: "/staff/members", label: "Đăng ký học viên", icon: "user" },
    { to: "/staff/bookings", label: "Đặt lớp cho học viên", icon: "calendar" },
    { to: "/staff/invoices", label: "Thu tiền", icon: "plus" },
  ],
  Coach: [
    { to: "/staff/attendance", label: "Điểm danh", icon: "check" },
    { to: "/staff/training-plans", label: "Lập kế hoạch tập", icon: "edit" },
    { to: "/staff/training-results", label: "Ghi kết quả tập", icon: "plus" },
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
            <h2 className="panel-title">Tháng này</h2>
          </div>
          <dl className="kpis">
            <div className="kpi">
              <dt>Học viên đang hoạt động</dt>
              <dd className="display num">
                {activeMembers}
              </dd>
            </div>
            <div className="kpi">
              <dt>Thẻ còn hiệu lực</dt>
              <dd className="display num">
                {activeMemberships}
              </dd>
            </div>
            <div className="kpi">
              <dt>Lượt đặt lớp</dt>
              <dd className="display num">
                {Number(bookingsThisMonth || 0).toLocaleString("vi-VN")}
              </dd>
            </div>
            <div className="kpi">
              <dt>Doanh thu (VND)</dt>
              <dd
                className="display num"
                title={formatMoney(revenueThisMonth)}
              >
                {(Number(revenueThisMonth || 0) / 1e6).toLocaleString(
                  "vi-VN",
                  { maximumFractionDigits: 1 },
                )}
                tr
              </dd>
            </div>
          </dl>
          <figure className="bars-figure">
            <div
              className="bars"
              role="img"
              aria-label={`Doanh thu theo tháng, đơn vị triệu đồng`}
            >
              {Array.isArray(revenueByMonth) && revenueByMonth.map((m, i, arr) => {
                const val = m.value ?? m.revenue ?? 0;
                const monthLabel = m.month ?? m.name ?? `T${i+1}`;
                return (
                  <div
                    key={monthLabel}
                    className={`bars__col ${i === arr.length - 1 ? "is-current" : ""}`}
                  >
                    <span className="bars__value num">{String(val).replace(".", ",")}tr</span>
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
              Doanh thu theo tháng (triệu đồng)
            </figcaption>
          </figure>
        </section>
      )}

      <section className="panel">
        <div className="section-bar">
          <h2 className="panel-title">
            {user.role === "Coach"
              ? "Buổi dạy hôm nay của bạn"
              : "Hôm nay tại trung tâm"}
          </h2>
          <Button variant="secondary" size="sm" to="/staff/schedule">
            Xem cả lịch
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
                    Điểm danh
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Hôm nay không có buổi học.</p>
        )}
      </section>
    </div>
  );
}
