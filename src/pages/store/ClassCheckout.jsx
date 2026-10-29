import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { usePaymentOptions } from '../../hooks/usePricing.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import {
  formatDate, formatMoney, formatTimeRange, formatWeekday, isSessionOver, realPhone,
} from '../../lib/format.js';
import { classStarted } from '../../lib/classes.js';
import { afterCheckout } from '../../lib/payments.js';
import { discountFor, maxDiscount, priceAfter } from '../../lib/pricing.js';
import Icon from '../../components/Icon.jsx';
import PayMethods from '../../components/PayMethods.jsx';
import { AgreeToPolicies } from '../../components/Policies.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice } from '../../components/ui.jsx';

// A member books a class with a fee (CHANGELOG Part B, B53): POST /api/payments/class-checkout holds a place with a
// pending invoice while the member pays — online through MoMo (B54, 15 minutes), or before that a bank transfer that
// reception confirms (30 minutes). The API works out the amount (the class fee less the discount of the member's card);
// this page shows the same figure beforehand. Only a class that has not started takes bookings. A free class is
// booked straight from its page.
export default function ClassCheckout() {
  const { id } = useParams();
  const { user } = useAuth();
  const member = isMember(user);
  const navigate = useNavigate();
  const location = useLocation();
  const opts = usePaymentOptions();
  const cls = useApi(() => api.classes.get(id), [id]);
  const sessions = useApi(() => api.schedules.byClass(id), [id]);
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const cards = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const me = useApi(() => api.members.me.get(), [user?.accountId], { skip: !member });
  const mine = useApi(() => api.bookings.mine(), [user?.accountId], { skip: !member });

  const [picked, setPicked] = useState(null); // null = the first method the API takes
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
  const started = c ? classStarted(c, sessions.data) : false;
  const priced = typeof c?.price === 'number' && c.price > 0;
  const open = c && c.status === 1 && !started && upcoming.length > 0 && !full;
  if (!c || !priced || !open) {
    return (
      <div className="container page">
        <ErrorNotice error={cls.error?.status === 404 ? null : cls.error} onRetry={cls.reload} />
        <EmptyState
          title={
            !c
              ? 'Không tìm thấy lớp học này'
              : !priced
                ? 'Lớp này không cần thanh toán trước'
                : started && c.status !== 3 && c.status !== 4
                  ? 'Lớp này đã bắt đầu'
                  : 'Lớp này không nhận đặt thêm'
          }
          action={<Button to={c ? `/classes/${c.id}` : '/classes'}>{c ? 'Về trang lớp' : 'Xem các lớp học'}</Button>}
        >
          {!c
            ? 'Có thể lớp đã bị xóa hoặc đường dẫn không đúng.'
            : !priced
              ? 'Bạn đặt lớp này ngay trên trang lớp.'
              : started && c.status !== 3 && c.status !== 4
                ? 'Chỉ nhận đặt các lớp chưa khai giảng. Hãy chọn một lớp sắp khai giảng cùng môn.'
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
  const method = picked ?? opts?.methods[0];
  const hold = opts?.holdMinutes ?? 30;

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
      const res = await api.payments.classCheckout({
        classId: c.id,
        paymentMethod: method,
        returnUrl: `${window.location.origin}/payment/result`,
      });
      // Nothing to pay after all (the API books it at once)
      if (afterCheckout(res, method, navigate) === null) navigate('/account?tab=bookings');
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
          {opts?.online
            ? `Học phí trả một lần cho cả khóa, thanh toán trực tuyến qua MoMo. Chỗ của bạn được giữ ${hold} phút; MoMo báo đã nhận tiền là bạn có chỗ trong lớp.`
            : `Học phí trả một lần cho cả khóa, bằng chuyển khoản. Chỗ của bạn được giữ ${hold} phút để lễ tân đối soát; lễ tân xác nhận xong là bạn có chỗ trong lớp.`}
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
              tone={already.status === 4 ? 'warning' : 'info'}
              title={already.status === 4 ? 'Bạn đang có một đơn chờ thanh toán cho lớp này' : 'Bạn đã đặt lớp này'}
              action={
                already.status === 4 && already.invoiceId ? (
                  <Button size="sm" to={`/payment/result?paymentId=${already.invoiceId}`}>
                    {opts?.online ? 'Tiếp tục thanh toán' : 'Xem đơn'}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" to="/account?tab=bookings">Lớp đã đặt</Button>
                )
              }
            >
              {already.status === 4
                ? 'Chỗ của bạn đang được giữ trong lúc chờ thanh toán. Mỗi học viên đặt một lớp một lần, nên không tạo thêm đơn mới.'
                : 'Mỗi học viên đặt một lớp một lần.'}
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
                    <dt>Buổi đầu tiên</dt>
                    <dd className="num">
                      {formatWeekday(next.date)} {formatDate(next.date)} · {formatTimeRange(next.startTime, next.endTime)}
                    </dd>
                  </div>
                  <div><dt>Số buổi</dt><dd className="num">{upcoming.length}</dd></div>
                </dl>
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
              <Button type="submit" form="class-checkout-form" size="lg" block disabled={paying || !opts}>
                {paying ? 'Đang tạo giao dịch…' : `Đặt lớp và thanh toán ${formatMoney(total)}`}
              </Button>
              <p className="checkout__safe muted">
                <Icon name="check" size={16} strokeWidth={2} />{' '}
                {opts?.online
                  ? `Bước này chưa trừ tiền: bạn quét mã QR hoặc nhập thẻ ở bước sau; quá ${hold} phút chưa thanh toán thì lượt đặt tự hủy và chỗ được trả lại.`
                  : `Bước này chưa trừ tiền: bạn chuyển khoản ở bước sau; quá ${hold} phút lễ tân chưa xác nhận thì lượt đặt tự hủy và chỗ được trả lại.`}
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
