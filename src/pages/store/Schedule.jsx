import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDate, formatTimeRange, formatWeekday, todayUtcDateString } from '../../lib/format.js';
import { EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Public weekly timetable built from GET /api/schedules
export default function Schedule() {
  const sessions = useApi(() => api.schedules.list(), [], { sample: mock.sessions });
  const [weekStart, setWeekStart] = useState(todayUtcDateString());
  const weekEnd = addDays(weekStart, 7);

  const days = useMemo(() => {
    const rows = (sessions.data ?? [])
      .filter((s) => s.date.slice(0, 10) >= weekStart && s.date.slice(0, 10) < weekEnd)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(weekStart, i);
      return { iso, items: rows.filter((s) => s.date.slice(0, 10) === iso) };
    });
  }, [sessions.data, weekStart, weekEnd]);

  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title display">Schedule</h1>
        <p className="page-lead">Every session this week, by day. Book the class to hold your spot in all of its sessions.</p>
      </header>

      {sessions.usingSample && <div className="section-notice"><SampleDataNotice onRetry={sessions.reload} /></div>}
      <ErrorNotice error={!sessions.usingSample ? sessions.error : null} onRetry={sessions.reload} />

      <div className="week-nav">
        <button type="button" className="round-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
          <Icon name="chevronLeft" />
        </button>
        <p className="week-nav__label num">{formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}</p>
        <button type="button" className="round-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
          <Icon name="chevronRight" />
        </button>
        {weekStart !== todayUtcDateString() && (
          <button type="button" className="plain-btn" onClick={() => setWeekStart(todayUtcDateString())}>Back to today</button>
        )}
      </div>

      {sessions.loading ? (
        <Loading />
      ) : days.every((d) => !d.items.length) ? (
        <EmptyState title="No sessions this week">Try the next week, or browse classes to see what’s coming up.</EmptyState>
      ) : (
        <div className="timetable">
          {days.map((d) => (
            <section key={d.iso} className="timetable__day">
              <h2 className="timetable__date">
                <span className="label">{formatWeekday(d.iso)}</span>
                <span className="num">{formatDate(d.iso)}</span>
              </h2>
              {d.items.length ? (
                <ul className="timetable__list">
                  {d.items.map((s) => (
                    <li key={s.id}>
                      <Link to={`/classes/${s.classId}`} className="timetable__row">
                        <span className="timetable__time num">{formatTimeRange(s.startTime, s.endTime)}</span>
                        <span className="timetable__class">{s.className}</span>
                        <span className="timetable__room muted"><Icon name="pin" size={16} /> {s.roomName}</span>
                        <Icon name="chevronRight" size={20} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="timetable__rest muted">No sessions</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
