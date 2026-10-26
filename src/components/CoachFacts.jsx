import { Link } from 'react-router-dom';
import { Gender } from '../lib/enums.js';
import { formatDate, realPhone } from '../lib/format.js';

// The classes a coach runs, cancelled ones left out. Classes come from GET /api/classes (coachId on each).
export const classesOf = (classes, coachId) =>
  (classes ?? []).filter((c) => c.coachId === coachId && c.status !== 4);

// Sports a coach teaches, from their classes: [[categoryId, categoryName], …] in name order
export const sportsOf = (classes) =>
  [...new Map((classes ?? []).map((c) => [c.categoryId, c.categoryName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));

// Everything we know about a coach. GET /api/coaches/{id} gives visitors and members name, photo,
// specialization, experience, birth date and gender; phone and email go to staff only. A value the
// manager has not filled in shows a fallback.
export function CoachFacts({ coach, classes = [] }) {
  const sports = sportsOf(classes);
  const phone = realPhone(coach.phone);
  const viaDesk = <span className="muted">Liên hệ qua lễ tân</span>;
  const notYet = <span className="muted">Chưa cập nhật</span>;
  return (
    <dl className="coach-facts">
      <div className="coach-facts__full">
        <dt>Chuyên môn</dt>
        <dd>{coach.specialization || '—'}</dd>
      </div>
      <div>
        <dt>Kinh nghiệm</dt>
        <dd className="num">{coach.experienceYears ?? 0} năm</dd>
      </div>
      <div>
        <dt>Số lớp phụ trách</dt>
        <dd className="num">{classes.length}</dd>
      </div>
      <div className="coach-facts__full">
        <dt>Môn đang dạy</dt>
        <dd>
          {sports.length ? (
            <span className="chip-row">
              {sports.map(([id, name]) => (
                <Link key={id} className="chip chip--link" to={`/classes?sport=${id}`}>{name}</Link>
              ))}
            </span>
          ) : '—'}
        </dd>
      </div>
      <div>
        <dt>Ngày sinh</dt>
        <dd className="num">{coach.dob ? formatDate(coach.dob) : notYet}</dd>
      </div>
      <div>
        <dt>Giới tính</dt>
        <dd>{coach.gender ? Gender.label(coach.gender) : notYet}</dd>
      </div>
      <div>
        <dt>Số điện thoại</dt>
        <dd className="num">{phone ? <a className="text-link" href={`tel:${phone}`}>{phone}</a> : viaDesk}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>{coach.email ? <a className="text-link" href={`mailto:${coach.email}`}>{coach.email}</a> : viaDesk}</dd>
      </div>
    </dl>
  );
}
