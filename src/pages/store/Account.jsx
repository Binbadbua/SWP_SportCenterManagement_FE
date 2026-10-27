import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, isMissingRoute } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { isStaff, useAuth } from "../../context/AuthContext.jsx";
import { sportImage } from "../../lib/images.js";
import {
  AttendanceStatus,
  BookingStatus,
  InvoiceStatus,
  Gender,
  MembershipStatus,
  PaymentMethod,
  SupportRequestStatus,
} from "../../lib/enums.js";
import {
  addDaysToDateInput,
  daysUntil,
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
  formatTimeRange,
  formatWeekday,
  fromDateInput,
  initials,
  isSessionOver,
  realPhone,
  toDateInput,
  todayLocalDateString,
  todayUtcDateString,
} from "../../lib/format.js";
import { cardsOn } from "../../lib/membership.js";
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
  SlowHint,
  StatusTag,
} from "../../components/ui.jsx";

const TABS = [
  { key: "bookings", label: "Lớp đã đặt" },
  { key: "schedule", label: "Lịch tập" },
  { key: "attendance", label: "Điểm danh" },
  { key: "membership", label: "Thẻ thành viên" },
  { key: "training", label: "Tập luyện" },
  { key: "invoices", label: "Hóa đơn" },
  { key: "notifications", label: "Thông báo" },
  { key: "support", label: "Hỗ trợ" },
  { key: "profile", label: "Hồ sơ" },
];

