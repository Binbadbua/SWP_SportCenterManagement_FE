import { useState } from 'react';
import { preview } from '../../api/previewStore.js';
import { useApi } from '../../hooks/useApi.js';
import { IMAGES } from '../../lib/images.js';
import { formatMoney } from '../../lib/format.js';
import { PackageCard } from '../../components/cards.jsx';
import Modal from '../../components/Modal.jsx';
import { Button, Loading, PreviewNotice } from '../../components/ui.jsx';

// UI-ONLY: there is no MembershipPackage / Membership / Payment API yet.
// When it exists, replace preview.packages with api.packages in the line below.
const INCLUDED = [
  ['All group classes', true, true, true],
  ['Gym floor & pool', 'Off-peak', true, true],
  ['Coach check-in', false, 'Monthly', 'Monthly'],
  ['Personal training plan', false, false, true],
  ['Progress reviews', false, false, true],
];

export default function Memberships() {
  const packages = useApi(() => preview.packages.list(), []);
  const [chosen, setChosen] = useState(null);
  const active = (packages.data ?? []).filter((p) => p.status === 1);

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
        <PreviewNotice feature="Buying a membership" />

        {packages.loading ? (
          <Loading />
        ) : (
          <div className="package-row package-row--light">
            {active.map((p, i) => (
              <PackageCard key={p.id} pkg={p} featured={i === 1} onChoose={setChosen} />
            ))}
          </div>
        )}

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
                    {cols.slice(0, active.length).map((v, i) => (
                      <td key={i}>{v === true ? 'Included' : v === false ? '—' : v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={!!chosen}
        title={chosen ? `${chosen.packageName} membership` : ''}
        onClose={() => setChosen(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChosen(null)}>Close</Button>
            <Button to="/register">Create an account</Button>
          </>
        }
      >
        {chosen && (
          <>
            <p className="modal-price num">{formatMoney(chosen.price)} <span className="muted">for {chosen.durationDays} days</span></p>
            <p>{chosen.description}</p>
            <div className="notice notice--preview" style={{ marginTop: 16 }}>
              <div>
                <strong className="notice__title">Online payment is coming soon</strong>
                <div className="notice__body">For now, pay at reception. Staff will create the membership and invoice for you.</div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
