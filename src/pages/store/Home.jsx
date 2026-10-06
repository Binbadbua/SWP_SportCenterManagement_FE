import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { IMAGES } from '../../lib/images.js';
import { daysUntil } from '../../lib/format.js';
import Rail from '../../components/Rail.jsx';
import { CategoryTile, ClassCard, CoachCard, PackageCard } from '../../components/cards.jsx';
import { Button, Loading, PreviewTag, SampleDataNotice } from '../../components/ui.jsx';

export default function Home() {
  const navigate = useNavigate();
  const categories = useApi(() => api.categories.list(), [], { sample: mock.categories });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const coaches = useApi(() => api.coaches.list(), [], { sample: mock.coaches });
  const usingSample = categories.usingSample || classes.usingSample || coaches.usingSample;

  const classList = classes.data ?? [];
  const countBySport = classList.reduce((acc, c) => ({ ...acc, [c.categoryId]: (acc[c.categoryId] ?? 0) + 1 }), {});
  const upcoming = classList
    .filter((c) => c.status === 1 || c.status === 2)
    .sort((a, b) => (daysUntil(a.startDate) ?? 0) - (daysUntil(b.startDate) ?? 0))
    .slice(0, 4);
  const packages = mock.packages.filter((p) => p.status === 1).slice(0, 3);

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section className="hero">
        <img className="hero__img" src={IMAGES.hero} alt="Aerial view of a tennis player serving on a clay court" />
        <div className="hero__shade" />
        <div className="hero__content container">
          <p className="hero__eyebrow label">New season · classes open now</p>
          <h1 className="hero__title display">
            Your<br />move.
          </h1>
          <p className="hero__lead">
            Yoga at sunrise, barbells after work, doubles on Saturday. Pick a class, book your spot and we’ll hold it for you.
          </p>
          <div className="hero__actions">
            <Button variant="offset" size="lg" to="/classes" iconAfter="arrowRight">Book a class</Button>
            <Link to="/memberships" className="hero__link">See memberships</Link>
          </div>
        </div>
      </section>

      {usingSample && (
        <div className="container section-notice">
          <SampleDataNotice onRetry={() => { categories.reload(); classes.reload(); coaches.reload(); }} />
        </div>
      )}

      {/* Sports rail --------------------------------------------------- */}
      <Rail title="Pick your sport" action={<Link className="text-link" to="/classes">All classes</Link>}>
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
            <p className="feature-tile__kicker">Group training</p>
            <h2 className="feature-tile__title">Better with a crowd</h2>
            <span className="btn btn--inverse btn--sm">Browse classes</span>
          </div>
        </Link>
        <Link to="/coaches" className="feature-tile">
          <img src={IMAGES.coaching} alt="" loading="lazy" />
          <div className="feature-tile__text">
            <p className="feature-tile__kicker">Coaching</p>
            <h2 className="feature-tile__title">A plan written for you</h2>
            <span className="btn btn--inverse btn--sm">Meet the coaches</span>
          </div>
        </Link>
      </section>

      {/* Starting soon ------------------------------------------------- */}
      <section className="container block">
        <div className="block__head">
          <h2 className="section-title">Starting soon</h2>
          <Link className="text-link" to="/classes">See all</Link>
        </div>
        {classes.loading ? (
          <Loading />
        ) : upcoming.length ? (
          <div className="product-grid product-grid--4">
            {upcoming.map((c) => <ClassCard key={c.id} item={c} />)}
          </div>
        ) : (
          <p className="muted">No classes are open for booking yet.</p>
        )}
      </section>

      {/* Membership band ----------------------------------------------- */}
      <section className="band">
        <div className="container">
          <div className="band__head">
            <h2 className="band__title display">One pass.<br />Every court.</h2>
            <p className="band__lead">
              Memberships cover every group class, the gym floor and the pool. Choose how long you want to commit.
            </p>
          </div>
          <div className="package-row">
            {packages.map((p, i) => (
              <PackageCard key={p.id} pkg={p} featured={i === 1} onChoose={() => navigate('/memberships')} />
            ))}
          </div>
          <p className="band__note">
            <PreviewTag>Preview</PreviewTag> Plans are sample data until the membership API exists. Pay at reception for now.
          </p>
        </div>
      </section>

      {/* Coaches rail -------------------------------------------------- */}
      <Rail title="Coached by" action={<Link className="text-link" to="/coaches">All coaches</Link>}>
        {(coaches.data ?? []).map((c) => (
          <div key={c.id} className="rail__item rail__item--coach">
            <CoachCard coach={c} />
          </div>
        ))}
      </Rail>
    </>
  );
}
