import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import { apiUrl } from '../../api/client.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import {
  formatDate, formatMoney, formatTimeRange, formatWeekday, isSessionOver, realPhone,
} from '../../lib/format.js';
import { discountFor, maxDiscount, priceAfter } from '../../lib/pricing.js';
import Icon from '../../components/Icon.jsx';
import PayMethods, { WEB_METHODS } from '../../components/PayMethods.jsx';
import { AgreeToPolicies } from '../../components/Policies.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice } from '../../components/ui.jsx';

// A member books a class with a fee (CHANGELOG Part B, B53): POST /api/payments/class-checkout holds a place with a
// pending invoice for 30 minutes while the member pays reception, like a package bought on the website. The API works
// out the amount (the class fee less the discount of the member's card); this page shows the same figure beforehand.
// A free class is booked straight from its page.
export default function ClassCheckout() {
  const { id } = useParams();
  const { user } = useAuth();
  const member = isMember(user);
  const navigate = useNavigate();
  const location = useLocation();
  const cls = useApi(() => api.classes.get(id), [id]);
  const sessions = useApi(() => api.schedules.byClass(id), [id]);
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const cards = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const me = useApi(() => api.members.me.get(), [user?.accountId], { skip: !member });
  const mine = useApi(() => api.bookings.mine(), [user?.accountId], { skip: !member });

  const [method, setMethod] = useState(WEB_METHODS[0].value);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [failure, setFailure] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  if (cls.loading || sessions.loading) {
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  }
  const c = cls.data;
  const upcoming = (sessions.data ?? [])
    .filter((s) => !isSessionOver(s))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const full = c?.currentEnrolled != null && c.currentEnrolled >= c.maxCapacity;
  const open = c && (c.status === 1 || c.status === 2) && upcoming.length > 0 && !full;
  if (!c || typeof c.price !== 'number' || c.price <= 0 || !open) {
    return (
      <div className="container page">
        <ErrorNotice error={cls.error?.status === 404 ? null : cls.error} onRetry={cls.reload} />
        <EmptyState
          title={
            !c
              ? 'Không tìm thấy lớp học này'
              : typeof c.price !== 'number' || c.price <= 0
                ? 'Lớp này không cần thanh toán trước'
                : 'Lớp này không nhận đặt thêm'
          }
          action={<Button to={c ? `/classes/${c.id}` : '/classes'}>{c ? 'Về trang lớp' : 'Xem các lớp học'}</Button>}
        >
          {!c
            ? 'Có thể lớp đã bị xóa hoặc đường dẫn không đúng.'
            : typeof c.price !== 'number' || c.price <= 0
              ? 'Bạn đặt lớp này ngay trên trang lớp.'
              : 'Lớp đã đủ chỗ, đã kết thúc hoặc không còn buổi học sắp tới.'}
        </EmptyState>
      </div>
    );
  }

  const already = (mine.data ?? []).find((b) => b.classId === c.id && b.status !== 3);
  const deal = member ? discountFor(cards.data, packages.data) : { percent: 0 };
  const total = priceAfter(c.price, deal.percent);
  const top = maxDiscount(packages.data);
  const next = upcoming[0];
  const profile = me.data;

  const pay = async (e) => {
    e.preventDefault();
    if (!agree) {
      setAgreeError('Bạn cần đồng ý với điều khoản trước khi thanh toán.');
      return;
    }
    setAgreeError(null);
    setPaying(true);
    setFailure(null);
    setUnavailable(false);
    try {
      const res = await api.payments.classCheckout({ classId: c.id, paymentMethod: method });
      if (res?.paymentUrl) window.location.assign(apiUrl(res.paymentUrl));
      else if (res?.paymentId) navigate(`/payment/result?paymentId=${encodeURIComponent(res.paymentId)}`);
      // Nothing to pay after all (the API books it at once)
      else navigate('/account?tab=bookings');
    } catch (err) {
      if (isMissingRoute(err)) setUnavailable(true);
      else setFailure(err.message || 'Không tạo được giao dịch thanh toán.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="container page checkout">
      <nav className="crumbs" aria-label="Đường dẫn">
        <Link to="/classes">Lớp học</Link> / <Link to={`/classes/${c.id}`}>{c.className}</Link> / <span>Đặt lớp</span>
      </nav>
      <header className="checkout__head">
        <h1 className="checkout__title">Đặt lớp và thanh toán</h1>
        <p className="muted">
          Học phí trả một lần cho cả khóa. Đơn giữ chỗ cho bạn 30 phút để thanh toán với lễ tân; lễ tân xác nhận xong
          là bạn có chỗ trong lớp.
        </p>
      </header>

      <div className="checkout__grid">
        <div className="checkout__main">
          {!user ? (
            <section className="checkout__step">
              <h2 className="checkout__step-title">Đăng nhập để đặt lớp này</h2>
              <p className="muted">Lớp gắn với tài khoản học viên của bạn. Đăng nhập (hoặc tạo tài khoản) rồi quay lại đây.</p>
              <div className="checkout__gate">
                <Button to={`/login?next=${encodeURIComponent(location.pathname)}`}>Đăng nhập</Button>
                <Button variant="secondary" to="/register">Tạo tài khoản</Button>
              </div>
            </section>
          ) : !member ? (
            <Notice
              tone="info"
              title="Bạn đang đăng nhập bằng tài khoản nhân viên"
              action={<Button size="sm" variant="secondary" to="/staff/bookings">Đặt lớp tại quầy</Button>}
            >
              Học viên tự đặt lớp trên web. Để thu tiền và đặt lớp cho học viên, dùng Khu vực nhân viên → Đặt lớp.
            </Notice>
          ) : already ? (
            <Notice
              tone="info"
              title={already.status === 4 ? 'Bạn đang có một đơn chờ thanh toán cho lớp này' : 'Bạn đã đặt lớp này'}
              action={
                already.status === 4 && already.invoiceId ? (
                  <Button size="sm" variant="secondary" to={`/payment/result?paymentId=${already.invoiceId}`}>Xem đơn</Button>
                ) : (
                  <Button size="sm" variant="secondary" to="/account?tab=bookings">Lớp đã đặt</Button>
                )
              }
            >
              Mỗi học viên đặt một lớp một lần.
            </Notice>
          ) : (
            <form id="class-checkout-form" className="checkout__form" onSubmit={pay} noValidate>
              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">1</span> Thông tin học viên</h2>
                <dl className="checkout__who">
                  <div><dt>Họ và tên</dt><dd>{profile?.fullName ?? user.fullName}</dd></div>
                  <div><dt>Email</dt><dd>{profile?.email ?? user.email}</dd></div>
                  <div><dt>Số điện thoại</dt><dd className="num">{realPhone(profile?.phone) || '—'}</dd></div>
                </dl>
              </section>

              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">2</span> Lớp học</h2>
                <dl className="checkout__who">
                  <div><dt>Môn</dt><dd>{c.categoryName}</dd></div>
                  <div><dt>Huấn luyện viên</dt><dd>{c.coachName}</dd></div>
                  <div><dt>Thời gian</dt><dd className="num">{formatDate(c.startDate)} – {formatDate(c.endDate)}</dd></div>
                  <div>
                    <dt>Buổi kế tiếp</dt>
                    <dd className="num">
                      {formatWeekday(next.date)} {formatDate(next.date)} · {formatTimeRange(next.startTime, next.endTime)}
                    </dd>
                  </div>
                  <div><dt>Số buổi còn lại</dt><dd className="num">{upcoming.length}</dd></div>
                </dl>
              </section>

              <section className="checkout__step">
                <h2 className="checkout__step-title"><span className="checkout__num">3</span> Phương thức thanh toán</h2>
                <PayMethods value={method} onChange={setMethod} />
                <label className={`check check--terms ${agreeError ? 'check--error' : ''}`}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span><AgreeToPolicies lead="Tôi đồng ý với" termsNote="(gồm quy định hủy lớp và hoàn tiền)" /></span>
                </label>
                {agreeError && <p className="field__error">{agreeError}</p>}
              </section>
            </form>
          )}
        </div>

        <aside className="checkout__summary" aria-label="Tóm tắt đơn đặt lớp">
          <p className="label">Lớp đã chọn</p>
          <h2 className="checkout__pkg display">{c.className}</h2>
          <p className="muted">Lớp {c.categoryName} · cùng {c.coachName}</p>
          <dl className="checkout__lines">
            <div><dt>Học phí cả khóa</dt><dd className="num">{formatMoney(c.price)}</dd></div>
            {deal.percent > 0 && (
              <div>
                <dt>{deal.pkg.packageName} giảm {deal.percent}%</dt>
                <dd className="num">−{formatMoney(c.price - total)}</dd>
              </div>
            )}
            <div className="checkout__total"><dt>Tổng thanh toán</dt><dd className="num">{formatMoney(total)}</dd></div>
          </dl>
          {member && deal.percent === 0 && top > 0 && (
            <p className="muted small">
              Có thẻ thành viên còn hiệu lực thì được giảm tới {top}% học phí.{' '}
              <Link className="text-link" to="/memberships">Xem gói tập</Link>
            </p>
          )}
          {member && !already && (
            <>
              {unavailable && (
                <Notice tone="info" title="Máy chủ chưa nhận thanh toán lớp">
                  Chưa có lượt đặt hay khoản tiền nào được tạo. Trong lúc chờ, bạn có thể đặt lớp này tại quầy lễ tân hoặc{' '}
                  <Link className="text-link" to="/account?tab=support">hỏi lễ tân</Link>.
                </Notice>
              )}
              {failure && <p className="field__error" role="alert">{failure}</p>}
              <Button type="submit" form="class-checkout-form" size="lg" block disabled={paying}>
                {paying ? 'Đang tạo giao dịch…' : `Đặt lớp và thanh toán ${formatMoney(total)}`}
              </Button>
              <p className="checkout__safe muted">
                <Icon name="check" size={16} strokeWidth={2} /> Bước này chưa trừ tiền: bạn thanh toán với lễ tân; quá 30 phút
                chưa xác nhận thì lượt đặt tự hủy và chỗ được trả lại.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
