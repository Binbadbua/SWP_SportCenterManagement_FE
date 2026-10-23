import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { AttendanceStatus, ClassStatus } from "../../lib/enums.js";
import {
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTimeRange,
  formatWeekday,
  realPhone,
  todayLocalDateString,
} from "../../lib/format.js";
import { sportImage } from "../../lib/images.js";
import { useToast } from "../../components/Toast.jsx";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Loading,
  Notice,
  SampleDataNotice,
  StatusTag,
} from "../../components/ui.jsx";

const day = (v) => String(v).slice(0, 10);

// The session a coach most likely wants: today's, else the latest one already held, else the next
function defaultSession(sessions, today) {
  return (
    sessions.find((s) => day(s.date) === today) ??
    [...sessions].reverse().find((s) => day(s.date) < today) ??
    sessions[0]
  );
}

// Only coaches take attendance — for the classes they teach. Managers and reception read it elsewhere.
export default function Attendance() {
  const { user } = useAuth();
  if (user?.role !== "Coach") {
    return (
      <div className="staff-page">
        <EmptyState
          title="Access Restricted"
          action={<Button to="/staff">Back to Overview</Button>}
        >
          Chỉ huấn luyện viên mới được điểm danh và sửa điểm danh cho các lớp
          mình dạy.
        </EmptyState>
      </div>
    );
  }
  return <CoachAttendance user={user} />;
}

