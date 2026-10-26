import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import { apiUrl } from '../../api/client.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { addDaysToDateInput, formatDate, formatMoney, fromDateInput, realPhone, todayUtcDateString } from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import { AgreeToPolicies } from '../../components/Policies.jsx';
import { Button, EmptyState, Field, Loading, Notice, SampleDataNotice } from '../../components/ui.jsx';

// Ways to pay for a web order (values are PaymentMethod in lib/enums.js); cash stays at the reception desk
const METHODS = [
  { value: 2, title: 'Chuyển khoản ngân hàng', text: 'Chuyển khoản theo hướng dẫn của lễ tân, ghi mã giao dịch trong nội dung chuyển khoản.' },
  { value: 3, title: 'Thẻ ATM / Visa / Mastercard', text: 'Quẹt thẻ tại quầy lễ tân, đọc mã giao dịch cho lễ tân.' },
];

// A member confirms a package: POST /api/payments/checkout creates the membership (inactive) + a pending
// invoice. The API has no payment gateway yet (paymentUrl is null), so the member goes to /payment/result
// while reception or a manager confirms the money within 30 minutes; after that the API cancels the order.
// A paymentUrl, once the API has a real gateway, is followed instead.
export default function Checkout() {
  const { id } = useParams();
  const { user } = useAuth();
  const member = isMember(user);
  const navigate = useNavigate();
  const location = useLocation();
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const me = useApi(() => api.members.me.get(), [user?.accountId], { skip: !member });
  const mine = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });

  const [startDate, setStartDate] = useState(null); // null = the suggested day
  const [method, setMethod] = useState(METHODS[0].value);
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
    if (Object.keys(found).length) return;
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
      if (res?.paymentUrl) window.location.assign(apiUrl(res.paymentUrl));
      else navigate(`/payment/result?paymentId=${encodeURIComponent(res?.paymentId ?? '')}`);
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
          Kiểm tra gói tập, chọn ngày bắt đầu và cách thanh toán. Đơn được giữ 30 phút để lễ tân xác nhận thanh toán;
          thẻ được kích hoạt và hóa đơn được xuất ngay khi lễ tân xác nhận.
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
                <div className="pay-methods" role="radiogroup" aria-label="Phương thức thanh toán">
                  {METHODS.map((m) => (
                    <label key={m.value} className={`pay-method ${method === m.value ? 'is-active' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m.value}
                        checked={method === m.value}
                        onChange={() => setMethod(m.value)}
                      />
                      <span className="pay-method__text">
                        <strong>{m.title}</strong>
                        <span className="muted">{m.text}</span>
                      </span>
                    </label>
                  ))}
                </div>
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
          {member && (
            <>
              {unavailable && (
                <Notice tone="info" title="Cổng thanh toán chưa sẵn sàng">
                  Máy chủ chưa có chức năng thanh toán trực tuyến, nên chưa có thẻ, hóa đơn hay khoản tiền nào được
                  tạo. Trong lúc chờ, bạn có thể đăng ký gói này tại quầy lễ tân hoặc{' '}
                  <Link className="text-link" to="/account?tab=support">hỏi lễ tân</Link>.
                </Notice>
              )}
              {failure && <p className="field__error" role="alert">{failure}</p>}
              <Button type="submit" form="checkout-form" size="lg" block disabled={paying}>
                {paying ? 'Đang tạo giao dịch…' : `Xác nhận và thanh toán ${formatMoney(pkg.price)}`}
              </Button>
              <p className="checkout__safe muted">
                <Icon name="check" size={16} strokeWidth={2} /> Bước này chưa trừ tiền: bạn thanh toán với lễ tân, quá 30 phút chưa xác nhận thì đơn tự hủy.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
