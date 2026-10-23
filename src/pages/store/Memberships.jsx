import { useState } from 'react';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { IMAGES } from '../../lib/images.js';
import { formatDate, formatMoney, todayUtcDateString } from '../../lib/format.js';
import { PackageCard } from '../../components/cards.jsx';
import Modal from '../../components/Modal.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice, SampleDataNotice } from '../../components/ui.jsx';

// Plans come from GET /api/membership-packages. Members can't buy online (POST /api/memberships is
// for reception and managers), so choosing a plan explains how to pay at the desk.
const INCLUDED = [
  ['All group classes', true, true, true],
  ['Gym floor & pool', 'Off-peak', true, true],
  ['Coach check-in', false, 'Monthly', 'Monthly'],
  ['Personal training plan', false, false, true],
  ['Progress reviews', false, false, true],
];

export default function Memberships() {
  const { user } = useAuth();
  const member = isMember(user);
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const mine = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const [chosen, setChosen] = useState(null);
  const active = (packages.data ?? [])
    .filter((p) => p.status === 1)
    .sort((a, b) => a.durationDays - b.durationDays);
  const today = todayUtcDateString();
  const current = (mine.data ?? []).find((m) => m.status === 1 && String(m.endDate).slice(0, 10) >= today);

  return (
    <>
      <section className="plan-hero">
        <img src={IMAGES.memberships} alt="" />
        <div className="plan-hero__shade" />
        <div className="container plan-hero__content">
          <h1 className="display plan-hero__title">Membership</h1>
          <p className="plan-hero__lead">One pass for every class, court and lane. Pay once, train as often as you like.</p>
        </div>
      </section>

      <div className="container page">
        {current && (
          <Notice tone="success" title={`You’re on ${current.packageName}`}>
            Active until {formatDate(current.endDate)}. See every membership you’ve had under My account → Membership.
          </Notice>
        )}
        {packages.usingSample && <SampleDataNotice onRetry={packages.reload} />}
        {packages.error?.status === 401 ? (
          <EmptyState title="Sign in to see plans and prices" action={<Button to="/login?next=/memberships">Sign in</Button>}>
            Our plans are shown to signed-in visitors. New here? Create an account first.
          </EmptyState>
        ) : (
          <ErrorNotice error={!packages.usingSample ? packages.error : null} onRetry={packages.reload} />
        )}

        {packages.loading ? (
          <Loading />
        ) : active.length ? (
          <div className="package-row package-row--light">
            {active.map((p, i) => (
              <PackageCard key={p.id} pkg={p} featured={i === 1} onChoose={setChosen} />
            ))}
          </div>
        ) : (
          !packages.error && <EmptyState title="No plans on sale right now">Ask reception about memberships.</EmptyState>
        )}

        {active.length > 0 && (
          <section className="block">
            <h2 className="section-title">What’s included</h2>
            <div className="table-wrap">
              <table className="table compare">
                <thead>
                  <tr>
                    <th scope="col">Benefit</th>
                    {active.slice(0, 3).map((p) => <th scope="col" key={p.id}>{p.packageName}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {INCLUDED.map(([name, ...cols]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      {cols.slice(0, Math.min(3, active.length)).map((v, i) => (
                        <td key={i}>{v === true ? 'Included' : v === false ? '—' : v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <Modal
        open={!!chosen}
        title={chosen ? `${chosen.packageName} membership` : ''}
        onClose={() => setChosen(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChosen(null)}>Close</Button>
            {user ? (
              member && <Button to="/account?tab=membership">My memberships</Button>
            ) : (
              <Button to="/register">Create an account</Button>
            )}
          </>
        }
      >
        {chosen && (
          <>
            <p className="modal-price num">{formatMoney(chosen.price)} <span className="muted">for {chosen.durationDays} days</span></p>
            <p>{chosen.description}</p>
            <div className="notice notice--preview" style={{ marginTop: 16 }}>
              <div>
                <strong className="notice__title">Pay at reception</strong>
                <div className="notice__body">
                  Tell the front desk you’d like {chosen.packageName}. They create the membership and the invoice,
                  and it shows up in My account right away.
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
