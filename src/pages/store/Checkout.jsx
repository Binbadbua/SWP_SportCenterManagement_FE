import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { usePaymentOptions } from '../../hooks/usePricing.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { addDaysToDateInput, formatDate, formatMoney, fromDateInput, realPhone, todayUtcDateString } from '../../lib/format.js';
import { afterCheckout, waitingOrder } from '../../lib/payments.js';
import Icon from '../../components/Icon.jsx';
import PayMethods from '../../components/PayMethods.jsx';
import { AgreeToPolicies } from '../../components/Policies.jsx';
import { Button, EmptyState, Field, Loading, Notice, SampleDataNotice } from '../../components/ui.jsx';

// A member confirms a package: POST /api/payments/checkout creates the membership (inactive) + a pending invoice.
// With MoMo (CHANGELOG Part B, B54) the member pays online straight away (QR code or ATM card) and the card is active
// as soon as MoMo tells the API; before that the order waits 30 minutes for reception to confirm a bank transfer.
export default function Checkout() {
  const { id } = useParams();
  const { user } = useAuth();
  const member = isMember(user);
  const navigate = useNavigate();
  const location = useLocation();
  const opts = usePaymentOptions();
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const me = useApi(() => api.members.me.get(), [user?.accountId], { skip: !member });
  const mine = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const invoices = useApi(() => api.invoices.mine(), [user?.accountId], { skip: !member });

  const [startDate, setStartDate] = useState(null); // null = the suggested day
  const [picked, setPicked] = useState(null); // null = the first method the API takes
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [paying, setPaying] = useState(false);
  const [failure, setFailure] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  const today = todayUtcDateString();
  // With a membership still running, the new one starts the day after it ends
  const current = (mine.data ?? [])
    .filter((m) => m.status === 1 && String(m.endDate).slice(0, 10) >= today)
    .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0];
  const start = startDate ?? (current ? addDaysToDateInput(String(current.endDate).slice(0, 10), 1) : today);
  const pkg = (packages.data ?? []).find((p) => p.id === id);
  const end = pkg ? addDaysToDateInput(start, pkg.durationDays - 1) : '';
  const waiting = waitingOrder(mine.data, invoices.data, today);
  const method = picked ?? opts?.methods[0];
  const hold = opts?.holdMinutes ?? 30;

  if (packages.loading) {
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  }
  if (!pkg || pkg.status !== 1) {
    return (
      <div className="container page">
        <EmptyState title="Gói tập này không còn mở bán" action={<Button to="/memberships">Xem các gói tập</Button>}>
          Gói có thể đã ngừng bán hoặc đường dẫn chưa đúng. Hãy chọn một gói khác.
        </EmptyState>
      </div>
    );
  }

  const pay = async (e) => {
    e.preventDefault();
    const found = {};
    if (!start || start < today) found.startDate = 'Ngày bắt đầu phải từ hôm nay trở đi.';
    if (!agree) found.agree = 'Bạn cần đồng ý với điều khoản trước khi thanh toán.';
    setErrors(found);
    if (Object.keys(found).length || !method) return;
    setPaying(true);
    setFailure(null);
    setUnavailable(false);
    try {
      const res = await api.payments.checkout({
        membershipPackageId: pkg.id,
        startDate: fromDateInput(start),
        paymentMethod: method,
        returnUrl: `${window.location.origin}/payment/result`,
      });
      afterCheckout(res, method, navigate);
    } catch (err) {
      if (isMissingRoute(err)) setUnavailable(true);
      else setFailure(err.message || 'Không tạo được giao dịch thanh toán.');
    } finally {
      setPaying(false);
    }
  };

  const profile = me.data;
  return (
    <div className="container page checkout">
      <nav className="crumbs" aria-label="Đường dẫn">
        <Link to="/memberships">Gói tập</Link> / <span>Đăng ký {pkg.packageName}</span>
      </nav>
      <header className="checkout__head">
        <h1 className="checkout__title">Xác nhận đăng ký và thanh toán</h1>
        <p className="muted">
          {opts?.online
            ? `Kiểm tra gói tập, chọn ngày bắt đầu rồi thanh toán trực tuyến qua MoMo. Đơn được giữ ${hold} phút; thẻ được kích hoạt và hóa đơn được xuất ngay khi MoMo báo đã nhận tiền.`
            : `Kiểm tra gói tập, chọn ngày bắt đầu rồi chuyển khoản. Đơn được giữ ${hold} phút để lễ tân đối soát; thẻ được kích hoạt và hóa đơn được xuất ngay khi lễ tân xác nhận.`}
        </p>
      </header>
      {packages.usingSample && <SampleDataNotice onRetry={packages.reload} />}

      <div className="checkout__grid">
        <div className="checkout__main">
          {!user ? (
            <section className="checkout__step">
              <h2 className="checkout__step-title">Đăng nhập để đăng ký gói này</h2>
              <p className="muted">
                Thẻ thành viên gắn với tài khoản học viên của bạn. Đăng nhập (hoặc tạo tài khoản) rồi quay lại đây
                để thanh toán.
              </p>
              <div className="checkout__gate">
                <Button to={`/login?next=${encodeURIComponent(location.pathname)}`}>Đăng nhập</Button>
                <Button variant="secondary" to="/register">Tạo tài khoản</Button>
              </div>
            </section>
          ) : !member ? (
            <Notice
              tone="info"
              title="Bạn đang đăng nhập bằng tài khoản nhân viên"
              action={<Button size="sm" variant="secondary" to="/staff">Vào khu vực nhân viên</Button>}
            >
              Học viên tự đăng ký gói trên web. Để tạo thẻ cho học viên tại quầy, dùng Khu vực nhân viên → Thẻ thành viên.
            </Notice>
          ) : waiting ? (
            <Notice
              tone="warning"
              title={`Bạn đang có đơn ${waiting.card.packageName} chờ thanh toán`}
              action={
                <Button size="sm" to={`/payment/result?paymentId=${waiting.invoice.id}`}>
                  {opts?.online ? 'Tiếp tục thanh toán' : 'Xem đơn'}
                </Button>
              }
            >
              Mỗi lần chỉ có một đơn chờ thanh toán. Hãy thanh toán đơn đó{opts?.online ? ', hủy nó' : ''} hoặc chờ đơn tự
              hết hạn rồi đặt gói này.
            </Notice>
          ) : (
            <form id="checkout-form" className="checkout__form" onSubmit={pay} noValidate>
              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">1</span> Thông tin học viên</h2>
                <dl className="checkout__who">
                  <div><dt>Họ và tên</dt><dd>{profile?.fullName ?? user.fullName}</dd></div>
                  <div><dt>Email</dt><dd>{profile?.email ?? user.email}</dd></div>
                  <div><dt>Số điện thoại</dt><dd className="num">{realPhone(profile?.phone) || '—'}</dd></div>
                </dl>
                <p className="muted small">
                  Thông tin chưa đúng? Sửa ở <Link className="text-link" to="/account?tab=profile">Hồ sơ</Link> trước khi thanh toán.
                </p>
              </section>

              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">2</span> Thời gian sử dụng</h2>
                {current && (
                  <Notice tone="info" title={`Bạn đang dùng ${current.packageName}`}>
                    Thẻ hiện tại còn hiệu lực đến {formatDate(current.endDate)}, nên thẻ mới bắt đầu từ ngày hôm sau.
                    Bạn vẫn có thể chọn ngày khác.
                    {opts?.upgrade && (
                      <>
                        {' '}Muốn đổi sang gói dài hơn ngay hôm nay thì dùng{' '}
                        <Link className="text-link" to="/account?tab=membership">Nâng cấp gói</Link> ở thẻ thành viên.
                      </>
                    )}
                  </Notice>
                )}
                <div className="form-grid">
                  <Field
                    label="Ngày bắt đầu"
                    name="startDate"
                    type="date"
                    required
                    min={today}
                    value={start}
                    onChange={(_, v) => setStartDate(v)}
                    error={errors.startDate}
                  />
                  <div className="field">
                    <span className="field__label">Ngày kết thúc</span>
                    <p className="checkout__end num">{formatDate(end)}</p>
                    <p className="field__help">Tự tính theo {pkg.durationDays} ngày của gói.</p>
                  </div>
                </div>
              </section>

              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">3</span> Phương thức thanh toán</h2>
                {opts ? (
                  <PayMethods value={method} onChange={setPicked} methods={opts.methods} />
                ) : (
                  <Loading label="Đang tải cách thanh toán" />
                )}
                <label className={`check check--terms ${errors.agree ? 'check--error' : ''}`}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span><AgreeToPolicies lead="Tôi đồng ý với" termsNote="(gồm quy định hoàn tiền, bảo lưu)" /></span>
                </label>
                {errors.agree && <p className="field__error">{errors.agree}</p>}
              </section>
            </form>
          )}
        </div>

        <aside className="checkout__summary" aria-label="Tóm tắt đơn đăng ký">
          <p className="label">Gói đã chọn</p>
          <h2 className="checkout__pkg display">{pkg.packageName}</h2>
          {pkg.description && <p className="muted">{pkg.description}</p>}
          <dl className="checkout__lines">
            <div><dt>Thời hạn</dt><dd className="num">{pkg.durationDays} ngày</dd></div>
            {member && (
              <>
                <div><dt>Bắt đầu</dt><dd className="num">{formatDate(start)}</dd></div>
                <div><dt>Kết thúc</dt><dd className="num">{formatDate(end)}</dd></div>
              </>
            )}
            <div className="checkout__total"><dt>Tổng thanh toán</dt><dd className="num">{formatMoney(pkg.price)}</dd></div>
          </dl>
          {member && !waiting && (
            <>
              {unavailable && (
                <Notice tone="info" title="Cổng thanh toán chưa sẵn sàng">
                  Máy chủ chưa có chức năng thanh toán trực tuyến, nên chưa có thẻ, hóa đơn hay khoản tiền nào được
                  tạo. Trong lúc chờ, bạn có thể đăng ký gói này tại quầy lễ tân hoặc{' '}
                  <Link className="text-link" to="/account?tab=support">hỏi lễ tân</Link>.
                </Notice>
              )}
              {failure && <p className="field__error" role="alert">{failure}</p>}
              <Button type="submit" form="checkout-form" size="lg" block disabled={paying || !opts}>
                {paying ? 'Đang tạo giao dịch…' : `Xác nhận và thanh toán ${formatMoney(pkg.price)}`}
              </Button>
              <p className="checkout__safe muted">
                <Icon name="check" size={16} strokeWidth={2} />{' '}
                {opts?.online
                  ? `Bước này chưa trừ tiền: bạn quét mã QR hoặc nhập thẻ ở bước sau; quá ${hold} phút chưa thanh toán thì đơn tự hủy.`
                  : `Bước này chưa trừ tiền: bạn chuyển khoản ở bước sau; quá ${hold} phút lễ tân chưa xác nhận thì đơn tự hủy.`}
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
