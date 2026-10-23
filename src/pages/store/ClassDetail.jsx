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
  // The roster and coach profile are staff-only on the API, so other users don't request them.
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
          title="We couldn’t find that class"
          action={<Button to="/classes">Browse classes</Button>}
        >
          It may have been removed or the link is wrong.
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

  const book = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (!memberId) {
      setActionError(
        profile.status === "loading"
          ? "Still loading your member profile — try again in a moment."
          : `We couldn’t find your member profile, so the booking can’t be made. ${profile.error?.message ?? ""}`.trim(),
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
      <>
        <Button
          size="lg"
          block
          onClick={book}
          disabled={busy || closed || spotsLeft === 0 || sessions.loading || noSessionsLeft}
        >
          {closed
            ? "Booking closed"
            : noSessionsLeft
              ? "No upcoming sessions"
              : spotsLeft === 0
                ? "Class is full"
                : busy
                  ? "Booking…"
                  : user
                    ? "Book this class"
                    : "Sign in to book"}
        </Button>
        {!closed && noSessionsLeft && (
          <p className="muted small">
            {allSessions.length
              ? "Every session of this class has already taken place, so it can’t be booked."
              : "No sessions have been scheduled yet. Booking opens once the class has sessions."}
          </p>
        )}
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
                {knownTaken
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
                    const past = isSessionOver(s);
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
              <p className="muted">Sessions haven’t been scheduled yet.</p>
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
