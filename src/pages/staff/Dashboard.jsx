import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { ClassStatus } from "../../lib/enums.js";
import { addDaysToDateInput, formatDate, formatMoney, formatTimeRange, todayCenterDateString, } from "../../lib/format.js";
import Icon from "../../components/Icon.jsx";
import { buildRevenueReport, revenueCsv, validateRevenueRange } from "../../lib/revenue.js";
import "../../styles/revenue-report.css";
import { Button, ErrorNotice, FillBar, Loading, SampleDataNotice, StatusTag, } from "../../components/ui.jsx";

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

// Financial reports use invoices, including confirmed refunds. Legacy dashboard monthly totals do not expose that split.
function ManagerReports() {
  const today = todayCenterDateString();
  const firstDay = today.slice(0, 7) + "-01";
  const initial = { from: firstDay, to: today, grain: "day", basis: "cohort", dimension: "time", kind: "all", categoryId: "", classId: "" };
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [rangeError, setRangeError] = useState("");
  const [page, setPage] = useState(1);
  const invoices = useApi(() => api.invoices.reportList(), []);
  const membersApi = useApi(() => api.dashboard.membersSummary(), []);
  const membershipsApi = useApi(() => api.dashboard.membershipsSummary(), []);
  const classesSummaryApi = useApi(() => api.dashboard.classesSummary(), []);
  const classes = useApi(() => api.classes.list(), []);
  const invoiceRows = Array.isArray(invoices.data) ? invoices.data : invoices.data?.rows ?? [];
  const realClasses = classes.data ?? [];
  const report = useMemo(() => buildRevenueReport(invoiceRows, realClasses, filters), [invoices.data, classes.data, filters]);
  const capability = useMemo(() => buildRevenueReport(invoiceRows, realClasses, { ...draft, basis: "cohort" }), [invoices.data, classes.data, draft]);
  const monthReport = useMemo(() => buildRevenueReport(invoiceRows, realClasses, { from: firstDay, to: today, grain: "month" }), [invoices.data, classes.data, firstDay, today]);
  const categoryOptions = useMemo(() => {
    const values = new Map(realClasses.filter(item => item.categoryId).map(item => [item.categoryId, item.categoryName]));
    for (const row of invoiceRows) if (row.categoryId) values.set(row.categoryId, row.categoryName || values.get(row.categoryId) || "Môn chưa có tên");
    return [...values].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [classes.data, invoices.data]);
  const classOptions = useMemo(() => {
    const values = new Map(realClasses.map(item => [item.id, { id: item.id, name: item.className, categoryId: item.categoryId }]));
    for (const row of invoiceRows) if (row.classId && !values.has(row.classId)) values.set(row.classId, { id: row.classId, name: row.className || "Lớp không còn trong danh mục", categoryId: row.categoryId || "" });
    return [...values.values()].filter(item => !draft.categoryId || (draft.categoryId === "__unknown" ? !item.categoryId : item.categoryId === draft.categoryId)).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [classes.data, invoices.data, draft.categoryId]);
  const ms = membersApi.data ?? {};
  const cards = membershipsApi.data ?? {};
  const cs = classesSummaryApi.data ?? {};
  const invalidRows = report.issues.filter(item => !["missingRefundDate"].includes(item.code));
  const invalidMonthRows = monthReport.issues.some(item => item.code !== "missingRefundDate");
  const ready = !invoices.loading && !invoices.error && invoices.data;
  const pageCount = Math.max(1, Math.ceil(report.rows.length / 20));
  const activePage = Math.min(page, pageCount);
  const shownRows = report.rows.slice((activePage - 1) * 20, activePage * 20);

  const apply = event => {
    event.preventDefault();
    const error = validateRevenueRange(draft.from, draft.to, draft.grain);
    if (error) return setRangeError(error);
    if (draft.to > today) return setRangeError("Ngày kết thúc không được sau hôm nay.");
    if (draft.basis === "cash" && !capability.cashAvailable) return setRangeError("Chưa đủ ngày thực hoàn. Hãy chọn báo cáo theo kỳ thu tiền.");
    setRangeError("");
    setFilters({ ...draft });
    setPage(1);
  };
  const preset = (from, to) => {
    const next = { ...filters, from, to };
    setDraft(next); setFilters(next); setRangeError(""); setPage(1);
  };
  const refresh = () => { invoices.reload(); classes.reload(); membersApi.reload(); membershipsApi.reload(); classesSummaryApi.reload(); };
  const download = () => {
    if (!ready || report.error) return;
    const url = URL.createObjectURL(new Blob([revenueCsv(report, filters)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `bao-cao-thu-hoan-${filters.from}-${filters.to}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const summaryValue = (state, value) => state.loading ? "…" : state.error ? "—" : Number(value ?? 0).toLocaleString("vi-VN");

  return (
    <>
      <section className="kpis-wrap">
        <div className="section-bar"><h2 className="panel-title">Tổng quan</h2></div>
        <dl className="kpis">
          <div className="kpi"><dt>Học viên</dt><dd className="display num">{summaryValue(membersApi, ms.totalMembers ?? ms.activeMembers)}</dd>{ms.newMembersLast30Days !== undefined && <dd className="kpi__sub">{ms.newMembersLast30Days} mới trong 30 ngày qua</dd>}</div>
          <div className="kpi"><dt>Thẻ còn hiệu lực</dt><dd className="display num">{summaryValue(membershipsApi, cards.activeMemberships)}</dd>{cards.expiringSoon !== undefined && <dd className="kpi__sub">{cards.expiringSoon} thẻ sắp hết hạn</dd>}</div>
          <div className="kpi"><dt>Lượt đặt lớp</dt><dd className="display num">{summaryValue(classesSummaryApi, cs.totalBookings)}</dd>{cs.totalClasses !== undefined && <dd className="kpi__sub">trên {cs.totalClasses} lớp, {cs.totalSessions} buổi</dd>}</div>
          <div className="kpi"><dt>Hóa đơn tháng này, sau hoàn</dt><dd className="display num">{invoices.loading ? "…" : invoices.error || monthReport.error || invalidMonthRows ? "—" : formatMoney(monthReport.totals.net)}</dd><dd className="kpi__sub">Theo kỳ thu gốc, trạng thái hoàn hiện tại</dd></div>
        </dl>
        <ErrorNotice error={membersApi.error || membershipsApi.error || classesSummaryApi.error} onRetry={refresh} />
      </section>

      <section className="panel revenue-report" aria-labelledby="revenue-report-title">
        <div className="section-bar">
          <div><h2 id="revenue-report-title" className="panel-title">Báo cáo thu tiền và hoàn tiền</h2><p className="revenue-report__lead">Chọn khoảng thời gian, nhóm theo ngày/tuần/tháng hoặc xem theo môn, lớp. Tiền đã hoàn được tách riêng; yêu cầu đang chờ hoàn chưa bị trừ.</p></div>
          <Button variant="secondary" size="sm" onClick={refresh} disabled={invoices.loading}>Cập nhật dữ liệu</Button>
        </div>
        <form className="revenue-filters" onSubmit={apply} noValidate>
          <label>Từ ngày<input type="date" value={draft.from} max={today} onChange={event => setDraft({ ...draft, from: event.target.value })} required /></label>
          <label>Đến ngày<input type="date" value={draft.to} max={today} onChange={event => setDraft({ ...draft, to: event.target.value })} required /></label>
          <label>Nhóm thời gian<select value={draft.grain} onChange={event => setDraft({ ...draft, grain: event.target.value })}><option value="day">Theo ngày</option><option value="week">Theo tuần (T2–CN)</option><option value="month">Theo tháng</option></select></label>
          <label>Hiển thị theo<select value={draft.dimension} onChange={event => setDraft({ ...draft, dimension: event.target.value })}><option value="time">Thời gian</option><option value="sport">Môn / nội dung</option><option value="class">Lớp / nội dung</option></select></label>
          <label>Loại thu<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value, categoryId: "", classId: "" })}><option value="all">Tất cả</option><option value="class">Học phí lớp</option><option value="membership">Gói tập / nâng cấp</option></select></label>
          <label>Môn thể thao<select disabled={draft.kind === "membership"} value={draft.categoryId} onChange={event => setDraft({ ...draft, categoryId: event.target.value, classId: "" })}><option value="">Tất cả môn / nội dung</option>{categoryOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__unknown">Chưa xác định môn</option></select></label>
          <label className="revenue-filters__wide">Lớp học<select disabled={draft.kind === "membership"} value={draft.classId} onChange={event => setDraft({ ...draft, classId: event.target.value })}><option value="">Tất cả lớp / nội dung</option>{classOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="revenue-filters__wide">Cơ sở báo cáo<select value={draft.basis} onChange={event => setDraft({ ...draft, basis: event.target.value })}><option value="cohort">Kỳ thu tiền, trừ hoàn của hóa đơn thuộc kỳ</option><option value="cash" disabled={!ready || !capability.cashAvailable}>Dòng tiền theo ngày thực thu / thực hoàn</option></select></label>
          <div className="revenue-filters__actions"><Button type="submit" size="sm">Áp dụng bộ lọc</Button><Button variant="secondary" size="sm" onClick={download} disabled={!ready || !!report.error}>Tải CSV đang hiển thị</Button></div>
          {rangeError && <p className="revenue-report__error" role="alert">{rangeError}</p>}
        </form>
        <div className="revenue-presets" aria-label="Khoảng báo cáo nhanh"><button type="button" onClick={() => preset(addDaysToDateInput(today, -6), today)}>7 ngày gần đây</button><button type="button" onClick={() => preset(addDaysToDateInput(today, -29), today)}>30 ngày gần đây</button><button type="button" onClick={() => preset(firstDay, today)}>Tháng này</button><button type="button" onClick={() => preset(addDaysToDateInput(today, -89), today)}>90 ngày gần đây</button></div>

        <ErrorNotice error={invoices.error} onRetry={invoices.reload} />
        <ErrorNotice error={classes.error} onRetry={classes.reload} />
        {invoices.loading ? <Loading label="Đang đọc hóa đơn và trạng thái hoàn tiền" /> : ready && (
          <>
            <p className="revenue-report__caption">Đang xem <strong>{formatDate(filters.from)} – {formatDate(filters.to)}</strong> · {Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / 86400000) + 1} ngày · {invoiceRows.length} hóa đơn nguồn.</p>
            {filters.basis === "cohort" && <div className="revenue-report__note">Báo cáo theo ngày thu gốc của hóa đơn, với trạng thái hoàn tiền hiện tại. Khoản hoàn được trừ về kỳ thu gốc, không phải ngày lễ tân thực trả. {report.cashAvailable ? "Bạn có thể chọn dòng tiền theo ngày phát sinh." : "Chưa đủ dữ liệu ngày thực hoàn để lập dòng tiền theo ngày/tuần/tháng."}</div>}
            {report.implicitFullRefundCount > 0 && <p className="muted small">Trạng thái Đã hoàn tiền hiện tương ứng hoàn đủ số đã thu. Có {report.implicitFullRefundCount} hóa đơn chưa có số tiền hoàn riêng; báo cáo chưa dùng cho hoàn một phần.</p>}
            {invalidRows.length > 0 && <div className="revenue-report__note" role="alert">Có {invalidRows.length} dòng thiếu hoặc không hợp lệ (ngày thanh toán, số tiền hoặc mã hóa đơn). Các số dưới đây chỉ là phần dữ liệu xác định được; chưa thể kết luận tổng đầy đủ.</div>}
            {report.unknownCategories > 0 && <p className="muted small">{report.unknownCategories} hóa đơn lớp chưa có môn đối chiếu; được giữ trong nhóm Chưa xác định môn, không tự phân bổ tiền sang môn khác.</p>}
            {report.error ? <p className="field__error" role="alert">{report.error}</p> : (
              <>
                <dl className="revenue-report__summary">
                  <div className="revenue-report__metric"><dt>Tổng đã thu trước hoàn</dt><dd className="num">{formatMoney(report.totals.gross)}</dd><small>{report.totals.receiptCount} hóa đơn đã thu, gồm hóa đơn sau đó được hoàn</small></div>
                  <div className="revenue-report__metric"><dt>Đã hoàn thực tế</dt><dd className="num">{formatMoney(report.totals.refunds)}</dd><small>{report.totals.refundCount} hóa đơn đã xác nhận hoàn</small></div>
                  <div className="revenue-report__metric revenue-report__metric--net"><dt>Thu sau hoàn</dt><dd className="num">{formatMoney(report.totals.net)}</dd><small>Tổng đã thu − Đã hoàn thực tế</small></div>
                  <div className="revenue-report__metric"><dt>Chờ hoàn của hóa đơn trong kỳ</dt><dd className="num">{formatMoney(report.totals.pendingRefund)}</dd><small>{report.totals.pendingCount} yêu cầu hiện tại, chưa trừ khỏi thu sau hoàn</small>{report.totals.pendingCount > 0 && <Link className="text-link small" to="/staff/invoices?refund=pending">Xem yêu cầu chờ hoàn</Link>}</div>
                </dl>
                <div className="table-wrap"><table className="table"><thead><tr><th scope="col">{filters.dimension === "time" ? filters.grain === "day" ? "Ngày" : filters.grain === "week" ? "Tuần" : "Tháng" : filters.dimension === "sport" ? "Môn / nội dung" : "Lớp / nội dung"}</th><th scope="col">Hóa đơn đã thu</th><th scope="col">Tổng đã thu</th><th scope="col">Đã hoàn</th><th scope="col">Thu sau hoàn</th><th scope="col">Chờ hoàn</th></tr></thead><tbody>{shownRows.length ? shownRows.map(row => <tr key={row.key}><th scope="row" className="revenue-report__row-label">{row.label}{row.sublabel && <small>{row.sublabel}</small>}</th><td className="num">{row.receiptCount}</td><td className="num revenue-report__money">{formatMoney(row.gross)}</td><td className="num revenue-report__money">{formatMoney(row.refunds)}</td><td className="num revenue-report__money"><strong>{formatMoney(row.net)}</strong></td><td className="num revenue-report__money">{formatMoney(row.pendingRefund)}</td></tr>) : <tr><td colSpan={6}>Không có giao dịch thuộc bộ lọc này.</td></tr>}</tbody><tfoot><tr><th scope="row">Tổng kỳ đã chọn</th><td className="num">{report.totals.receiptCount}</td><td className="num revenue-report__money">{formatMoney(report.totals.gross)}</td><td className="num revenue-report__money">{formatMoney(report.totals.refunds)}</td><td className="num revenue-report__money"><strong>{formatMoney(report.totals.net)}</strong></td><td className="num revenue-report__money">{formatMoney(report.totals.pendingRefund)}</td></tr></tfoot></table></div>
                {pageCount > 1 && <nav className="revenue-report__pager" aria-label="Phân trang báo cáo"><Button variant="secondary" size="sm" disabled={activePage <= 1} onClick={() => setPage(activePage - 1)}>Trang trước</Button><span>Trang {activePage}/{pageCount} · {report.rows.length} nhóm</span><Button variant="secondary" size="sm" disabled={activePage >= pageCount} onClick={() => setPage(activePage + 1)}>Trang sau</Button></nav>}
              </>
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
