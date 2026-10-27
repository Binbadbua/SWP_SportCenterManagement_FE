import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { isMember, useAuth } from "../../context/AuthContext.jsx";
import { sportImage, IMAGES, classThumbnails } from "../../lib/images.js";
import {
  formatDate,
  formatDateRange,
  formatShortDate,
  formatTimeRange,
  formatWeekday,
  isSessionOver,
} from "../../lib/format.js";
import { ClassStatus } from "../../lib/enums.js";
import { cardCheck } from "../../lib/membership.js";
import Icon from "../../components/Icon.jsx";
import { classEyebrow, CoachPortrait } from "../../components/cards.jsx";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Loading,
  Notice,
  SampleDataNotice,
} from "../../components/ui.jsx";

const SESSIONS_SHOWN = 12;

export default function ClassDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sampleClass = () => mock.classes.find((c) => c.id === id) ?? null;
  const role = user?.role;
  const member = isMember(user);
  const memberId = member ? user.memberId : undefined;

  const cls = useApi(() => api.classes.get(id), [id], { sample: sampleClass });
  const sessions = useApi(() => api.schedules.byClass(id), [id], {
    sample: () => mock.sessions.filter((s) => s.classId === id),
  });
  // The roster is staff-only on the API, so other users don't request it.
  const roster = useApi(() => api.classes.members(id), [id], {
    skip: !["CenterManager", "Coach"].includes(role),
    sample: () =>
      Array.from(
        { length: sampleClass()?._enrolled ?? 0 },
        (_, i) => mock.classMembers[i] ?? { memberId: `sample-${i}` },
      ),
  });
  const categories = useApi(() => api.categories.list(), [], {
    sample: mock.categories,
  });
  const coachId = cls.data?.coachId;
  const coach = useApi(() => api.coaches.get(coachId), [coachId], {
    skip: !coachId,
    sample: () => mock.coaches.find((c) => c.id === coachId),
  });
  const myBookings = useApi(() => api.bookings.mine(), [user?.accountId], {
    skip: !member,
    sample: () => mock.bookings.filter((b) => b.memberId === memberId),
  });
  // Booking needs a card valid on the class's next session (lib/membership.js)
  const myCards = useApi(() => api.memberships.mine(), [user?.accountId], {
    skip: !member,
  });

  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [booked, setBooked] = useState(null); // confirmation panel
  const [newBooking, setNewBooking] = useState(null); // booking made on this page

  if (cls.loading)
    return (
      <div className="container">
        <Loading />
      </div>
    );
  if (!cls.data) {
    return (
      <div className="container">
        <ErrorNotice
          error={cls.error?.status === 404 ? null : cls.error}
          onRetry={cls.reload}
        />
        <EmptyState
          title="Không tìm thấy lớp học này"
          action={<Button to="/classes">Xem các lớp học</Button>}
        >
          Có thể lớp đã bị xóa hoặc đường dẫn không đúng.
        </EmptyState>
      </div>
    );
  }

  const c = cls.data;
  // Staff see the roster; everyone else gets the count the class itself carries (currentEnrolled)
  const enrolled = roster.data ? roster.data.length : c.currentEnrolled;
  const knownTaken = enrolled !== undefined && enrolled !== null;
  const taken = knownTaken ? enrolled : 0;
  const spotsLeft = Math.max(0, c.maxCapacity - taken);
  const eyebrow = classEyebrow(c, knownTaken ? spotsLeft : undefined);
  const category = (categories.data ?? []).find((x) => x.id === c.categoryId);
  const allSessions = sessions.data ?? [];
  const shownSessions = showAll
    ? allSessions
    : allSessions.slice(0, SESSIONS_SHOWN);
  const firstRoom = allSessions[0]?.roomName;
  const myBooking =
    (myBookings.data ?? []).find((b) => b.classId === c.id && b.status !== 3) ??
    (newBooking?.classId === c.id ? newBooking : undefined);
  const closed = c.status === 3 || c.status === 4;
  // A booking covers the class's remaining sessions, so a class with none left can't be booked
  const upcoming = allSessions.filter((s) => !isSessionOver(s));
  const noSessionsLeft = !sessions.loading && upcoming.length === 0;
  const usingSample = cls.usingSample || sessions.usingSample;
  // null until both the member's cards and the sessions are known
  const card =
    member && myCards.data && !sessions.loading && !sessions.usingSample
      ? cardCheck(myCards.data, allSessions)
      : null;
  const needsCard = card?.ok === false;
  const checkingCard = member && (myCards.loading || !!myCards.error);

  const book = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (!memberId) {
      setActionError(
        profile.status === "loading"
          ? "Đang tải hồ sơ học viên của bạn — vui lòng thử lại sau giây lát."
          : `Không tìm thấy hồ sơ học viên của bạn nên chưa đặt lớp được. ${profile.error?.message ?? ""}`.trim(),
      );
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.bookings.create({ memberId, classId: c.id });
      setBooked(result);
      setNewBooking(result);
      roster.reload();
      myBookings.reload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.bookings.cancel(myBooking.id, myBooking.memberId ?? memberId);
      setNewBooking(null);
      roster.reload();
      myBookings.reload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  let cta;
  if (user && !member) {
    cta = (
      <p className="pdp__note">
        Bạn đang đăng nhập bằng tài khoản nhân viên. Hãy đặt lớp cho học viên trong{" "}
        <Link className="text-link" to="/staff/bookings">
          khu vực nhân viên
        </Link>
        .
      </p>
    );
  } else if (myBooking) {
    cta = (
      <>
        <div className="pdp__booked">
          <Icon name="check" size={20} strokeWidth={2} /> Bạn đã đặt lớp
          này
        </div>
        <Button
          variant="secondary"
          size="lg"
          block
          onClick={cancel}
          disabled={busy}
        >
          Hủy đặt lớp
        </Button>
      </>
    );
  } else {
    const open = !closed && !noSessionsLeft && spotsLeft > 0;
    cta = (
      <>
        <Button
          size="lg"
          block
          onClick={book}
          disabled={busy || !open || sessions.loading || checkingCard || needsCard}
        >
          {closed
            ? "Đã đóng đăng ký"
            : noSessionsLeft
              ? "Không còn buổi học sắp tới"
              : spotsLeft === 0
                ? "Lớp đã đủ chỗ"
                : busy
                  ? "Đang đặt…"
                  : needsCard
                    ? "Cần thẻ thành viên còn hiệu lực"
                    : user
                      ? "Đặt lớp này"
                      : "Đăng nhập để đặt lớp"}
        </Button>
        {!closed && noSessionsLeft && (
          <p className="muted small">
            {allSessions.length
              ? "Tất cả các buổi của lớp này đã diễn ra nên không thể đặt nữa."
              : "Lớp chưa được xếp buổi học. Lớp sẽ mở đăng ký khi có lịch học."}
          </p>
        )}
        {open && !user && (
          <p className="muted small">
            Lớp học không thu thêm phí: bạn cần một thẻ thành viên còn hiệu lực vào ngày của buổi học kế tiếp.
          </p>
        )}
        {open && member && myCards.error && (
          <ErrorNotice error={myCards.error} onRetry={myCards.reload} />
        )}
        {open && needsCard && (
          <Notice
            tone="warning"
            title="Cần thẻ thành viên để đặt lớp"
            action={<Button size="sm" to="/memberships">Xem gói tập</Button>}
          >
            {card.reason} Lớp học không thu thêm phí, nhưng bạn cần một thẻ còn hiệu lực vào ngày của buổi học kế
            tiếp ({formatDate(card.nextDate)}). Xem thẻ của bạn ở{" "}
            <Link className="text-link" to="/account?tab=membership">Tài khoản → Thẻ thành viên</Link>.
          </Notice>
        )}
        {open && card?.warning && <p className="muted small">{card.warning}</p>}
      </>
    );
  }

  return (
    <div className="pdp container">
      {usingSample && (
        <div className="section-notice">
          <SampleDataNotice
            onRetry={() => {
              cls.reload();
              sessions.reload();
            }}
          />
        </div>
      )}

      <div className="pdp__grid">
        <div className="pdp__gallery">
          <img
            className="pdp__main-img"
            src={sportImage(c.categoryName, c.className)}
            alt={`Lớp ${c.categoryName}`}
          />
          <div className="pdp__thumbs">
            {classThumbnails(c.categoryName, c.className).map((imgSrc, idx) => (
              <img
                key={idx}
                src={imgSrc}
                alt={`Ảnh cơ sở vật chất ${idx + 1}`}
                loading="lazy"
                onError={(e) => {
                  const img = e.target;
                  if (!img.dataset.triedPng && img.src.endsWith(".jpg")) {
                    img.dataset.triedPng = "true";
                    img.src = img.src.replace(".jpg", ".png");
                  } else if (
                    !img.dataset.triedJpg &&
                    img.src.endsWith(".png")
                  ) {
                    img.dataset.triedJpg = "true";
                    img.src = img.src.replace(".png", ".jpg");
                  } else {
                    img.src = idx === 0 ? IMAGES.facility : IMAGES.mono;
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div className="pdp__info">
          <nav className="crumbs" aria-label="Đường dẫn">
            <Link to="/classes">Lớp học</Link> /{" "}
            <Link to={`/classes?sport=${c.categoryId}`}>{c.categoryName}</Link>
          </nav>
          <h1 className="pdp__title">{c.className}</h1>
          <p className="pdp__sub">
            Lớp {c.categoryName} · cùng {c.coachName}
          </p>
          <p className="pdp__price">Không thu thêm phí khi bạn có thẻ thành viên còn hiệu lực</p>
          <p className={`pdp__eyebrow eyebrow--${eyebrow.tone}`}>
            {eyebrow.text}
          </p>

          {/* Spots meter */}
          <div className="spots">
            <div className="spots__row">
              <span className="spots__label">Số chỗ</span>
              <span className="num">
                {knownTaken
                  ? `Đã đặt ${taken}/${c.maxCapacity}`
                  : `Tối đa ${c.maxCapacity}`}
              </span>
            </div>
            <div className="spots__bar" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, (taken / c.maxCapacity) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Session grid, styled like a size chart */}
          <div className="sessions">
            <div className="sessions__head">
              <h2 className="sessions__title">Các buổi học</h2>
              <span className="muted num">
                {allSessions.length} buổi ·{" "}
                {formatDateRange(c.startDate, c.endDate)}
              </span>
            </div>
            {sessions.loading ? (
              <Loading />
            ) : allSessions.length ? (
              <>
                <ul className="size-grid">
                  {shownSessions.map((s) => {
                    const past = isSessionOver(s);
                    return (
                      <li
                        key={s.id}
                        className={`size-grid__cell ${past ? "is-past" : ""}`}
                        title={
                          past
                            ? "Buổi học này đã diễn ra"
                            : s.roomName
                        }
                      >
                        <span className="size-grid__day">
                          {formatWeekday(s.date)} {formatShortDate(s.date)}
                        </span>
                        <span className="size-grid__time num">
                          {formatTimeRange(s.startTime, s.endTime)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {allSessions.length > SESSIONS_SHOWN && (
                  <button
                    type="button"
                    className="plain-btn sessions__more"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll
                      ? "Thu gọn"
                      : `Xem tất cả ${allSessions.length} buổi`}
                  </button>
                )}
                <p className="sessions__hint muted">
                  Đặt một lần là tham gia mọi buổi của lớp.
                </p>
              </>
            ) : (
              <p className="muted">Lớp chưa được xếp buổi học.</p>
            )}
          </div>

          <div className="pdp__cta">
            {cta}
            {actionError && (
              <p className="field__error" role="alert">
                {actionError}
              </p>
            )}
          </div>

          <div className="accordions">
            <details open>
              <summary>Giới thiệu {c.categoryName}</summary>
              <p>
                {category?.description ||
                  "Thông tin về môn này sẽ sớm được cập nhật."}
              </p>
              <ul className="facts">
                <li>
                  <span>Trạng thái</span>
                  {ClassStatus.label(c.status)}
                </li>
                <li>
                  <span>Thời gian</span>
                  {formatDate(c.startDate)} – {formatDate(c.endDate)}
                </li>
                <li>
                  <span>Sĩ số</span>Tối đa {c.maxCapacity} người
                </li>
                {firstRoom && (
                  <li>
                    <span>Phòng</span>
                    {firstRoom}
                  </li>
                )}
              </ul>
            </details>
            <details open>
              <summary>Huấn luyện viên của bạn</summary>
              {/* A short card only: the full profile (sports, contact, schedule) is on the coach's page */}
              <div className="class-coach">
                <Link to={`/coaches/${c.coachId}`} className="mini-coach mini-coach--link">
                  <CoachPortrait coach={coach.data ?? { fullName: c.coachName }} size="sm" />
                  <div>
                    <p className="cell-strong">{coach.data?.fullName ?? c.coachName}</p>
                    <p className="muted">
                      {coach.data
                        ? `${coach.data.specialization || "Huấn luyện viên"} · ${coach.data.experienceYears} năm kinh nghiệm`
                        : "Huấn luyện viên phụ trách lớp"}
                    </p>
                  </div>
                </Link>
                <Link className="text-link" to={`/coaches/${c.coachId}`}>
                  Xem hồ sơ và lịch dạy của huấn luyện viên
                </Link>
              </div>
            </details>
            <details>
              <summary>Hủy đặt lớp</summary>
              <p>
                Bạn có thể tự hủy trên web cho đến khi học buổi đầu tiên. Sau đó, hãy
                nhờ lễ tân hỗ trợ.
              </p>
            </details>
          </div>
        </div>
      </div>

      {booked && (
        <div className="booked-panel" role="status">
          <div className="booked-panel__head">
            <span>
              <Icon name="check" size={18} strokeWidth={2.2} /> Đã đặt lớp
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setBooked(null)}
              aria-label="Đóng"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="booked-panel__item">
            <img src={sportImage(c.categoryName, c.className)} alt="" />
            <div>
              <p className="cell-strong">{booked.className}</p>
              <p className="muted">
                Khai giảng {formatDate(booked.classStartDate)}
              </p>
            </div>
          </div>
          <div className="booked-panel__actions">
            <Button variant="secondary" to="/account?tab=bookings">
              Xem lớp đã đặt
            </Button>
            <Button onClick={() => setBooked(null)}>Xem tiếp</Button>
          </div>
        </div>
      )}
    </div>
  );
}
