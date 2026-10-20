import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/endpoints.js";
import * as mock from "../../api/mockData.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { AttendanceStatus } from "../../lib/enums.js";
import {
  formatDate,
  formatDateTime,
  formatTimeRange,
  formatWeekday,
  todayUtcDateString,
} from "../../lib/format.js";
import { useToast } from "../../components/Toast.jsx";
import {
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  SampleDataNotice,
  StatusTag,
} from "../../components/ui.jsx";

// Take attendance for one session: roster = members booked into the session's class.
export default function Attendance() {
  const { user } = useAuth();
  if (!["Coach", "CenterManager"].includes(user?.role)) {
    return (
      <div className="staff-page">
        <EmptyState
          title="Access Restricted"
          action={<Button to="/staff">Back to Overview</Button>}
        >
          Trang điểm danh chỉ dành cho Huấn luyện viên và Quản lý trung tâm. Bạn
          không có quyền truy cập tính năng này.
        </EmptyState>
      </div>
    );
  }
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const sessions = useApi(() => api.schedules.list(), [], {
    sample: mock.sessions,
  });

  const sorted = useMemo(
    () =>
      [...(sessions.data ?? [])].sort((a, b) =>
        (a.date + a.startTime).localeCompare(b.date + b.startTime),
      ),
    [sessions.data],
  );
  const today = todayUtcDateString();
  const defaultSession =
    sorted.find((s) => s.date.slice(0, 10) >= today) ??
    sorted[sorted.length - 1];
  const sessionId = params.get("session") || defaultSession?.id || "";
  const session = sorted.find((s) => s.id === sessionId);

  const roster = useApi(
    () => api.classes.members(session.classId),
    [session?.classId],
    { skip: !session, sample: mock.classMembers },
  );
  const records = useApi(
    () => api.schedules.attendance(session.id),
    [session?.id],
    {
      skip: !session,
      sample: () => mock.attendance.filter((a) => a.sessionId === session?.id),
    },
  );
  const [busy, setBusy] = useState(null);
  const offline = sessions.usingSample || roster.usingSample;

  const byMember = Object.fromEntries(
    (records.data ?? []).map((r) => [r.memberId, r]),
  );
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
        await api.attendance.update(existing.id, {
          status,
          recordedBy: user.accountId,
        });
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

  const sessionOptions = sorted.map((s) => ({
    value: s.id,
    label: `${formatWeekday(s.date)} ${formatDate(s.date)} · ${formatTimeRange(s.startTime, s.endTime)} · ${s.className}`,
  }));

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Attendance</h1>
          <p className="muted">
            Pick a session, then mark each booked member. Marking someone
            present also marks their booking as attended.
          </p>
        </div>
      </header>

      {offline && (
        <SampleDataNotice
          onRetry={() => {
            sessions.reload();
            roster.reload();
            records.reload();
          }}
        />
      )}
      <ErrorNotice
        error={!sessions.usingSample ? sessions.error : null}
        onRetry={sessions.reload}
      />

      {sessions.loading ? (
        <Loading />
      ) : !sorted.length ? (
        <EmptyState title="No sessions scheduled">
          Add sessions in Schedule first.
        </EmptyState>
      ) : (
        <>
          <div className="attendance-bar">
            <Field
              label="Session"
              name="session"
              type="select"
              value={sessionId}
              options={sessionOptions}
              onChange={(_, v) => setParams(v ? { session: v } : {})}
            />
            {session && (
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
            )}
          </div>

          {session && (
            <p className="muted attendance-where">
              {session.className} · {session.roomName} ·{" "}
              {formatWeekday(session.date)} {formatDate(session.date)},{" "}
              {formatTimeRange(session.startTime, session.endTime)}
            </p>
          )}

          <ErrorNotice
            error={!roster.usingSample ? roster.error : null}
            onRetry={roster.reload}
          />
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
                        <td className="num">{m.phone}</td>
                        <td>
                          {rec ? (
                            <StatusTag tone={AttendanceStatus.tone(rec.status)}>
                              {AttendanceStatus.label(rec.status)}
                            </StatusTag>
                          ) : (
                            <span className="muted">Not marked</span>
                          )}
                        </td>
                        <td className="num">
                          {rec ? formatDateTime(rec.checkInTime) : "—"}
                        </td>
                        <td className="cell-actions">
                          <div
                            className="mark-group"
                            role="group"
                            aria-label={`Mark ${m.fullName}`}
                          >
                            {[1, 3, 2].map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`mark-group__btn mark-group__btn--${AttendanceStatus.tone(s)} ${rec?.status === s ? "is-active" : ""}`}
                                aria-pressed={rec?.status === s}
                                disabled={offline || busy === m.memberId}
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
                Book members in from Bookings, then take attendance here.
              </EmptyState>
            )
          )}
        </>
      )}
    </div>
  );
}
