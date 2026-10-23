import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { useSlideshow, useTrailing } from '../../hooks/useSlideshow.js';
import { HERO_SLIDES, HERO_TIMING, IMAGES } from '../../lib/images.js';
import { daysUntil } from '../../lib/format.js';
import Rail from '../../components/Rail.jsx';
import { CategoryTile, ClassCard, CoachCard, PackageCard } from '../../components/cards.jsx';
import { classesOf } from '../../components/CoachFacts.jsx';
import { Button, Loading, SampleDataNotice } from '../../components/ui.jsx';

export default function Home() {
  const navigate = useNavigate();
  const step = useSlideshow(HERO_SLIDES.length, HERO_TIMING.interval);
  const slide = step % HERO_SLIDES.length;
  // Photos load one step ahead of the slideshow instead of all at once
  const requested = Math.min(HERO_SLIDES.length, step + 2);
  // The text leaves with the old photo and comes back with the new one, carrying its headline
  const textStep = useTrailing(step, HERO_TIMING.fade);
  const headline = HERO_SLIDES[textStep % HERO_SLIDES.length].title;
  const categories = useApi(() => api.categories.list(), [], { sample: mock.categories });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const coaches = useApi(() => api.coaches.list(), [], { sample: mock.coaches });
  const plans = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const usingSample = categories.usingSample || classes.usingSample || coaches.usingSample;

  const classList = classes.data ?? [];
  const countBySport = classList.reduce((acc, c) => ({ ...acc, [c.categoryId]: (acc[c.categoryId] ?? 0) + 1 }), {});
  const upcoming = classList
    .filter((c) => c.status === 1 && new Date(c.startDate) > new Date())
    .sort((a, b) => (daysUntil(a.startDate) ?? 0) - (daysUntil(b.startDate) ?? 0))
    .slice(0, 4);
  const packages = (plans.data ?? []).filter((p) => p.status === 1).slice(0, 3);

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section
        className={`hero ${step > 0 ? 'hero--cycled' : ''}`}
        style={{
          '--hero-fade': `${HERO_TIMING.fade}ms`,
          '--hero-zoom': `${HERO_TIMING.interval - HERO_TIMING.fade}ms`,
        }}
      >
        {HERO_SLIDES.map((s, i) => (
          <img
            key={`${i}-${s.src}`}
            className={`hero__img ${i === slide ? 'is-active' : ''}`}
            src={i < requested ? s.src : undefined}
            alt={i === slide ? s.alt : ''}
            aria-hidden={i === slide ? undefined : true}
            style={s.position ? { objectPosition: s.position } : undefined}
            decoding="async"
          />
        ))}
        <div className="hero__shade" />
        <div className={`hero__content container ${textStep !== step ? 'is-leaving' : ''}`}>
          <p className="hero__eyebrow label">Mùa giải mới · đang mở lớp</p>
          <h1 className="hero__title display">
            {headline.map((line, i) => (
              <Fragment key={i}>{i > 0 && <br />}{line}</Fragment>
            ))}
          </h1>
          <p className="hero__lead">
            Yoga lúc bình minh, tạ sau giờ làm, cầu lông đôi ngày thứ Bảy. Chọn lớp, đặt chỗ và chúng tôi sẽ giữ chỗ cho bạn.
          </p>
          <div className="hero__actions">
            <Button variant="offset" size="lg" to="/classes" iconAfter="arrowRight">Đặt lớp ngay</Button>
            <Link to="/memberships" className="hero__link">Xem gói tập</Link>
          </div>
        </div>
      </section>

      {usingSample && (
        <div className="container section-notice">
          <SampleDataNotice onRetry={() => { categories.reload(); classes.reload(); coaches.reload(); }} />
        </div>
      )}

      {/* Sports rail: drifts slowly from the first sport to the last, then loops ---------- */}
      <Rail title="Chọn môn của bạn" action={<Link className="text-link" to="/classes">Tất cả lớp học</Link>} autoScroll>
        {categories.loading && <Loading />}
        {(categories.data ?? []).map((c) => (
          <CategoryTile key={c.id} category={c} count={countBySport[c.id] ?? 0} />
        ))}
      </Rail>

      {/* Two feature tiles --------------------------------------------- */}
      <section className="container split">
        <Link to="/classes" className="feature-tile">
          <img src={IMAGES.groupTraining} alt="" loading="lazy" />
          <div className="feature-tile__text">
            <p className="feature-tile__kicker">Tập theo nhóm</p>
            <h2 className="feature-tile__title">Tập cùng nhau vui hơn</h2>
            <span className="btn btn--inverse btn--sm">Xem các lớp học</span>
          </div>
        </Link>
        <Link to="/coaches" className="feature-tile">
          <img src={IMAGES.coaching} alt="" loading="lazy" />
          <div className="feature-tile__text">
            <p className="feature-tile__kicker">Huấn luyện</p>
            <h2 className="feature-tile__title">Kế hoạch dành riêng cho bạn</h2>
            <span className="btn btn--inverse btn--sm">Gặp các huấn luyện viên</span>
          </div>
        </Link>
      </section>

      {/* Starting soon ------------------------------------------------- */}
      <section className="container block">
        <div className="block__head">
          <h2 className="section-title">Sắp khai giảng</h2>
          <Link className="text-link" to="/classes">Xem tất cả</Link>
        </div>
        {classes.loading ? (
          <Loading />
        ) : upcoming.length ? (
          <div className="product-grid product-grid--4">
            {upcoming.map((c) => <ClassCard key={c.id} item={c} />)}
          </div>
        ) : (
          <p className="muted">Chưa có lớp nào mở đăng ký.</p>
        )}
      </section>

      {/* Membership band ----------------------------------------------- */}
      <section className="band">
        <div className="container">
          <div className="band__head">
            <h2 className="band__title display">Một thẻ.<br />Mọi sân tập.</h2>
            <p className="band__lead">
              Thẻ thành viên dùng cho mọi lớp nhóm, phòng gym và hồ bơi. Bạn chọn thời hạn phù hợp với mình.
            </p>
          </div>
          {plans.loading ? (
            <Loading />
          ) : packages.length ? (
            <div className="package-row">
              {packages.map((p, i) => (
                <PackageCard key={p.id} pkg={p} featured={i === 1} onChoose={() => navigate(`/memberships/${p.id}/checkout`)} />
              ))}
            </div>
          ) : (
            <p className="band__lead">
              {plans.error?.status === 401 ? 'Đăng nhập để xem các gói tập và giá.' : 'Các gói tập sẽ sớm được cập nhật.'}{' '}
              <Link className="text-link" to={plans.error?.status === 401 ? '/login' : '/memberships'}>
                {plans.error?.status === 401 ? 'Đăng nhập' : 'Xem gói tập'}
              </Link>
            </p>
          )}
          <p className="band__note">Đăng ký và thanh toán trực tuyến ngay trên web, hoặc tại quầy lễ tân.</p>
        </div>
      </section>

      {/* Coaches rail: drifts the other way from the sports rail; each card opens the coach's page */}
      {(coaches.data ?? []).length > 0 && (
        <Rail title="Đội ngũ huấn luyện viên" action={<Link className="text-link" to="/coaches">Tất cả huấn luyện viên</Link>} autoScroll direction="right">
          {coaches.data.map((c) => (
            <div key={c.id} className="rail__item rail__item--coach">
              <CoachCard coach={c} classes={classesOf(classList, c.id)} />
            </div>
          ))}
        </Rail>
      )}
    </>
  );
}
