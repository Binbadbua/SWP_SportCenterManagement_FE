import RoleLabel from './RoleLabel.jsx';
import { Link } from 'react-router-dom';
import { photoUrl, sportImage } from '../lib/images.js';
import { daysUntil, formatDateRange, formatMoney, initials } from '../lib/format.js';
import { ClassStatus } from '../lib/enums.js';
import { classDisplayStatus } from '../lib/classes.js';
import { benefitsOf, summaryOf } from '../lib/pricing.js';
import { Button } from './ui.jsx';
import { sportsOf } from './CoachFacts.jsx';
import Icon from './Icon.jsx';
import ClassPrice from './ClassPrice.jsx';

export function classEyebrow(c, spotsLeft, started, displayStatus) {
  const status = displayStatus === undefined ? classDisplayStatus(c) : displayStatus;
  if (status === 4) return { text: 'Đã hủy', tone: 'muted' };
  if (status === 3) return { text: 'Đã kết thúc', tone: 'muted' };
  if (status === 2 || started === true) return { text: 'Đã bắt đầu · không nhận đặt thêm', tone: 'muted' };
  if (status === null) return { text: 'Lịch học đang được cập nhật', tone: 'muted' };
  if (spotsLeft !== undefined && spotsLeft <= 0) return { text: 'Đã đủ chỗ', tone: 'muted' };
  if (spotsLeft !== undefined && spotsLeft <= Math.max(3, Math.round(c.maxCapacity * 0.2))) {
    return { text: `Chỉ còn ${spotsLeft} chỗ`, tone: 'signal' };
  }
  const d = daysUntil(c.startDate);
  if (d === 0) return { text: 'Khai giảng hôm nay', tone: 'signal' };
  if (d === 1) return { text: 'Khai giảng ngày mai', tone: 'signal' };
  if (d > 1 && d <= 14) return { text: `Khai giảng sau ${d} ngày`, tone: 'signal' };
  return { text: 'Đang nhận đăng ký', tone: 'ink' };
}

export function ClassCard({ item, spotsLeft, started, scheduleKnown = true, displayStatus, pricing }) {

  const knownCapacity = Number.isFinite(item.maxCapacity);
  const serverLeft = knownCapacity && Number.isFinite(item.currentEnrolled)
    ? Math.max(0, item.maxCapacity - item.currentEnrolled)
    : item.spotsLeft ?? (knownCapacity && Number.isFinite(item._enrolled) ? Math.max(0, item.maxCapacity - item._enrolled) : undefined);
  const left = spotsLeft ?? serverLeft;
  const status = displayStatus === undefined ? classDisplayStatus(item) : displayStatus;
  const eyebrow = !scheduleKnown && status === 1
    ? { text: 'Xem lịch để kiểm tra đăng ký', tone: 'muted' }
    : classEyebrow(item, left, started, status);
  return (
    <Link to={`/classes/${item.id}`} className="class-card">
      <div className="class-card__media">
        <img src={sportImage(item.categoryName, item.className)} alt="" loading="lazy" decoding="async" />
        {item.categoryName && <span className="class-card__sport">{item.categoryName}</span>}
        <span className="class-card__open" aria-hidden="true"><Icon name="arrowRight" size={19} /></span>
      </div>
      <div className="class-card__body">
        <p className={`class-card__eyebrow eyebrow--${eyebrow.tone}`}><span />{eyebrow.text}</p>
        <h3 className="class-card__title">{item.className}</h3>
        <p className="class-card__meta"><Icon name="user" size={16} /><span>{item.coachName || 'Huấn luyện viên sẽ được cập nhật'}</span></p>
        <p className="class-card__meta num"><Icon name="calendar" size={16} /><span>{formatDateRange(item.startDate, item.endDate)}</span></p>
        <div className="class-card__footer">
          <div className="class-card__fee"><span>Học phí toàn khóa</span><ClassPrice price={item.price} pricing={pricing} /></div>
          <span className="class-card__cap">{Number.isFinite(left) ? `${Math.max(0, left)} chỗ còn lại` : knownCapacity ? `Tối đa ${item.maxCapacity} người` : 'Xem sĩ số lớp'}</span>
        </div>
        <div className="class-card__link">Xem chi tiết lớp<Icon name="arrowRight" size={16} /></div>
      </div>
    </Link>
  );
}

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

const PORTRAIT_PX = { md: [800, 1000], sm: [128, 128], xs: [64, 64] };

export function CoachPortrait({ coach, size = 'md' }) {

  if (/^(https?:\/\/|\/)/i.test(coach.avatar ?? '')) {
    const [w, h] = PORTRAIT_PX[size] ?? PORTRAIT_PX.md;
    return <img className={`coach-portrait coach-portrait--${size}`} src={photoUrl(coach.avatar, w, h)} alt="" loading="lazy" />;
  }
  return (
    <div className={`coach-portrait coach-portrait--${size} coach-portrait--mono`} aria-hidden="true">
      <span>{initials(coach.fullName)}</span>
    </div>
  );
}

export function CoachCard({ coach, classes }) {
  const sports = sportsOf(classes).map(([, name]) => name);
  const yearsKnown = Number.isFinite(coach.experienceYears) && coach.experienceYears >= 0;
  return (
    <Link to={`/coaches/${coach.id}`} className="coach-card">
      <div className="coach-card__media">
        <CoachPortrait coach={coach} />
        {yearsKnown && <span className="coach-card__experience"><Icon name="user" size={14} />{coach.experienceYears} năm kinh nghiệm</span>}
      </div>
      <div className="coach-card__body">
        <p className="coach-card__eyebrow"><RoleLabel role="Coach" /></p>
        <h3 className="coach-card__name">{coach.fullName}</h3>
        <p className="coach-card__specialization">{coach.specialization || 'Chuyên môn sẽ được cập nhật'}</p>
        {sports.length > 0 && <div className="coach-card__sports">{sports.slice(0, 3).map(sport => <span key={sport}>{sport}</span>)}{sports.length > 3 && <span>+{sports.length - 3} môn</span>}</div>}
        <div className="coach-card__link">Khám phá hồ sơ<Icon name="arrowRight" size={17} /></div>
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

      {Number(pkg.discountPercent ?? 0) > 0 && (
        <p className="package-card__deal">Giảm {pkg.discountPercent}% học phí mọi lớp</p>
      )}
      <p className="package-card__desc">{summaryOf(pkg)}</p>
      {benefitsOf(pkg).length > 0 && (
        <ul className="package-card__benefits">
          {benefitsOf(pkg).map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
      <div className="package-card__cta">
        <Button variant={featured ? 'inverse' : 'primary'} block onClick={() => onChoose?.(pkg)}>
          Chọn {pkg.packageName}
        </Button>
      </div>
    </article>
  );
}

export const classStatusLabel = (v) => ClassStatus.label(v);
