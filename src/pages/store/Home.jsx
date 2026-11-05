import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { useMemberDiscount } from '../../hooks/useMemberDiscount.js';
import ClassPrice from '../../components/ClassPrice.jsx';
import MemberDiscountNotice from '../../components/MemberDiscountNotice.jsx';
import { useAuth, isStaff } from '../../context/AuthContext.jsx';
import { HERO_SLIDES, HERO_TIMING, sportImage } from '../../lib/images.js';
import { useSlideshow } from '../../hooks/useSlideshow.js';
import { daysUntil, formatDateRange } from '../../lib/format.js';
import { CoachPortrait, classEyebrow } from '../../components/cards.jsx';
import Icon from '../../components/Icon.jsx';
import AutoScrollRow from '../../components/AutoScrollRow.jsx';
import { ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';
import '../../styles/home-redesign.css';

function SectionHead({ id, eyebrow, title, description, action }) {
  return (
    <div className="home-section-head">
      <div>
        <p className="home-eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        {description && <p className="home-section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function HomeClass({ item, tabIndex, pricing }) {
  const knownCapacity = Number.isFinite(item.maxCapacity) && Number.isFinite(item.currentEnrolled);
  const left = knownCapacity ? Math.max(0, item.maxCapacity - item.currentEnrolled) : item.spotsLeft;
  const eyebrow = classEyebrow(item, left);
  return (
    <Link to={`/classes/${item.id}`} className="home-class" tabIndex={tabIndex}>
      <div className="home-class__photo">
        <img src={sportImage(item.categoryName, item.className)} alt="" loading="lazy" decoding="async" />
        {item.categoryName && <span className="home-class__sport">{item.categoryName}</span>}
        <span className="home-class__open" aria-hidden="true"><Icon name="arrowRight" size={19} /></span>
      </div>
      <div className="home-class__body">
        <p className={`home-class__status home-class__status--${eyebrow.tone}`}><span />{eyebrow.text}</p>
        <h3>{item.className}</h3>
        <p className="home-class__detail"><Icon name="user" size={16} /><span>{item.coachName || 'Thông tin huấn luyện viên sẽ được cập nhật'}</span></p>
        <p className="home-class__detail"><Icon name="calendar" size={16} /><span>{formatDateRange(item.startDate, item.endDate)}</span></p>
        <div className="home-class__bottom">
          <div><span className="home-class__fee-label">Học phí toàn khóa</span><ClassPrice price={item.price} pricing={pricing} /></div>
          <span className="home-class__capacity">{Number.isFinite(left) ? `${left} chỗ còn lại` : Number.isFinite(item.maxCapacity) ? `Tối đa ${item.maxCapacity} người` : 'Xem sĩ số lớp'}</span>
        </div>
      </div>
    </Link>
  );
}

const START_STEPS = [
  { icon: 'search', title: 'Tìm nhịp tập phù hợp', text: 'Chọn môn yêu thích và xem lịch học trước khi đăng ký.' },
  { icon: 'check', title: 'Đăng ký và thanh toán', text: 'Làm theo hướng dẫn của đơn và chờ hệ thống xác nhận.' },
  { icon: 'calendar', title: 'Sẵn sàng cho buổi tập', text: 'Theo dõi lịch, điểm danh và nhận xét trong tài khoản của bạn.' },
];

function HomeHero() {
  const hero = useRef(null);
  useLayoutEffect(() => {
    const bars = [...document.querySelectorAll('.store > .utility-bar, .store > .site-header')];
    const updateHeight = () => {
      const height = bars.reduce((total, bar) => total + bar.getBoundingClientRect().height, 0);
      hero.current?.style.setProperty('--home-header-height', `${height}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    bars.forEach(bar => observer.observe(bar));
    window.addEventListener('resize', updateHeight, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('resize', updateHeight); };
  }, []);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return undefined;
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const stopped = paused || reducedMotion;
  const step = useSlideshow(stopped ? 1 : HERO_SLIDES.length, HERO_TIMING.interval);
  const slide = step % HERO_SLIDES.length;
  const requested = Math.min(HERO_SLIDES.length, step + (reducedMotion ? 1 : 2));

  return (
    <section ref={hero} className="home-hero" aria-labelledby="home-title" data-paused={stopped} style={{ '--home-hero-fade': `${HERO_TIMING.fade}ms`, '--home-hero-zoom': `${HERO_TIMING.interval}ms` }}>
      <div className="home-hero__photos">
        {HERO_SLIDES.map((photo, index) => (
          <img key={photo.src} className={`home-hero__image ${index === slide ? 'is-active' : ''}`} src={index < requested ? photo.src : undefined} alt={index === slide ? photo.alt : ''} aria-hidden={index !== slide || undefined} style={{ objectPosition: photo.position }} fetchPriority={index === 0 ? 'high' : 'low'} decoding="async" />
        ))}
      </div>
      <div className="home-hero__shade" aria-hidden="true" />
      <div className="home-hero__inner container">
        <div className="home-hero__copy">
          <p className="home-eyebrow"><span />Chuyển động cùng SportCenter</p>
          <h1 id="home-title">Mỗi buổi tập,<br /><span>một bước tiến.</span></h1>
          <p className="home-hero__lead">Dành thời gian cho một bạn khỏe hơn. Khám phá môn yêu thích, tìm lớp phù hợp và bắt đầu hành trình tập luyện của riêng mình.</p>
          <div className="home-hero__actions">
            <a className="home-button home-button--primary" href="#home-upcoming">Tìm buổi tập của bạn<Icon name="arrowRight" size={19} /></a>
            <Link className="home-button home-button--quiet" to="/schedule"><Icon name="calendar" size={19} />Xem lịch theo ngày</Link>
          </div>
          <div className="home-hero__details">
            <span><Icon name="check" size={16} />Đa dạng bộ môn</span>
            <span><Icon name="check" size={16} />Có huấn luyện viên</span>
            <span><Icon name="check" size={16} />Đăng ký trực tuyến</span>
          </div>
        </div>
      </div>
      {!reducedMotion && <div className="home-hero__controls container"><button type="button" className="home-hero__toggle" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Tiếp tục chuyển ảnh nền' : 'Tạm dừng chuyển ảnh nền'}><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{paused ? <path d="M5 3.2 13 8l-8 4.8Z" /> : <><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></>}</svg>{paused ? 'Tiếp tục ảnh' : 'Tạm dừng ảnh'}</button></div>}
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [showAllSports, setShowAllSports] = useState(false);
  const categories = useApi(() => api.categories.list(), [], { sample: mock.categories });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const coaches = useApi(() => api.coaches.list(), [], { sample: mock.coaches });
  const pricing = useMemberDiscount({ enabled: !classes.usingSample });
  const sources = [categories, classes, coaches];
  const usingSample = sources.some(source => source.usingSample);
  const classList = classes.data ?? [];
  const upcoming = classList.filter(item => {
    const days = daysUntil(item.startDate);
    return item.status === 1 && days !== null && Number.isFinite(days) && days >= 0;
  }).sort((a, b) => daysUntil(a.startDate) - daysUntil(b.startDate));
  const visibleClasses = upcoming;
  const allSports = categories.data ?? [];
  const visibleSports = showAllSports ? allSports : allSports.slice(0, 8);
  const countBySport = classList.filter(item => item.status === 2).reduce((counts, item) => ({ ...counts, [item.categoryId]: (counts[item.categoryId] ?? 0) + 1 }), {});
  const coachList = [...(coaches.data ?? [])].sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
  const accountHref = user ? isStaff(user) ? '/staff' : '/account?tab=schedule' : '/register';
  const accountAction = user ? isStaff(user) ? 'Mở khu vực nhân viên' : 'Mở lịch tập của tôi' : 'Tạo tài khoản của bạn';
  const reloadAll = () => sources.forEach(source => source.reload());

  return (
    <div className="home-page">
      <HomeHero />

      {usingSample && <div className="container home-sample"><SampleDataNotice onRetry={reloadAll} /></div>}

      <section className="home-section container" aria-labelledby="home-sports-title">
        <SectionHead id="home-sports-title" eyebrow="Tìm điều bạn yêu thích" title="Chọn môn của bạn" description="Một nhịp tập mới bắt đầu từ bộ môn khiến bạn muốn quay lại." action={<span className="home-section-mark" aria-hidden="true"><Icon name="grid" size={25} /></span>} />
        <ErrorNotice error={!categories.usingSample ? categories.error : null} onRetry={categories.reload} />
        {categories.loading ? <Loading label="Đang tải các môn thể thao" /> : allSports.length ? (
          <>
            <div className="home-sports">
              {visibleSports.map(category => (
                <Link key={category.id} className="home-sport" to={`/classes?sport=${encodeURIComponent(category.id)}&status=2`}>
                  <img src={sportImage(category.categoryName)} alt="" loading="lazy" decoding="async" />
                  <div className="home-sport__shade" />
                  <div className="home-sport__label"><div><h3>{category.categoryName}</h3><p>{classes.loading || (classes.error && !classes.usingSample) ? 'Khám phá bộ môn' : `${countBySport[category.id] ?? 0} lớp đang diễn ra`}</p></div><span><Icon name="arrowRight" size={18} /></span></div>
                </Link>
              ))}
            </div>
            {allSports.length > 8 && <button type="button" className="home-more" onClick={() => setShowAllSports(value => !value)} aria-expanded={showAllSports}>{showAllSports ? 'Thu gọn bộ môn' : `Khám phá thêm ${allSports.length - 8} bộ môn`}<Icon name={showAllSports ? 'chevronDown' : 'plus'} size={17} /></button>}
          </>
        ) : !categories.error && <div className="home-empty"><Icon name="grid" size={26} /><p>Các môn thể thao sẽ sớm được cập nhật.</p></div>}
      </section>

      <section id="home-upcoming" className="home-section home-section--classes" aria-labelledby="home-classes-title">
        <div className="container">
          <SectionHead id="home-classes-title" eyebrow="Lên lịch cho một khởi đầu mới" title="Sắp khai giảng" description="Xem ngày học, huấn luyện viên và học phí để tìm lớp phù hợp với bạn." action={<Link className="home-text-link" to="/classes?status=1">Xem các lớp sắp khai giảng<Icon name="arrowRight" size={18} /></Link>} />
          <ErrorNotice error={!classes.usingSample ? classes.error : null} onRetry={classes.reload} />
          <MemberDiscountNotice pricing={pricing} />
          {classes.loading ? <Loading label="Đang tải các lớp sắp khai giảng" /> : visibleClasses.length ? <AutoScrollRow className="home-classes-row" label="các lớp sắp khai giảng" direction="right" speed={18}>{visibleClasses.map(item => <HomeClass key={item.id} item={item} pricing={pricing} />)}</AutoScrollRow> : !classes.error || classes.usingSample ? <div className="home-empty" role="status"><Icon name="calendar" size={28} /><h3>Chưa có lịch khai giảng phù hợp</h3><p>Bạn có thể xem lịch hiện tại hoặc quay lại khi trung tâm mở lớp mới.</p></div> : null}
          {visibleClasses.length > 0 && <p className="home-price-note">Học phí hiển thị cho toàn khóa. Ưu đãi theo thẻ thành viên được áp dụng khi đủ điều kiện.</p>}
        </div>
      </section>

      <section className="home-section container home-start" aria-labelledby="home-start-title">
        <div className="home-guide">
          <p className="home-eyebrow">Dễ bắt đầu, dễ duy trì</p>
          <h2 id="home-start-title">Buổi tập đầu tiên<br />bắt đầu từ đâu?</h2>
          <div className="home-steps">{START_STEPS.map((step, index) => <div className="home-step" key={step.title}><span className="home-step__number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div><Icon name={step.icon} size={21} /></div>)}</div>
          <Link className="home-text-link" to="/help">Xem hướng dẫn chi tiết<Icon name="arrowRight" size={18} /></Link>
        </div>
        <div className="home-personal">
          <span className="home-personal__icon"><Icon name="calendar" size={30} /></span>
          <p className="home-eyebrow">Không gian của riêng bạn</p>
          <h2>Mọi buổi tập.<br />Gọn trong một nơi.</h2>
          <p>Lịch tập, thẻ thành viên và những tiến bộ nhỏ mỗi ngày. Theo dõi hành trình của bạn ngay trong tài khoản SportCenter.</p>
          <div className="home-personal__preview" aria-hidden="true"><span><Icon name="calendar" size={18} />Lịch tập của bạn<Icon name="check" size={17} /></span><span><Icon name="user" size={18} />Kế hoạch & nhận xét<Icon name="check" size={17} /></span><span><Icon name="bell" size={18} />Thông báo từ trung tâm<Icon name="check" size={17} /></span></div>
          <Link className="home-button home-button--white" to={accountHref}>{accountAction}<Icon name="arrowRight" size={18} /></Link>
        </div>
      </section>



      <section className="home-section container" aria-labelledby="home-coaches-title">
        <SectionHead id="home-coaches-title" eyebrow="Cùng bạn đi xa hơn" title="Đội ngũ huấn luyện viên" description="Tìm người đồng hành và phương pháp tập phù hợp với mục tiêu của bạn." action={<Link className="home-text-link" to="/coaches">Tìm hiểu đội ngũ<Icon name="arrowRight" size={18} /></Link>} />
        <ErrorNotice error={!coaches.usingSample ? coaches.error : null} onRetry={coaches.reload} />
        {coaches.loading ? <Loading label="Đang tải huấn luyện viên" /> : coachList.length ? <AutoScrollRow className="home-coaches-row" label="đội ngũ huấn luyện viên" direction="left" speed={18}>{coachList.map(coach => <Link key={coach.id} className="home-coach" to={`/coaches/${coach.id}`}><div className="home-coach__photo"><CoachPortrait coach={coach} />{Number(coach.experienceYears) > 0 && <span>{coach.experienceYears} năm kinh nghiệm</span>}</div><div className="home-coach__body"><p>Huấn luyện viên</p><h3>{coach.fullName}</h3><span>{coach.specialization || 'Đồng hành cùng hành trình tập luyện của bạn'}</span><div className="home-coach__link">Xem hồ sơ<Icon name="arrowRight" size={17} /></div></div></Link>)}</AutoScrollRow> : !coaches.error && <div className="home-empty"><Icon name="user" size={26} /><p>Thông tin huấn luyện viên sẽ sớm được cập nhật.</p></div>}
      </section>
    </div>
  );
}
