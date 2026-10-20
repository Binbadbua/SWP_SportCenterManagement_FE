import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { sportImage, IMAGES, classThumbnails } from "../../lib/images.js";
import {
  formatDate,
  formatDateRange,
  formatShortDate,
  formatTimeRange,
  formatWeekday,
  todayUtcDateString,
} from "../../lib/format.js";
import { ClassStatus } from "../../lib/enums.js";
import Icon from "../../components/Icon.jsx";
import { classEyebrow, CoachPortrait } from "../../components/cards.jsx";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Loading,
  SampleDataNotice,
} from "../../components/ui.jsx";

const SESSIONS_SHOWN = 12;

export default function ClassDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sampleClass = () => mock.classes.find((c) => c.id === id) ?? null;

  const cls = useApi(() => api.classes.get(id), [id], { sample: sampleClass });
  const sessions = useApi(() => api.schedules.byClass(id), [id], {
    sample: () => mock.sessions.filter((s) => s.classId === id),
  });
  const roster = useApi(() => api.classes.members(id), [id], {
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
  const isMember = user?.role === "member" && user.memberId;
  const myBookings = useApi(
    () => api.bookings.byMember(user.memberId),
    [user?.memberId],
    {
      skip: !isMember,
      sample: () => mock.bookings.filter((b) => b.memberId === user?.memberId),
    },
  );

  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [booked, setBooked] = useState(null); // confirmation panel

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
          title="We couldn’t find that class"
          action={<Button to="/classes">Browse classes</Button>}
        >
          It may have been removed or the link is wrong.
        </EmptyState>
      </div>
    );
  }

  const c = cls.data;
  const taken = roster.data?.length ?? 0;
  const spotsLeft = Math.max(0, c.maxCapacity - taken);
  const eyebrow = classEyebrow(c, roster.data ? spotsLeft : undefined);
  const category = (categories.data ?? []).find((x) => x.id === c.categoryId);
  const today = todayUtcDateString();
  const allSessions = sessions.data ?? [];
  const shownSessions = showAll
    ? allSessions
    : allSessions.slice(0, SESSIONS_SHOWN);
  const firstRoom = allSessions[0]?.roomName;
  const myBooking = (myBookings.data ?? []).find((b) => b.classId === c.id);
  const closed = c.status === 3 || c.status === 4;
  const usingSample = cls.usingSample || sessions.usingSample;

  const book = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.bookings.create({
        memberId: user.memberId,
        classId: c.id,
      });
      setBooked(result);
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
      await api.bookings.cancel(myBooking.id, user.memberId);
      roster.reload();
      myBookings.reload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  let cta;
  if (user && user.role !== "member") {
    cta = (
      <p className="pdp__note">
        Signed in as staff. Book members in from the{" "}
        <Link className="text-link" to="/staff/bookings">
          staff area
        </Link>
        .
      </p>
    );
  } else if (myBooking) {
    cta = (
      <>
        <div className="pdp__booked">
          <Icon name="check" size={20} strokeWidth={2} /> You’re booked into
          this class
        </div>
        <Button
          variant="secondary"
          size="lg"
          block
          onClick={cancel}
          disabled={busy}
        >
          Cancel booking
        </Button>
      </>
    );
  } else {
    cta = (
      <Button
        size="lg"
        block
        onClick={book}
        disabled={busy || closed || spotsLeft === 0}
      >
        {closed
          ? "Booking closed"
          : spotsLeft === 0
            ? "Class is full"
            : busy
              ? "Booking…"
              : user
                ? "Book this class"
                : "Sign in to book"}
      </Button>
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
            alt={`${c.categoryName} class`}
          />
          <div className="pdp__thumbs">
            {classThumbnails(c.categoryName, c.className).map((imgSrc, idx) => (
              <img
                key={idx}
                src={imgSrc}
                alt={`Facility view ${idx + 1}`}
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
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/classes">Classes</Link> /{" "}
            <Link to={`/classes?sport=${c.categoryId}`}>{c.categoryName}</Link>
          </nav>
          <h1 className="pdp__title">{c.className}</h1>
          <p className="pdp__sub">
            {c.categoryName} class · with {c.coachName}
          </p>
          <p className="pdp__price">Included in every membership</p>
          <p className={`pdp__eyebrow eyebrow--${eyebrow.tone}`}>
            {eyebrow.text}
          </p>

          {/* Spots meter */}
          <div className="spots">
            <div className="spots__row">
              <span className="spots__label">Spots</span>
              <span className="num">
                {roster.data
                  ? `${taken} of ${c.maxCapacity} taken`
                  : `Up to ${c.maxCapacity}`}
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
              <h2 className="sessions__title">Sessions</h2>
              <span className="muted num">
                {allSessions.length} in this class ·{" "}
                {formatDateRange(c.startDate, c.endDate)}
              </span>
            </div>
            {sessions.loading ? (
              <Loading />
            ) : allSessions.length ? (
              <>
                <ul className="size-grid">
                  {shownSessions.map((s) => {
                    const past = s.date.slice(0, 10) < today;
                    return (
                      <li
                        key={s.id}
                        className={`size-grid__cell ${past ? "is-past" : ""}`}
                        title={
                          past
                            ? "This session has already happened"
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
                      ? "Show fewer"
                      : `Show all ${allSessions.length} sessions`}
                  </button>
                )}
                <p className="sessions__hint muted">
                  One booking covers every session in the class.
                </p>
              </>
            ) : (
              <p className="muted">
                Sessions haven’t been scheduled yet. You can still book to hold
                your spot.
              </p>
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
              <summary>About {c.categoryName}</summary>
              <p>
                {category?.description ||
                  "Details for this sport are coming soon."}
              </p>
              <ul className="facts">
                <li>
                  <span>Status</span>
                  {ClassStatus.label(c.status)}
                </li>
                <li>
                  <span>Runs</span>
                  {formatDate(c.startDate)} – {formatDate(c.endDate)}
                </li>
                <li>
                  <span>Class size</span>Up to {c.maxCapacity} people
                </li>
                {firstRoom && (
                  <li>
                    <span>Room</span>
                    {firstRoom}
                  </li>
                )}
              </ul>
            </details>
            <details>
              <summary>Your coach</summary>
              {coach.data ? (
                <div className="mini-coach">
                  <CoachPortrait coach={coach.data} size="sm" />
                  <div>
                    <p className="cell-strong">{coach.data.fullName}</p>
                    <p className="muted">
                      {coach.data.specialization || "Coach"} ·{" "}
                      {coach.data.experienceYears} years coaching
                    </p>
                  </div>
                </div>
              ) : (
                <p>{c.coachName}</p>
              )}
            </details>
            <details>
              <summary>Cancelling</summary>
              <p>
                You can cancel your booking online until you’ve attended your
                first session. After that, ask reception.
              </p>
            </details>
          </div>
        </div>
      </div>

      {booked && (
        <div className="booked-panel" role="status">
          <div className="booked-panel__head">
            <span>
              <Icon name="check" size={18} strokeWidth={2.2} /> Booked
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setBooked(null)}
              aria-label="Close"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="booked-panel__item">
            <img src={sportImage(c.categoryName, c.className)} alt="" />
            <div>
              <p className="cell-strong">{booked.className}</p>
              <p className="muted">
                Starts {formatDate(booked.classStartDate)}
              </p>
            </div>
          </div>
          <div className="booked-panel__actions">
            <Button variant="secondary" to="/account?tab=bookings">
              View my bookings
            </Button>
            <Button onClick={() => setBooked(null)}>Keep browsing</Button>
          </div>
        </div>
      )}
    </div>
  );
}
