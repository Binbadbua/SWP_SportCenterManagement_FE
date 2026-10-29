import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { usePaymentOptions } from '../../hooks/usePricing.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { addDaysToDateInput, daysUntil, formatDate, formatMoney, todayUtcDateString } from '../../lib/format.js';
import { cardsOn, upgradeQuote, upgradeTargets } from '../../lib/membership.js';
import { afterCheckout, waitingOrder } from '../../lib/payments.js';
import Icon from '../../components/Icon.jsx';
import PayMethods from '../../components/PayMethods.jsx';
import { AgreeToPolicies } from '../../components/Policies.jsx';
import { Button, EmptyState, Loading, Notice } from '../../components/ui.jsx';

// /memberships/upgrade?to=<packageId>: the member moves the card in use today to a longer package (CHANGELOG Part B,
// B54). POST /api/payments/upgrade-checkout takes what is left of the old card off the new price; once paid the new
// card runs from today and the old one ends today. An API without upgrades shows the same figures but cannot take them.
export default function UpgradeCheckout() {
  const { user } = useAuth();
  const member = isMember(user);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const opts = usePaymentOptions();
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const cards = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const invoices = useApi(() => api.invoices.mine(), [user?.accountId], { skip: !member });

  const [chosen, setChosen] = useState(params.get('to'));
  const [picked, setPicked] = useState(null);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [failure, setFailure] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  if (!member) {
    return (
      <div className="container page">
        <EmptyState
          title={user ? 'Trang này dành cho học viên' : 'Đăng nhập để nâng cấp gói'}
          action={<Button to={user ? '/staff' : '/login?next=/memberships/upgrade'}>{user ? 'Vào khu vực nhân viên' : 'Đăng nhập'}</Button>}
        >
          Nâng cấp chuyển thẻ thành viên đang dùng của bạn sang gói dài hơn.
        </EmptyState>
      </div>
    );
  }
  if (packages.loading || cards.loading) {
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  }

  const today = todayUtcDateString();
  const [card] = cardsOn(cards.data, today);
  const targets = upgradeTargets(card, packages.data);
  if (!card || !targets.length) {
    return (
      <div className="container page">
        <EmptyState
          title={card ? `${card.packageName} đã là gói dài nhất` : 'Bạn chưa có thẻ đang dùng'}
          action={<Button to={card ? '/account?tab=membership' : '/memberships'}>{card ? 'Về thẻ thành viên' : 'Xem các gói tập'}</Button>}
        >
          {card
            ? 'Không còn gói nào dài hơn để nâng cấp. Khi thẻ sắp hết hạn, bạn có thể gia hạn thêm một kỳ.'
            : 'Nâng cấp dùng cho thẻ còn hiệu lực hôm nay. Hãy chọn một gói ở trang Gói tập.'}
        </EmptyState>
      </div>
    );
  }

  const own = (packages.data ?? []).find((p) => p.id === card.packageId);
  // What was paid for the card: its paid invoice, else the package's price
  const paid = (invoices.data ?? []).find((i) => i.memberMembershipId === card.id && i.status === 2)?.amount ?? own?.price ?? 0;
  const target = targets.find((p) => p.id === chosen) ?? targets[0];
  const quote = upgradeQuote(card, paid, target.price, today);
  const waiting = waitingOrder(cards.data, invoices.data, today);
  const method = picked ?? opts?.methods[0];
  const canUpgrade = !!opts?.upgrade;

  const pay = async (e) => {
    e.preventDefault();
    if (!agree) {
      setAgreeError('Bạn cần đồng ý với điều khoản trước khi thanh toán.');
      return;
    }
    if (!method) return;
    setAgreeError(null);
    setPaying(true);
    setFailure(null);
    setUnavailable(false);
    try {
      const res = await api.payments.upgradeCheckout({
        membershipId: card.id,
        membershipPackageId: target.id,
        paymentMethod: method,
        returnUrl: `${window.location.origin}/payment/result`,
      });
      // Nothing left to pay: the API moved the card at once
      if (afterCheckout(res, method, navigate) === null) navigate('/account?tab=membership');
    } catch (err) {
      if (isMissingRoute(err)) setUnavailable(true);
      else setFailure(err.message || 'Không tạo được giao dịch nâng cấp.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="container page checkout">
      <nav className="crumbs" aria-label="Đường dẫn">
        <Link to="/account?tab=membership">Thẻ thành viên</Link> / <span>Nâng cấp gói</span>
      </nav>
      <header className="checkout__head">
        <h1 className="checkout__title">Nâng cấp gói</h1>
        <p className="muted">
          Chuyển thẻ đang dùng sang gói dài hơn ngay hôm nay. Phần còn lại của thẻ cũ được trừ vào giá gói mới, nên bạn
          chỉ trả phần chênh lệch.
        </p>
      </header>
      {!canUpgrade && opts && (
        <Notice tone="info" title="Máy chủ chưa nhận nâng cấp gói">
          Số tiền bên dưới là ước tính theo quy định nâng cấp; máy chủ chưa có chức năng này nên chưa thanh toán được.
          Trong lúc chờ, bạn có thể <Link className="text-link" to="/account?tab=support">hỏi lễ tân</Link>.
        </Notice>
      )}

      <div className="checkout__grid">
        <div className="checkout__main">
          {waiting ? (
            <Notice
              tone="warning"
              title={`Bạn đang có đơn ${waiting.card.packageName} chờ thanh toán`}
              action={<Button size="sm" to={`/payment/result?paymentId=${waiting.invoice.id}`}>Xem đơn</Button>}
            >
              Mỗi lần chỉ có một đơn chờ thanh toán. Hãy thanh toán hoặc hủy đơn đó trước khi nâng cấp.
            </Notice>
          ) : (
            <form id="upgrade-form" className="checkout__form" onSubmit={pay} noValidate>
              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">1</span> Thẻ đang dùng</h2>
                <dl className="checkout__who">
                  <div><dt>Gói</dt><dd>{card.packageName}</dd></div>
                  <div><dt>Hiệu lực</dt><dd className="num">{formatDate(card.startDate)} – {formatDate(card.endDate)}</dd></div>
                  <div><dt>Còn lại</dt><dd className="num">{quote.unused} / {quote.total} ngày</dd></div>
                  <div><dt>Giá trị còn lại</dt><dd className="num">{formatMoney(quote.credit)}</dd></div>
                </dl>
                <p className="muted small">
                  Giá trị còn lại = số đã trả ({formatMoney(paid)}) × số ngày còn lại sau hôm nay ÷ số ngày của thẻ, làm tròn
                  xuống nghìn đồng. Thẻ cũ kết thúc hôm nay ({daysUntil(card.endDate) > 0 ? `thay vì ${formatDate(card.endDate)}` : 'đúng ngày hết hạn'}).
                </p>
              </section>

              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">2</span> Gói mới</h2>
                <div className="pay-methods" role="radiogroup" aria-label="Gói mới">
                  {targets.map((p) => {
                    const q = upgradeQuote(card, paid, p.price, today);
                    return (
                      <label key={p.id} className={`pay-method ${target.id === p.id ? 'is-active' : ''}`}>
                        <input type="radio" name="target" value={p.id} checked={target.id === p.id} onChange={() => setChosen(p.id)} />
                        <span className="pay-method__text">
                          <strong>{p.packageName} · {p.durationDays} ngày</strong>
                          <span className="muted num">
                            Giá {formatMoney(p.price)} · trả thêm {formatMoney(q.due)}
                            {Number(p.discountPercent ?? 0) > 0 && ` · giảm ${p.discountPercent}% học phí mọi lớp`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">3</span> Phương thức thanh toán</h2>
                {opts ? (
                  <PayMethods value={method} onChange={setPicked} methods={opts.methods} />
                ) : (
                  <Loading label="Đang tải cách thanh toán" />
                )}
                <label className={`check check--terms ${agreeError ? 'check--error' : ''}`}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span><AgreeToPolicies lead="Tôi đồng ý với" termsNote="(gồm quy định nâng cấp và hoàn tiền)" /></span>
                </label>
                {agreeError && <p className="field__error">{agreeError}</p>}
              </section>
            </form>
          )}
        </div>

        <aside className="checkout__summary" aria-label="Tóm tắt nâng cấp">
          <p className="label">Gói mới</p>
          <h2 className="checkout__pkg display">{target.packageName}</h2>
          {target.description && <p className="muted">{target.description}</p>}
          <dl className="checkout__lines">
            <div><dt>Hiệu lực</dt><dd className="num">{formatDate(today)} – {formatDate(addDaysToDateInput(today, target.durationDays - 1))}</dd></div>
            <div><dt>Giá gói mới</dt><dd className="num">{formatMoney(target.price)}</dd></div>
            <div><dt>Trừ phần còn lại của {card.packageName}</dt><dd className="num">−{formatMoney(quote.credit)}</dd></div>
            <div className="checkout__total"><dt>Tổng thanh toán</dt><dd className="num">{formatMoney(quote.due)}</dd></div>
          </dl>
          {!waiting && (
            <>
              {unavailable && (
                <Notice tone="info" title="Máy chủ chưa nhận nâng cấp gói">
                  Chưa có thẻ, hóa đơn hay khoản tiền nào được tạo. Trong lúc chờ, bạn có thể{' '}
                  <Link className="text-link" to="/account?tab=support">hỏi lễ tân</Link>.
                </Notice>
              )}
              {failure && <p className="field__error" role="alert">{failure}</p>}
              <Button type="submit" form="upgrade-form" size="lg" block disabled={paying || !opts || !canUpgrade}>
                {paying ? 'Đang tạo giao dịch…' : `Nâng cấp và thanh toán ${formatMoney(quote.due)}`}
              </Button>
              <p className="checkout__safe muted">
                <Icon name="check" size={16} strokeWidth={2} />{' '}
                Thẻ cũ vẫn dùng bình thường cho tới khi thanh toán xong; số tiền chính xác do hệ thống tính khi tạo đơn.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