// Step by step: a sport the coach teaches → one of their classes in it → a session → mark members.
// The choice lives in the URL (?sport=…&class=…&session=…); links from the dashboard and the
// schedule only carry ?session=, and the sport and class are worked out from it.
function CoachAttendance({ user }) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const classes = useApi(() => api.coaches.classes(), [user.accountId], {
    sample: mock.coachClasses,
  });
  const sessions = useApi(() => api.schedules.list(), [], {
    sample: mock.sessions,
  });

  const myClasses = useMemo(
    () => [...(classes.data ?? [])].sort((a, b) => a.className.localeCompare(b.className)),
    [classes.data],
  );
  const mySessions = useMemo(() => {
    const ids = new Set(myClasses.map((c) => c.classId));
    return (sessions.data ?? [])
      .filter((s) => ids.has(s.classId))
      .sort((a, b) => (day(a.date) + a.startTime).localeCompare(day(b.date) + b.startTime));
  }, [sessions.data, myClasses]);
  const sports = useMemo(
    () => [...new Set(myClasses.map((c) => c.categoryName))].sort((a, b) => a.localeCompare(b)),
    [myClasses],
  );

  const today = todayLocalDateString();
  const linked = mySessions.find((s) => s.id === params.get("session"));
  const classOf = (id) => myClasses.find((c) => c.classId === id);
  const sport =
    params.get("sport") ??
    (linked ? classOf(linked.classId)?.categoryName : undefined) ??
    (sports.length === 1 ? sports[0] : undefined);
  const sportClasses = myClasses.filter((c) => c.categoryName === sport);
  const classId =
    params.get("class") ??
    linked?.classId ??
    (sportClasses.length === 1 ? sportClasses[0].classId : undefined);
  const cls = sportClasses.find((c) => c.classId === classId);
  const classSessions = mySessions.filter((s) => s.classId === cls?.classId);
  const session =
    (linked && linked.classId === cls?.classId ? linked : undefined) ??
    defaultSession(classSessions, today);
  const choose = (next) =>
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { replace: true });

  const roster = useApi(() => api.classes.members(cls.classId), [cls?.classId], {
    skip: !cls,
    sample: mock.classMembers,
  });
  const records = useApi(() => api.schedules.attendance(session.id), [session?.id], {
    skip: !session,
    sample: () => mock.attendance.filter((a) => a.sessionId === session?.id),
  });
  const [busy, setBusy] = useState(null);
  const offline = classes.usingSample || sessions.usingSample || roster.usingSample;
  const notYet = !!session && day(session.date) > today;

  const byMember = Object.fromEntries((records.data ?? []).map((r) => [r.memberId, r]));
  const counts = (roster.data ?? []).reduce((acc, m) => {
    const s = byMember[m.memberId]?.status;
    acc[s ?? 0] = (acc[s ?? 0] ?? 0) + 1;
    return acc;
  }, {});

  const mark = async (member, status) => {
    const existing = byMember[member.memberId];
    if (existing?.status === status) return;
    setBusy(member.memberId);
    try {
      if (existing)
        await api.attendance.update(existing.id, { status, recordedBy: user.accountId });
      else
        await api.attendance.record({
          sessionId: session.id,
          memberId: member.memberId,
          status,
          recordedBy: user.accountId,
        });
      records.reload();
      roster.reload();
    } catch (e) {
      toast.error(`${member.fullName}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Attendance</h1>
          <p className="muted">
            Pick the sport, then the class and the session, and mark each
            booked member. Marking someone present or late also marks their
            booking as attended.
          </p>
        </div>
      </header>

      {offline && (
        <SampleDataNotice
          onRetry={() => {
            classes.reload();
            sessions.reload();
            roster.reload();
            records.reload();
          }}
        />
      )}
      <ErrorNotice error={!classes.usingSample ? classes.error : null} onRetry={classes.reload} />
      <ErrorNotice error={!sessions.usingSample ? sessions.error : null} onRetry={sessions.reload} />

      {classes.loading || sessions.loading ? (
        <Loading />
      ) : !myClasses.length ? (
        !classes.error && (
          <EmptyState title="You don’t coach any class yet">
            When a manager assigns you a class, it shows up here.
          </EmptyState>
        )
      ) : (
        <div className="att-steps">
          <section className="att-step" aria-labelledby="att-step-sport">
            <h2 id="att-step-sport" className="att-step__title">
              <span className="att-step__num">1</span> Sport
            </h2>
            <div className="pill-row" role="group" aria-label="Sport">
              {sports.map((name) => {
                const n = myClasses.filter((c) => c.categoryName === name).length;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`pill ${name === sport ? "is-active" : ""}`}
                    aria-pressed={name === sport}
                    onClick={() => choose({ sport: name })}
                  >
                    {name}
                    <span className="pill__count">
                      {n} {n === 1 ? "class" : "classes"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {sport && (
            <section className="att-step" aria-labelledby="att-step-class">
              <h2 id="att-step-class" className="att-step__title">
                <span className="att-step__num">2</span> Class
              </h2>
              <div className="class-picks">
                {sportClasses.map((c) => {
                  const held = mySessions.filter((s) => s.classId === c.classId);
                  return (
                    <button
                      key={c.classId}
                      type="button"
                      className={`class-pick ${c.classId === cls?.classId ? "is-active" : ""}`}
                      aria-pressed={c.classId === cls?.classId}
                      onClick={() => choose({ sport, class: c.classId })}
                    >
                      <img src={sportImage(c.categoryName, c.className)} alt="" />
                      <span className="class-pick__body">
                        <span className="class-pick__name">{c.className}</span>
                        <span className="class-pick__meta num">
                          {formatShortDate(c.startDate)} – {formatDate(c.endDate)}
                        </span>
                        <span className="class-pick__meta num">
                          {c.currentEnrolled}/{c.maxCapacity} booked · {held.length}{" "}
                          {held.length === 1 ? "session" : "sessions"}
                        </span>
                        <StatusTag tone={ClassStatus.tone(c.status)}>
                          {ClassStatus.label(c.status)}
                        </StatusTag>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {cls && (
            <section className="att-step" aria-labelledby="att-step-session">
              <h2 id="att-step-session" className="att-step__title">
                <span className="att-step__num">3</span> Session
              </h2>
              {classSessions.length ? (
                <div className="session-picks" role="group" aria-label="Session">
                  {classSessions.map((s) => {
                    const d = day(s.date);
                    const when = d < today ? "is-past" : d === today ? "is-today" : "";
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`session-pick ${when} ${s.id === session?.id ? "is-active" : ""}`}
                        aria-pressed={s.id === session?.id}
                        onClick={() => choose({ sport, class: cls.classId, session: s.id })}
                      >
                        <span className="session-pick__day">
                          {d === today ? "Today" : `${formatWeekday(s.date)} ${formatShortDate(s.date)}`}
                        </span>
                        <span className="session-pick__time num">
                          {formatTimeRange(s.startTime, s.endTime)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">No sessions have been scheduled for this class yet.</p>
              )}
            </section>
          )}

          {cls && session && (
            <section className="att-step" aria-labelledby="att-step-mark">
              <div className="attendance-bar">
                <div>
                  <h2 id="att-step-mark" className="att-step__title">
                    <span className="att-step__num">4</span> Mark attendance
                  </h2>
                  <p className="muted attendance-where">
                    {cls.className} · {session.roomName} ·{" "}
                    {formatWeekday(session.date)} {formatDate(session.date)},{" "}
                    {formatTimeRange(session.startTime, session.endTime)}
                  </p>
                </div>
                <dl className="attendance-summary">
                  <div>
                    <dt>Present</dt>
                    <dd className="num">{counts[1] ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Late</dt>
                    <dd className="num">{counts[3] ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Absent</dt>
                    <dd className="num">{counts[2] ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Not marked</dt>
                    <dd className="num">{counts[0] ?? 0}</dd>
                  </div>
                </dl>
              </div>

              {notYet && (
                <Notice tone="info" title="This session hasn’t happened yet">
                  You can take attendance from {formatDate(session.date)}.
                </Notice>
              )}
              <ErrorNotice error={!roster.usingSample ? roster.error : null} onRetry={roster.reload} />
              {roster.loading || records.loading ? (
                <Loading />
              ) : roster.data?.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Checked in</th>
                        <th>
                          <span className="visually-hidden">Mark</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.data.map((m) => {
                        const rec = byMember[m.memberId];
                        return (
                          <tr key={m.memberId}>
                            <td className="cell-strong">{m.fullName}</td>
                            <td className="num">{realPhone(m.phone) || "—"}</td>
                            <td>
                              {rec ? (
                                <StatusTag tone={AttendanceStatus.tone(rec.status)}>
                                  {AttendanceStatus.label(rec.status)}
                                </StatusTag>
                              ) : (
                                <span className="muted">Not marked</span>
                              )}
                            </td>
                            <td className="num">{rec ? formatDateTime(rec.checkInTime) : "—"}</td>
                            <td className="cell-actions">
                              <div className="mark-group" role="group" aria-label={`Mark ${m.fullName}`}>
                                {[1, 3, 2].map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`mark-group__btn mark-group__btn--${AttendanceStatus.tone(s)} ${rec?.status === s ? "is-active" : ""}`}
                                    aria-pressed={rec?.status === s}
                                    disabled={offline || notYet || busy === m.memberId}
                                    onClick={() => mark(m, s)}
                                  >
                                    {AttendanceStatus.label(s)}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                !roster.error && (
                  <EmptyState title="Nobody is booked into this class">
                    Members show up here once they book the class.
                  </EmptyState>
                )
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
