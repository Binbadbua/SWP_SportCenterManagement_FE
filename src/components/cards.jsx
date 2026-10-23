import { Link } from 'react-router-dom';
import { sportImage } from '../lib/images.js';
import { daysUntil, formatDateRange, formatMoney, initials } from '../lib/format.js';
import { ClassStatus } from '../lib/enums.js';
import { Button } from './ui.jsx';
import { sportsOf } from './CoachFacts.jsx';

/* The most useful fact about the class right now, shown above its name */
export function classEyebrow(c, spotsLeft) {
  if (c.status === 4) return { text: 'Đã hủy', tone: 'muted' };
  if (c.status === 3) return { text: 'Đã kết thúc', tone: 'muted' };
  if (spotsLeft !== undefined && spotsLeft <= 0) return { text: 'Đã đủ chỗ', tone: 'muted' };
  if (spotsLeft !== undefined && spotsLeft <= Math.max(3, Math.round(c.maxCapacity * 0.2))) {
    return { text: `Chỉ còn ${spotsLeft} chỗ`, tone: 'signal' };
  }
  if (c.status === 2) return { text: 'Đang diễn ra · vào học bất cứ lúc nào', tone: 'ink' };
  const d = daysUntil(c.startDate);
  if (d === 0) return { text: 'Khai giảng hôm nay', tone: 'signal' };
  if (d === 1) return { text: 'Khai giảng ngày mai', tone: 'signal' };
  if (d > 1 && d <= 14) return { text: `Khai giảng sau ${d} ngày`, tone: 'signal' };
  return { text: 'Đang nhận đăng ký', tone: 'ink' };
}

export function ClassCard({ item, spotsLeft }) {
  // spotsLeft comes with each class from the API; the sample data carries _enrolled instead
  const left = spotsLeft ?? item.spotsLeft ?? (item._enrolled !== undefined ? item.maxCapacity - item._enrolled : undefined);
  const eyebrow = classEyebrow(item, left);
  return (
    <Link to={`/classes/${item.id}`} className="class-card">
      <div className="class-card__media">
        <img src={sportImage(item.categoryName, item.className)} alt="" loading="lazy" />
      </div>
      <div className="class-card__body">
        <p className={`class-card__eyebrow eyebrow--${eyebrow.tone}`}>{eyebrow.text}</p>
        <h3 className="class-card__title">{item.className}</h3>
        <p className="muted">{item.categoryName} · {item.coachName}</p>
        <p className="muted num">{formatDateRange(item.startDate, item.endDate)}</p>
        <p className="class-card__cap num">Tối đa {item.maxCapacity} người</p>
      </div>
    </Link>
  );
}

/* Sport tile with a boxed label on the photo */
export function CategoryTile({ category, count }) {
  return (
    <Link to={`/classes?sport=${category.id}`} className="category-tile">
      <img src={sportImage(category.categoryName)} alt="" loading="lazy" />
      <span className="category-tile__label">
        <span className="boxed boxed--title">{category.categoryName}</span>
        {count !== undefined && <span className="boxed boxed--sub">{count} lớp</span>}
      </span>
    </Link>
  );
}

export function CoachPortrait({ coach, size = 'md' }) {
  // Older coach rows hold a bare file name instead of a link; those fall back to initials
  if (/^(https?:\/\/|\/)/i.test(coach.avatar ?? '')) {
    return <img className={`coach-portrait coach-portrait--${size}`} src={coach.avatar} alt="" loading="lazy" />;
  }
  return (
    <div className={`coach-portrait coach-portrait--${size} coach-portrait--mono`} aria-hidden="true">
      <span>{initials(coach.fullName)}</span>
    </div>
  );
}

/* Opens the coach's page. `classes` (the coach's own, optional) adds the sports they teach. */
export function CoachCard({ coach, classes }) {
  const sports = sportsOf(classes).map(([, name]) => name);
  return (
    <Link to={`/coaches/${coach.id}`} className="coach-card">
      <div className="coach-card__media">
        <CoachPortrait coach={coach} />
      </div>
      <div className="coach-card__body">
        <h3 className="coach-card__name">{coach.fullName}</h3>
        <p className="muted">{coach.specialization || 'Huấn luyện viên'}</p>
        {sports.length > 0 && <p className="coach-card__sports">{sports.join(' · ')}</p>}
        <p className="coach-card__years num">
          <strong>{coach.experienceYears}</strong> năm kinh nghiệm
        </p>
      </div>
    </Link>
  );
}

export function PackageCard({ pkg, onChoose, featured = false }) {
  const months = Math.round(pkg.durationDays / 30);
  const perMonth = Math.round((months > 0 ? pkg.price / months : pkg.price) / 1000) * 1000;
  return (
    <article className={`package-card ${featured ? 'package-card--featured' : ''}`}>
      {featured && <p className="package-card__flag">Được chọn nhiều nhất</p>}
      <h3 className="package-card__name display">{pkg.packageName}</h3>
      <p className="package-card__duration">
        {pkg.durationDays} ngày{months > 1 ? ` · khoảng ${formatMoney(perMonth)}/tháng` : ''}
      </p>
      <p className="package-card__price num">{formatMoney(pkg.price)}</p>
      <p className="package-card__desc">{pkg.description}</p>
      <div className="package-card__cta">
        <Button variant={featured ? 'inverse' : 'primary'} block onClick={() => onChoose?.(pkg)}>
          Chọn {pkg.packageName}
        </Button>
      </div>
    </article>
  );
}

export const classStatusLabel = (v) => ClassStatus.label(v);