const GENDERS = Gender.options;


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
          title="Đăng nhập để xem lớp đã đặt"
          action={<Button to="/login?next=/account">Đăng nhập</Button>}
        >
          Lớp học, điểm danh và hóa đơn của bạn đều ở đây.
        </EmptyState>
      </div>
    );
  }
  if (isStaff(user)) {
    return (
      <div className="container page">
        <EmptyState
          title="Bạn đang đăng nhập bằng tài khoản nhân viên"
          action={<Button to="/staff">Vào khu vực nhân viên</Button>}
        >
          Trang này dành cho học viên. Hãy đăng xuất rồi đăng nhập bằng tài khoản
          học viên để xem.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page account">
      {params.get("welcome") && (
        <Notice tone="success" title={`Chào mừng, ${user.fullName}`}>
          Tài khoản của bạn đã sẵn sàng. Hãy chọn một lớp để đặt buổi tập đầu tiên.
          {params.get("profile") === "incomplete" &&
            " Chưa lưu được số điện thoại, ngày sinh, giới tính và mục tiêu tập — bạn hãy bổ sung ở mục Hồ sơ."}
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

      <nav className="tabs" aria-label="Các mục tài khoản">
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
        {tab === "schedule" && <ScheduleTab />}
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
    <Notice tone="info" title={`Chưa xem được ${what} ở đây`}>
      Máy chủ chỉ cho nhân viên tra cứu {what} (HTTP 403). Bạn hãy nhờ lễ tân
      kiểm tra giúp.
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
    if (!window.confirm(`Hủy đặt lớp ${b.className}?`)) return;
    setBusyId(b.id);
    try {
      await api.bookings.cancel(b.id, b.memberId ?? memberId);
      toast.success(`Đã hủy đặt lớp ${b.className}.`);
      bookings.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (bookings.loading) return <Loading />;
  if (bookings.error?.status === 403) return <StaffOnlyNotice what="lớp đã đặt" />;
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
            title="Bạn chưa đặt lớp nào"
            action={<Button to="/classes">Tìm lớp học</Button>}
          >
            Lớp bạn đặt sẽ hiện ở đây kèm ngày khai giảng.
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
                  Khai giảng {formatDate(b.classStartDate)} · đặt ngày{" "}
                  {formatDate(b.bookingDate)}
                </p>
              </div>
              <div className="order__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  to={`/classes/${b.classId}`}
                >
                  Xem lớp
                </Button>
                {b.status === 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancel(b)}
                    disabled={busyId === b.id}
                  >
                    {busyId === b.id ? "Đang hủy…" : "Hủy"}
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

/* ---- Personal schedule (API) -------------------------------------------- */
// The upcoming sessions of every class the member booked. The API has no "my sessions" endpoint, so the
// bookings are matched with the public timetable; a session outside the member's card dates is flagged.
const SCHEDULE_SHOWN = 20;
function ScheduleTab() {
  const bookings = useApi(() => api.bookings.mine(), []);
  const sessions = useApi(() => api.schedules.list(), [], { sample: mock.sessions });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const cards = useApi(() => api.memberships.mine(), []);
  const [showAll, setShowAll] = useState(false);
  if (bookings.loading || sessions.loading) return <Loading />;

  const booked = new Set((bookings.data ?? []).filter((b) => b.status !== 3).map((b) => b.classId));
  const upcoming = (sessions.data ?? [])
    .filter((s) => booked.has(s.classId) && !isSessionOver(s))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const shown = showAll ? upcoming : upcoming.slice(0, SCHEDULE_SHOWN);
  // [["2026-10-28", [sessions…]], …] in date order
  const days = [...shown.reduce((m, s) => {
    const day = String(s.date).slice(0, 10);
    return m.set(day, [...(m.get(day) ?? []), s]);
  }, new Map())];
  const coachOf = (id) => (classes.data ?? []).find((c) => c.id === id)?.coachName;
  // Unknown cards (still loading or failed) flag nothing
  const covered = (day) => !cards.data || cardsOn(cards.data, day).length > 0;
  const uncovered = upcoming.filter((s) => !covered(String(s.date).slice(0, 10))).length;
  const today = todayLocalDateString();
  const dayName = (day) =>
    day === today ? "Hôm nay" : day === addDaysToDateInput(today, 1) ? "Ngày mai" : formatWeekday(day);

  return (
    <>
      {sessions.usingSample && <SampleDataNotice onRetry={sessions.reload} />}
      <ErrorNotice error={bookings.error} onRetry={bookings.reload} />
      <ErrorNotice error={!sessions.usingSample ? sessions.error : null} onRetry={sessions.reload} />
      {!upcoming.length ? (
        !bookings.error &&
        !sessions.error && (
          <EmptyState
            title={booked.size ? "Không còn buổi học sắp tới" : "Bạn chưa đặt lớp nào"}
            action={<Button to="/classes">Tìm lớp học</Button>}
          >
            {booked.size
              ? "Các buổi của những lớp bạn đã đặt đều đã diễn ra. Hãy đặt thêm lớp mới."
              : "Đặt một lớp để các buổi học của lớp hiện ở đây theo từng ngày."}
          </EmptyState>
        )
      ) : (
        <>
          <p className="stat-line">
            <span className="display stat-line__num">{upcoming.length}</span>
            <span className="muted">buổi học sắp tới của {booked.size} lớp đã đặt</span>
          </p>
          {uncovered > 0 && (
            (cards.data ?? []).some((m) => m.status === 1) ? (
              <Notice
                tone="warning"
                title={`${uncovered} buổi nằm ngoài thời hạn thẻ của bạn`}
                action={<Button size="sm" variant="secondary" to="/account?tab=membership">Xem thẻ</Button>}
              >
                Bạn cần thẻ còn hiệu lực vào ngày học. Gia hạn hoặc mua gói mới để tham gia các buổi này.
              </Notice>
            ) : (
              <Notice
                tone="warning"
                title="Bạn chưa có thẻ thành viên còn hiệu lực"
                action={<Button size="sm" variant="secondary" to="/memberships">Xem gói tập</Button>}
              >
                Các buổi dưới đây chỉ học được khi bạn có thẻ còn hiệu lực vào ngày học. Lớp học không thu thêm phí
                ngoài thẻ.
              </Notice>
            )
          )}
          <div className="my-schedule">
            {days.map(([day, list]) => (
              <section key={day} className="my-schedule__day">
                <h3 className="my-schedule__date">
                  {dayName(day)} <span className="muted num">{formatDate(day)}</span>
                </h3>
                <ul className="my-schedule__list">
                  {list.map((s) => (
                    <li key={s.id} className="my-schedule__item">
                      <span className="my-schedule__time num">{formatTimeRange(s.startTime, s.endTime)}</span>
                      <span className="my-schedule__what">
                        <Link className="cell-strong" to={`/classes/${s.classId}`}>{s.className}</Link>
                        <span className="muted">
                          {[s.roomName, coachOf(s.classId)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {!covered(day) && <StatusTag tone="warning">Ngoài thời hạn thẻ</StatusTag>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {upcoming.length > SCHEDULE_SHOWN && (
            <button type="button" className="plain-btn sessions__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Thu gọn" : `Xem tất cả ${upcoming.length} buổi`}
            </button>
          )}
        </>
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
  if (rows.error?.status === 403) return <StaffOnlyNotice what="lịch sử điểm danh" />;
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
            <span className="muted">buổi đã tham gia</span>
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Buổi học</th>
                  <th>Bắt đầu</th>
                  <th>Check-in</th>
                  <th>Trạng thái</th>
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
          <EmptyState title="Chưa có điểm danh">
            Huấn luyện viên sẽ điểm danh bạn ở mỗi buổi học.
          </EmptyState>
        )
      )}
    </>
  );
}

/* ---- Membership (API) --------------------------------------------------- */
// A card lets the member book classes whose sessions fall within its dates, at no extra cost. Renewing
// is buying the package again: checkout starts the new card the day after the current one ends.
function MembershipTab() {
  const rows = useApi(() => api.memberships.mine(), []);
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const invoices = useApi(() => api.invoices.mine(), []);
  if (rows.loading) return <Loading />;
  const list = rows.data ?? [];
  const today = todayUtcDateString();
  const current = list
    .filter((m) => m.status === 1 && String(m.endDate).slice(0, 10) >= today)
    .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0];
  const left = current ? daysUntil(current.endDate) : null;
  // A package bought on the website waits for reception: its invoice is the payment to follow
  const pending = list.filter((m) => m.status === 2 && String(m.endDate).slice(0, 10) >= today);
  const paymentOf = (m) => (invoices.data ?? []).find((i) => i.memberMembershipId === m.id && i.status === 1);
  const latest = current ?? [...list].sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0];
  const onSale = latest && (packages.data ?? []).some((p) => p.id === latest.packageId && p.status === 1);
  return (
    <>
      <ErrorNotice error={rows.error} onRetry={rows.reload} />
      {pending.map((m) => (
        <Notice
          key={m.id}
          tone="warning"
          title={`${m.packageName} đang chờ xác nhận thanh toán`}
          action={paymentOf(m) && (
            <Button size="sm" variant="secondary" to={`/payment/result?paymentId=${paymentOf(m).id}`}>Xem đơn</Button>
          )}
        >
          Thanh toán với lễ tân để kích hoạt thẻ; đơn mua trên web tự hủy sau 30 phút nếu chưa được xác nhận.
        </Notice>
      ))}
      {current && (
        <p className="stat-line">
          <span className="display stat-line__num">{current.packageName}</span>
          <span className="muted">
            còn hiệu lực đến {formatDate(current.endDate)}
            {left !== null && ` · còn ${left} ngày`}
          </span>
        </p>
      )}
      {list.length > 0 && (
        <div className="membership-actions">
          {onSale && (
            <Button to={`/memberships/${latest.packageId}/checkout`}>
              {current ? `Gia hạn ${latest.packageName}` : `Mua lại ${latest.packageName}`}
            </Button>
          )}
          <Button variant="secondary" to="/memberships">{onSale ? "Chọn gói khác" : "Xem các gói tập"}</Button>
          <p className="muted small">
            {current
              ? `Thẻ mới bắt đầu ngay sau ngày ${formatDate(current.endDate)}. Trong thời hạn thẻ, bạn đặt lớp không mất thêm phí.`
              : "Bạn cần thẻ còn hiệu lực để đặt lớp. Lớp học không thu thêm phí ngoài thẻ."}
          </p>
        </div>
      )}
      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Gói tập</th>
                <th>Từ ngày</th>
                <th>Đến ngày</th>
                <th>Trạng thái</th>
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
            title="Bạn chưa có thẻ thành viên"
            action={<Button to="/memberships">Xem gói tập</Button>}
          >
            Chọn một gói ở trang Gói tập để đăng ký và thanh toán (hoặc thanh toán tại quầy lễ tân), thẻ sẽ hiện ở đây kèm ngày hết hạn.
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
      <h2 className="panel-title">Kế hoạch từ huấn luyện viên</h2>
      <ErrorNotice error={plans.error} onRetry={plans.reload} />
      {plans.data?.length ? (
        <div className="plan-list">
          {plans.data.map((p) => {
            const cls = classOf(p.classId);
            return (
              <article key={p.id} className="plan">
                <p className="label muted">
                  {cls?.className ?? "Lớp học"} · {formatDate(p.createdDate)}
                </p>
                <h3 className="plan__title">{p.title}</h3>
                <p>{p.contentDescription}</p>
                {cls?.coachName && <p className="muted">Từ {cls.coachName}</p>}
              </article>
            );
          })}
        </div>
      ) : (
        !plans.error && (
          <p className="muted">
            Chưa có kế hoạch. Huấn luyện viên sẽ lập kế hoạch cho bạn sau khi bạn vào lớp.
          </p>
        )
      )}
      <h2 className="panel-title">Kết quả</h2>
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
                  <p className="cell-strong">{plan?.title ?? "Kết quả tập luyện"}</p>
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
          <p className="muted">Chưa có kết quả. Huấn luyện viên sẽ chấm tiến độ của bạn theo kế hoạch.</p>
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
                <th>Ngày</th>
                <th>Gói tập</th>
                <th>Hình thức</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>
                  <span className="visually-hidden">In hóa đơn</span>
                </th>
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
                  <td className="cell-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      to={`/print/invoices/${i.id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      In
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !rows.error && (
          <EmptyState title="Chưa có hóa đơn">
            Lễ tân sẽ xuất hóa đơn khi bạn thanh toán gói tập.
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
    if (!text) return setError("Hãy viết điều bạn cần hỗ trợ.");
    if (text.length > 2000) return setError("Nội dung tối đa 2000 ký tự.");
    setError(null);
    setSending(true);
    try {
      await api.supportRequests.create({ content: text });
      toast.success("Đã gửi. Lễ tân sẽ trả lời tại đây.");
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
          label="Gửi câu hỏi cho lễ tân"
          name="content"
          type="textarea"
          value={content}
          onChange={(_, v) => setContent(v)}
          error={error}
          help="Câu hỏi về lớp học, thẻ thành viên, thanh toán hay bất cứ điều gì. Câu trả lời sẽ hiện bên dưới."
        />
        <Button type="submit" disabled={sending}>{sending ? "Đang gửi…" : "Gửi yêu cầu"}</Button>
      </form>
      <h2 className="panel-title">Yêu cầu của bạn</h2>
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
                      <strong>Lễ tân:</strong> {r.resolution}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            !requests.error && <p className="muted">Bạn chưa gửi yêu cầu nào.</p>
          )}
        </>
      )}
    </>
  );
}

/* ---- Profile (API) ------------------------------------------------------ */
function validateProfile(v) {
  const e = {};
  if (!v.fullName.trim()) e.fullName = "Vui lòng nhập họ tên.";
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim()))
    e.email = "Email chưa đúng định dạng, ví dụ ten@example.com.";
  if (!/^0\d{9}$/.test(v.phone.replace(/\s/g, "")))
    e.phone = "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0.";
  if (!v.dob) e.dob = "Vui lòng nhập ngày sinh.";
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
      toast.success("Đã lưu hồ sơ.");
      setEditing(false);
      me.reload();
    } catch (err) {
      toast.error(err.message || "Không lưu được hồ sơ");
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
          error={me.error ?? "Không tải được hồ sơ của bạn."}
          onRetry={me.reload}
        />
        <dl className="profile-view">
          <div>
            <dt>Họ và tên</dt>
            <dd>{user.fullName || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email || "—"}</dd>
          </div>
        </dl>
        <PasswordSection />
      </>
    );
  }

  if (!editing) {
    return (
      <div className="profile-form">
        <dl className="profile-view">
          <div>
            <dt>Họ và tên</dt>
            <dd>{p.fullName || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{p.email || "—"}</dd>
          </div>
          <div>
            <dt>Số điện thoại</dt>
            <dd className="num">{realPhone(p.phone) || "—"}</dd>
          </div>
          <div>
            <dt>Ngày sinh</dt>
            <dd className="num">{formatDate(p.dob)}</dd>
          </div>
          <div>
            <dt>Giới tính</dt>
            <dd>{p.gender ? Gender.label(p.gender) : "—"}</dd>
          </div>
          <div className="profile-view__full">
            <dt>Mục tiêu tập luyện</dt>
            <dd>{p.trainingGoal || "—"}</dd>
          </div>
        </dl>
        <div className="form-actions">
          <Button variant="secondary" icon="edit" onClick={startEdit}>
            Sửa hồ sơ
          </Button>
        </div>
        <PasswordSection />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="profile-form" noValidate>
      <div className="form-grid">
        <Field
          className="field--full"
          label="Họ và tên"
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
          label="Số điện thoại"
          name="phone"
          type="tel"
          required
          value={v.phone}
          onChange={set}
          error={errors.phone}
          autoComplete="tel"
        />
        <Field
          label="Ngày sinh"
          name="dob"
          type="date"
          required
          value={v.dob}
          onChange={set}
          error={errors.dob}
        />
        <Field
          label="Giới tính"
          name="gender"
          type="select"
          value={v.gender}
          onChange={set}
          options={GENDERS}
        />
        <Field
          className="field--full"
          label="Mục tiêu tập luyện"
          name="trainingGoal"
          type="textarea"
          value={v.trainingGoal}
          onChange={set}
        />
      </div>
      <div className="form-actions">
        <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

/* ---- Password ----------------------------------------------------------- */
// POST /api/auth/change-password checks the current password and keeps the session; an API without the
// route (older deploy) gets the "not supported yet" notice instead of a raw error.
const NO_PASSWORDS = { currentPassword: "", newPassword: "", confirmPassword: "" };

function validatePassword(v) {
  const e = {};
  if (!v.currentPassword) e.currentPassword = "Vui lòng nhập mật khẩu hiện tại.";
  if (v.newPassword.length < 8) e.newPassword = "Mật khẩu mới cần ít nhất 8 ký tự.";
  else if (v.newPassword === v.currentPassword)
    e.newPassword = "Mật khẩu mới phải khác mật khẩu hiện tại.";
  if (v.confirmPassword !== v.newPassword) e.confirmPassword = "Mật khẩu nhập lại không khớp.";
  return e;
}

function PasswordSection() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(NO_PASSWORDS);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));

  const close = () => {
    setOpen(false);
    setV(NO_PASSWORDS);
    setErrors({});
    setFormError(null);
    setUnavailable(false);
  };

  const save = async (e) => {
    e.preventDefault();
    const found = validatePassword(v);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await api.auth.changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
      toast.success("Đã đổi mật khẩu. Lần sau hãy đăng nhập bằng mật khẩu mới.");
      close();
    } catch (err) {
      if (isMissingRoute(err)) setUnavailable(true);
      else setFormError(err.message || "Không đổi được mật khẩu.");
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <section className="password-box" aria-labelledby="password-title">
      <h2 id="password-title" className="panel-title">Mật khẩu</h2>
      {!open ? (
        <div className="password-box__row">
          <p className="muted">
            Đổi mật khẩu bạn dùng để đăng nhập. Mật khẩu mới cần ít nhất 8 ký tự.
          </p>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Đổi mật khẩu
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="password-form" noValidate>
          {unavailable && (
            <Notice tone="info" title="Máy chủ chưa hỗ trợ đổi mật khẩu">
              Mật khẩu của bạn chưa thay đổi. Chức năng sẽ hoạt động ngay khi máy chủ có
              API đổi mật khẩu.
            </Notice>
          )}
          <Field
            label="Mật khẩu hiện tại"
            name="currentPassword"
            type={type}
            required
            value={v.currentPassword}
            onChange={set}
            error={errors.currentPassword}
            autoComplete="current-password"
          />
          <Field
            label="Mật khẩu mới"
            name="newPassword"
            type={type}
            required
            value={v.newPassword}
            onChange={set}
            error={errors.newPassword}
            help="Ít nhất 8 ký tự, khác mật khẩu hiện tại."
            autoComplete="new-password"
          />
          <Field
            label="Nhập lại mật khẩu mới"
            name="confirmPassword"
            type={type}
            required
            value={v.confirmPassword}
            onChange={set}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
          <label className="check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            <span>Hiện mật khẩu</span>
          </label>
          {formError && (
            <p className="field__error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <Button variant="ghost" onClick={close} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu mật khẩu mới"}
            </Button>
          </div>
          <SlowHint active={saving}>
            Máy chủ đang kiểm tra và mã hóa mật khẩu, có thể mất khoảng nửa phút.
          </SlowHint>
        </form>
      )}
    </section>
  );
}
