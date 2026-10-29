import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { formatShortDate, formatTimeRange, formatWeekday, todayLocalDateString } from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import { classStarted } from '../../lib/classes.js';
import { ClassCard, CoachPortrait } from '../../components/cards.jsx';
import { CoachFacts, classesOf, sportsOf } from '../../components/CoachFacts.jsx';
import { Button, EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';

const UPCOMING_SHOWN = 8;
const day = (v) => String(v).slice(0, 10);
// "Tennis", "Tennis và Yoga", "Tennis, Yoga và Bơi lội"
const joinVi = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} và ${xs[xs.length - 1]}`);

// One coach: profile, the classes they run and their next sessions (all public on the API)
export default function CoachDetail() {
  const { id } = useParams();
  const coach = useApi(() => api.coaches.get(id), [id], {
    sample: () => mock.coaches.find((c) => c.id === id) ?? null,
  });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const sessions = useApi(() => api.schedules.list(), [], { sample: mock.sessions });

  if (coach.loading) {
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  }
  if (!coach.data) {
    return (
      <div className="container page">
        {coach.error && coach.error.status !== 404 ? (
          <ErrorNotice error={coach.error} onRetry={coach.reload} />
        ) : (
          <EmptyState title="Không tìm thấy huấn luyện viên" action={<Button to="/coaches">Xem tất cả huấn luyện viên</Button>}>
            Hồ sơ này không còn hoặc đường dẫn chưa đúng.
          </EmptyState>
        )}
      </div>
    );
  }

  const c = coach.data;
  const mine = classesOf(classes.data, c.id).sort((a, b) => a.status - b.status || a.className.localeCompare(b.className));
  const sportNames = sportsOf(mine).map(([, name]) => name);
  const ids = new Set(mine.map((k) => k.id));
  const today = todayLocalDateString();
  const upcoming = (sessions.data ?? [])
    .filter((s) => ids.has(s.classId) && day(s.date) >= today)
    .sort((a, b) => (day(a.date) + a.startTime).localeCompare(day(b.date) + b.startTime))
    .slice(0, UPCOMING_SHOWN);

  return (
    <div className="container page coach-page">
      {(coach.usingSample || classes.usingSample) && (
        <div className="section-notice">
          <SampleDataNotice onRetry={() => { coach.reload(); classes.reload(); sessions.reload(); }} />
        </div>
      )}
      <nav className="crumbs" aria-label="Đường dẫn">
        <Link to="/coaches">Huấn luyện viên</Link> / <span>{c.fullName}</span>
      </nav>

      <div className="coach-page__grid">
        <div className="coach-page__photo">
          <CoachPortrait coach={c} />
        </div>
        <div className="coach-page__info">
          <p className="label coach-page__eyebrow">Huấn luyện viên</p>
          <h1 className="display coach-page__name">{c.fullName}</h1>
          <p className="coach-page__lead">
            {c.experienceYears} năm kinh nghiệm huấn luyện
            {mine.length ? `, hiện phụ trách ${mine.length} lớp ${joinVi(sportNames)}.` : '.'}
          </p>
          <CoachFacts coach={c} classes={mine} />
          <div className="coach-page__actions">
            {mine.length > 0 && (
              <Button to={`/classes?coach=${c.id}`} iconAfter="arrowRight">Đặt lớp với huấn luyện viên này</Button>
            )}
            <Button variant="secondary" to="/coaches">Tất cả huấn luyện viên</Button>
          </div>
        </div>
      </div>

      <section className="block">
        <div className="block__head">
          <h2 className="section-title">Lớp đang phụ trách</h2>
        </div>
        <ErrorNotice error={!classes.usingSample ? classes.error : null} onRetry={classes.reload} />
        {classes.loading ? (
          <Loading />
        ) : mine.length ? (
          <div className="product-grid product-grid--4">
            {mine.map((k) => <ClassCard key={k.id} item={k} started={sessions.data ? classStarted(k, sessions.data) : undefined} />)}
          </div>
        ) : (
          !classes.error && <p className="muted">Hiện chưa phụ trách lớp nào.</p>
        )}
      </section>

      <section className="block">
        <div className="block__head">
          <h2 className="section-title">Lịch dạy sắp tới</h2>
          <Link className="text-link" to="/schedule">Xem lịch cả tuần</Link>
        </div>
        <ErrorNotice error={!sessions.usingSample ? sessions.error : null} onRetry={sessions.reload} />
        {sessions.loading ? (
          <Loading />
        ) : upcoming.length ? (
          <ul className="timetable__list coach-sessions">
            {upcoming.map((s) => (
              <li key={s.id}>
                <Link to={`/classes/${s.classId}`} className="timetable__row">
                  <span className="timetable__time num">
                    {day(s.date) === today ? 'Hôm nay' : `${formatWeekday(s.date)} ${formatShortDate(s.date)}`} ·{' '}
                    {formatTimeRange(s.startTime, s.endTime)}
                  </span>
                  <span className="timetable__class">{s.className}</span>
                  <span className="timetable__room muted"><Icon name="pin" size={16} /> {s.roomName}</span>
                  <Icon name="chevronRight" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          !sessions.error && <p className="muted">Chưa có buổi dạy nào sắp tới.</p>
        )}
      </section>
    </div>
  );
}
