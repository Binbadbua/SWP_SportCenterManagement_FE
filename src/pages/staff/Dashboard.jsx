import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { ClassStatus } from "../../lib/enums.js";
import { formatDate, formatMoney, formatTimeRange, todayCenterDateString, } from "../../lib/format.js";
import Icon from "../../components/Icon.jsx";
import { Button, ErrorNotice, FillBar, Loading, SampleDataNotice, StatusTag, } from "../../components/ui.jsx";

// Report periods the manager can pick; each ends with the current month
const PERIODS = [
  { value: 3, label: "3 tháng" },
  { value: 6, label: "6 tháng" },
  { value: 12, label: "12 tháng" },
];

// The last `count` calendar months, ending with the current one
const lastMonths = (count) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (count - 1) + i);
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
  const myClasses = useApi(
    () => api.coaches.classes(user.coachId),
    [user.coachId],
    {
      skip: user.role !== "Coach",
      sample: mock.coachClasses,
    },
  );

  const today = todayCenterDateString();
  const myClassIds = new Set((myClasses.data ?? []).map((c) => c.classId));
  const todays = (sessions.data ?? [])
    .filter((s) => s.date.slice(0, 10) === today)
    .filter((s) => user.role !== "Coach" || myClassIds.has(s.classId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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

      {user.role === "CenterManager" && <ManagerReports />}

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

// Center manager: totals, revenue and new members month by month, and how full each open class is.
// The summaries count everything so far; the month table covers the period picked above it.
function ManagerReports() {
  const [period, setPeriod] = useState(6);
  const months = lastMonths(period);
  // GET /api/dashboard/revenue needs the period; it answers { totalRevenue, paidInvoiceCount, monthlyRevenue: [{ year, month, revenue, invoiceCount }] }
  const revenueFrom = `${months[0].year}-${String(months[0].month).padStart(2, "0")}-01T00:00:00Z`;
  const revenueApi = useApi(() => api.dashboard.revenue(revenueFrom, new Date().toISOString()), [revenueFrom], { sample: mock.report.revenueByMonth });
  const membersApi = useApi(() => api.dashboard.membersSummary(), [], { sample: { activeMembers: mock.report.totals.activeMembers } });
  const membershipsApi = useApi(() => api.dashboard.membershipsSummary(), [], { sample: { activeMemberships: mock.report.totals.activeMemberships } });
  const classesSummaryApi = useApi(() => api.dashboard.classesSummary(), [], { sample: { totalBookings: mock.report.totals.bookingsThisMonth } });
  // New members per month come from the members' join dates; the fill of each class from the class list
  const members = useApi(() => api.members.list(), [], { sample: mock.members });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });

  const ms = membersApi.data ?? {};
  const cards = membershipsApi.data ?? {};
  const cs = classesSummaryApi.data ?? {};
  // Revenue items carry numeric year/month and revenue in VND; the sample data is already
  // [{ month: "Apr", value: <million VND> }]
  const rawRevenue = revenueApi.data?.monthlyRevenue ?? [];
  const itemOf = (m) => rawRevenue.find((item) => Number(item.year) === m.year && Number(item.month) === m.month);
  const revenueOf = (m) => Number(itemOf(m)?.revenue ?? 0);
  // Once classes have fees (CHANGELOG Part B, B53) each month also tells packages and classes apart
  const split = rawRevenue.some((item) => item.classRevenue !== undefined);
  const revenueByMonth = revenueApi.usingSample
    ? revenueApi.data
    : months.map((m) => ({ month: m.label, value: Math.round(revenueOf(m) / 1e5) / 10 }));
  const revenueThisMonth = revenueApi.usingSample
    ? mock.report.totals.revenueThisMonth
    : revenueOf(months[months.length - 1]);
  const max = Math.max(...revenueByMonth.map((m) => m.value ?? m.revenue ?? 0), 1);
  const joinedIn = (m) =>
    (members.data ?? []).filter((x) => {
      const d = new Date(x.createdAt);
      return d.getFullYear() === m.year && d.getMonth() + 1 === m.month;
    }).length;

  return (
    <>
      <section className="kpis-wrap">
        <div className="section-bar">
          <h2 className="panel-title">Tổng quan</h2>
        </div>
        <dl className="kpis">
          <div className="kpi">
            <dt>Học viên</dt>
            <dd className="display num">{ms.totalMembers ?? ms.activeMembers ?? 0}</dd>
            {ms.newMembersLast30Days !== undefined && (
              <dd className="kpi__sub">{ms.newMembersLast30Days} mới trong 30 ngày qua</dd>
            )}
          </div>
          <div className="kpi">
            <dt>Thẻ còn hiệu lực</dt>
            <dd className="display num">{cards.activeMemberships ?? 0}</dd>
            {cards.expiringSoon !== undefined && <dd className="kpi__sub">{cards.expiringSoon} thẻ sắp hết hạn</dd>}
          </div>
          <div className="kpi">
            <dt>Lượt đặt lớp</dt>
            <dd className="display num">{Number(cs.totalBookings || 0).toLocaleString("vi-VN")}</dd>
            {cs.totalClasses !== undefined && <dd className="kpi__sub">trên {cs.totalClasses} lớp, {cs.totalSessions} buổi</dd>}
          </div>
          <div className="kpi">
            <dt>Doanh thu tháng này (VND)</dt>
            <dd className="display num" title={formatMoney(revenueThisMonth)}>
              {(Number(revenueThisMonth || 0) / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
              tr
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="section-bar">
          <h2 className="panel-title">Theo thời gian</h2>
          <div className="segmented segmented--auto" role="group" aria-label="Khoảng thời gian">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`segmented__btn ${period === p.value ? "is-active" : ""}`}
                aria-pressed={period === p.value}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {revenueApi.usingSample && <SampleDataNotice onRetry={revenueApi.reload} />}
        <ErrorNotice error={!revenueApi.usingSample ? revenueApi.error : null} onRetry={revenueApi.reload} />
        {revenueApi.loading ? (
          <Loading />
        ) : (
          <>
            {!revenueApi.usingSample && revenueApi.data && (
              <p className="muted">
                Doanh thu {period} tháng: <strong className="num">{formatMoney(revenueApi.data.totalRevenue)}</strong> từ{" "}
                {revenueApi.data.paidInvoiceCount} hóa đơn đã thanh toán.
              </p>
            )}
            <figure className="bars-figure">
              <div
                className={`bars ${revenueByMonth.length > 6 ? "bars--dense" : ""}`}
                role="img"
                aria-label="Doanh thu theo tháng, đơn vị triệu đồng"
              >
                {Array.isArray(revenueByMonth) && revenueByMonth.map((m, i, arr) => {
                  const val = m.value ?? m.revenue ?? 0;
                  const monthLabel = m.month ?? m.name ?? `T${i + 1}`;
                  return (
                    <div
                      key={`${monthLabel}-${i}`}
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
              <figcaption className="muted small">Doanh thu theo tháng (triệu đồng)</figcaption>
            </figure>
            {!revenueApi.usingSample && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Tháng</th>
                      <th scope="col">Doanh thu</th>
                      {split && <th scope="col">Từ gói tập</th>}
                      {split && <th scope="col">Từ học phí lớp</th>}
                      <th scope="col">Hóa đơn đã thu</th>
                      <th scope="col">Học viên mới</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...months].reverse().map((m) => (
                      <tr key={`${m.year}-${m.month}`}>
                        <td className="cell-strong num">{m.month}/{m.year}</td>
                        <td className="num">{formatMoney(revenueOf(m))}</td>
                        {split && <td className="num">{formatMoney(itemOf(m)?.membershipRevenue ?? 0)}</td>}
                        {split && <td className="num">{formatMoney(itemOf(m)?.classRevenue ?? 0)}</td>}
                        <td className="num">{itemOf(m)?.invoiceCount ?? 0}</td>
                        <td className="num">{members.loading ? "…" : members.error ? "—" : joinedIn(m)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <ClassFill classes={classes} />
    </>
  );
}

const FILL_SHOWN = 8;

// How full the classes still open for booking are, the fullest first
function ClassFill({ classes }) {
  const [showAll, setShowAll] = useState(false);
  const open = (classes.data ?? [])
    .filter((c) => (c.status === 1 || c.status === 2) && c.currentEnrolled != null)
    .map((c) => ({ ...c, ratio: c.maxCapacity ? c.currentEnrolled / c.maxCapacity : 0 }))
    .sort((a, b) => b.ratio - a.ratio);
  const full = open.filter((c) => c.currentEnrolled >= c.maxCapacity).length;
  const low = open.filter((c) => c.ratio < 0.3).length;
  const taken = open.reduce((n, c) => n + c.currentEnrolled, 0);
  const seats = open.reduce((n, c) => n + c.maxCapacity, 0);
  const shown = showAll ? open : open.slice(0, FILL_SHOWN);
  return (
    <section className="panel">
      <div className="section-bar">
        <h2 className="panel-title">Tình trạng đăng ký lớp</h2>
        <Button variant="secondary" size="sm" to="/staff/classes">Quản lý lớp học</Button>
      </div>
      <ErrorNotice error={!classes.usingSample ? classes.error : null} onRetry={classes.reload} />
      {classes.loading ? (
        <Loading />
      ) : open.length ? (
        <>
          <p className="muted">
            {open.length} lớp đang mở đăng ký · đã đặt <span className="num">{taken}/{seats}</span> chỗ · {full} lớp đã đủ chỗ ·{" "}
            {low} lớp dưới 30% chỗ
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Lớp</th>
                  <th scope="col">Môn</th>
                  <th scope="col">Huấn luyện viên</th>
                  <th scope="col">Đã đặt</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-strong">{c.className}</td>
                    <td>{c.categoryName}</td>
                    <td>{c.coachName}</td>
                    <td><FillBar value={c.currentEnrolled} max={c.maxCapacity} /></td>
                    <td>
                      {c.currentEnrolled >= c.maxCapacity ? (
                        <StatusTag tone="danger">Đã đủ chỗ</StatusTag>
                      ) : c.ratio < 0.3 ? (
                        <StatusTag tone="warning">Ít người đặt</StatusTag>
                      ) : (
                        <StatusTag tone={ClassStatus.tone(c.status)}>{ClassStatus.label(c.status)}</StatusTag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {open.length > FILL_SHOWN && (
            <button type="button" className="plain-btn" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Thu gọn" : `Xem tất cả ${open.length} lớp`}
            </button>
          )}
        </>
      ) : (
        !classes.error && <p className="muted">Chưa có lớp nào đang mở đăng ký.</p>
      )}
    </section>
  );
}
