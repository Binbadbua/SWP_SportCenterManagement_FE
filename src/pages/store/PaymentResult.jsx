import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import { apiUrl } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { PaymentMethod, PaymentStatus } from '../../lib/enums.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';
import { timeLeft } from '../../lib/payments.js';
import QrCode from '../../components/QrCode.jsx';
import { useToast } from '../../components/Toast.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice, StatusTag } from '../../components/ui.jsx';

// Shown after checkout (?paymentId=…) for a package, a class with a fee (kind "Class", CHANGELOG Part B, B53) or an
// upgrade (kind "Upgrade", B54). With MoMo the member scans the order's QR code here (or pays on MoMo's page, which
// sends them back here); the page asks the API every few seconds until MoMo's notice (IPN) has reached it. Before
// MoMo, reception confirm a bank transfer within 30 minutes. The page always trusts the API's state of the order, never
// the query string MoMo adds on its way back (resultCode, message), which only explains a failure sooner.
const POLL_MS = 3000;
const POLL_DESK_MS = 15000;
// MoMo's notice of a payment made in the last seconds can arrive a little after the hold time
const LATE_MS = 2 * 60 * 1000;

export default function PaymentResult() {
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId');
  if (!paymentId) {
    return (
      <div className="container page narrow">
        <EmptyState title="Không có thông tin giao dịch" action={<Button to="/memberships">Xem các gói tập</Button>}>
          Trang này hiện kết quả sau khi bạn thanh toán một gói tập hoặc một lớp học.
        </EmptyState>
      </div>
    );
  }
  return <PaymentView key={paymentId} paymentId={paymentId} momoCode={params.get('resultCode')} momoMessage={params.get('message')} />;
}

function PaymentView({ paymentId, momoCode, momoMessage }) {
  const toast = useToast();
  const payment = useApi(() => api.payments.get(paymentId), [paymentId]);
  const [fresh, setFresh] = useState(null); // the order as the last quiet check saw it
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const p = fresh ?? payment.data;
  const status = p?.status;
  const momo = !!p && (p.provider === 'MoMo' || p.paymentMethod === 4 || p.paymentMethod === 5 || !!(p.qrCodeUrl || p.payUrl));
  const expiresAt = p?.expiresAt;

  const check = async () => {
    try {
      const answer = await api.payments.get(paymentId);
      if (answer) setFresh(answer);
    } catch {
      /* keep what the page shows; the next check asks again */
    }
  };

  // Follow an order that waits: often for MoMo, now and then for reception
  useEffect(() => {
    if (status !== 1) return undefined;
    const stopAt = expiresAt ? Date.parse(expiresAt) + LATE_MS : Date.now() + 40 * 60 * 1000;
    const timer = setInterval(() => {
      if (Date.now() > stopAt) clearInterval(timer);
      else check();
    }, momo ? POLL_MS : POLL_DESK_MS);
    return () => clearInterval(timer);
    // check() only reads paymentId, which never changes for this view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, expiresAt, momo]);

  // The countdown of the hold time
  useEffect(() => {
    if (status !== 1 || !expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status, expiresAt]);

  // The success message when the payment goes through while the member is on the page
  const seen = useRef();
  useEffect(() => {
    if (seen.current === 1 && status === 2) toast.success('Thanh toán thành công. Hóa đơn đã nằm ở Tài khoản của tôi → Hóa đơn.');
    if (status !== undefined) seen.current = status;
  }, [status, toast]);

  if (payment.loading) {
    return (
      <div className="container page narrow">
        <Loading label="Đang kiểm tra giao dịch" />
      </div>
    );
  }
  if (!p) {
    return (
      <div className="container page narrow">
        {isMissingRoute(payment.error) ? (
          <Notice tone="info" title="Máy chủ chưa có API thanh toán">
            Chưa kiểm tra được giao dịch vì máy chủ chưa có chức năng thanh toán trực tuyến.
          </Notice>
        ) : (
          <ErrorNotice error={payment.error} onRetry={payment.reload} />
        )}
      </div>
    );
  }

  const cancel = async () => {
    if (!window.confirm('Hủy đơn này? Chưa có khoản tiền nào bị trừ; chỗ giữ trong lớp (nếu có) được trả lại.')) return;
    setCancelling(true);
    try {
      setFresh(await api.payments.cancel(paymentId).then(() => api.payments.get(paymentId)));
      toast.success('Đã hủy đơn. Bạn có thể đặt lại bất cứ lúc nào.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCancelling(false);
    }
  };

  const kind = p.kind === 'Upgrade' ? 'upgrade' : p.kind === 'Class' || p.className ? 'class' : 'package';
  const left = status === 1 && expiresAt ? timeLeft(expiresAt, now) : null;
  const overdue = status === 1 && !!expiresAt && !left;
  const waiting = status === 1 && !overdue;
  const declined = momoCode && momoCode !== '0' && status === 1;
  const discounted = kind === 'class' && Number(p.discountPercent ?? 0) > 0 && p.originalAmount != null;
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const retryTo = kind === 'class'
    ? p.classId ? `/classes/${p.classId}/checkout` : '/classes'
    : kind === 'upgrade'
      ? '/memberships/upgrade'
      : p.packageId ?? p.membershipPackageId ? `/memberships/${p.packageId ?? p.membershipPackageId}/checkout` : '/memberships';
  const what = kind === 'class' ? `lớp ${p.className}` : kind === 'upgrade' ? `gói ${p.packageName}` : (p.packageName ?? 'gói tập');

  const title =
    status === 2 ? 'Thanh toán thành công'
    : waiting ? (momo ? 'Quét mã để thanh toán' : 'Đang chờ xác nhận thanh toán')
    : overdue ? 'Đơn đã hết thời gian giữ'
    : status === 3 ? 'Thanh toán chưa thành công'
    : status === 5 ? 'Đơn đã hết hạn'
    : status === 6 ? 'Đã hoàn tiền'
    : momo ? 'Đơn đã bị hủy' : 'Đơn đã hết hạn hoặc bị hủy';

  const text =
    status === 2
      ? kind === 'class'
        ? `Bạn đã có chỗ trong lớp ${p.className}. Các buổi học nằm ở Tài khoản của tôi → Lịch tập.`
        : kind === 'upgrade'
          ? `Thẻ của bạn đã chuyển sang ${p.packageName} và có hiệu lực từ hôm nay. Hóa đơn đã được xuất.`
          : `${p.packageName ?? 'Thẻ'} đã được kích hoạt và hóa đơn đã được xuất.`
      : waiting
        ? momo
          ? p.qrCodeUrl
            ? `Mở ứng dụng MoMo, chọn Quét mã và quét mã bên dưới để trả ${formatMoney(p.amount)} cho ${what}. Trang này tự cập nhật khi MoMo báo đã nhận tiền.`
            : `Hoàn tất thanh toán ${formatMoney(p.amount)} cho ${what} trên trang của MoMo. Trang này tự cập nhật khi MoMo báo đã nhận tiền.`
          : `Chuyển khoản ${formatMoney(p.amount)} và ghi mã giao dịch bên dưới trong nội dung chuyển khoản; lễ tân đối soát xong là ${kind === 'class' ? 'đặt lớp xong' : 'thẻ được kích hoạt'}. Quá 30 phút chưa xác nhận thì đơn tự hủy${kind === 'class' ? ' và chỗ được trả lại' : ''}. Trang tự cập nhật trạng thái.`
        : overdue
          ? 'Nếu bạn vừa thanh toán xong, trang sẽ cập nhật trong giây lát. Nếu chưa, đơn tự hủy và chưa có khoản tiền nào bị trừ; bạn có thể đặt lại.'
          : status === 3
            ? `MoMo báo giao dịch không thành công${p.message ? ` (${p.message})` : ''}. Chưa có khoản tiền nào bị trừ${kind === 'class' ? ' và chỗ trong lớp đã được trả lại' : ''}. Bạn có thể đặt lại.`
            : status === 6
              ? `Lượt đặt ${what} đã hủy và ${formatMoney(p.refundAmount ?? p.amount)} được hoàn về nơi bạn đã trả (ví hoặc thẻ qua MoMo).`
              : momo
                ? `Đơn đã ${status === 5 ? 'quá thời gian giữ' : 'được hủy'} nên chưa có khoản tiền nào bị trừ${kind === 'class' ? ' và chỗ trong lớp đã được trả lại' : ''}. Bạn có thể đặt lại.`
                : `Đơn quá 30 phút chưa được xác nhận hoặc đã bị hủy${kind === 'class' ? ', nên chỗ trong lớp đã được trả lại' : ', nên thẻ chưa được kích hoạt'}. Nếu bạn đã chuyển tiền, hãy báo lễ tân kèm mã giao dịch bên dưới.`;

  return (
    <div className="container page narrow pay-result">
      <p className="label">Kết quả thanh toán</p>
      <h1 className="pay-result__title">{title}</h1>
      <p className="muted">{text}</p>
      {declined && (
        <Notice tone="warning" title="MoMo chưa nhận được tiền">
          {momoMessage || 'Giao dịch trên MoMo chưa hoàn tất.'} Đơn vẫn đang được giữ: bạn có thể thanh toán lại hoặc hủy đơn.
        </Notice>
      )}

      {waiting && momo && (
        <div className="pay-qr">
          {p.qrCodeUrl && <QrCode value={p.qrCodeUrl} label={`Mã QR MoMo để trả ${formatMoney(p.amount)}`} />}
          <div className="pay-qr__side">
            {left && (
              <p className="pay-qr__timer" aria-live="off">
                Còn <span className="num">{left}</span> để thanh toán
              </p>
            )}
            <p className="pay-qr__amount num">{formatMoney(p.amount)}</p>
            <div className="pay-qr__actions">
              {touch && p.deeplink && <Button href={p.deeplink}>Mở ứng dụng MoMo</Button>}
              {p.payUrl && (
                <Button variant={p.qrCodeUrl ? 'secondary' : 'primary'} href={apiUrl(p.payUrl)}>
                  {p.qrCodeUrl ? 'Thanh toán trên trang MoMo' : 'Mở trang thanh toán MoMo'}
                </Button>
              )}
              <Button variant="ghost" onClick={cancel} disabled={cancelling}>
                {cancelling ? 'Đang hủy…' : 'Hủy đơn'}
              </Button>
            </div>
            <p className="muted small">Đóng trang này cũng không sao: kết quả thanh toán luôn có ở Tài khoản của tôi.</p>
          </div>
        </div>
      )}

      <dl className="checkout__lines">
        {kind === 'class' ? (
          <div><dt>Lớp học</dt><dd>{p.className}</dd></div>
        ) : kind === 'upgrade' ? (
          <div><dt>Nâng cấp</dt><dd>{p.fromPackageName ? `${p.fromPackageName} → ` : ''}{p.packageName}</dd></div>
        ) : (
          <div><dt>Gói tập</dt><dd>{p.packageName ?? '—'}</dd></div>
        )}
        {discounted && (
          <>
            <div><dt>Học phí gốc</dt><dd className="num">{formatMoney(p.originalAmount)}</dd></div>
            <div><dt>Giảm theo thẻ</dt><dd className="num">{p.discountPercent}%</dd></div>
          </>
        )}
        {kind === 'upgrade' && p.originalAmount != null && (
          <>
            <div><dt>Giá gói mới</dt><dd className="num">{formatMoney(p.originalAmount)}</dd></div>
            <div><dt>Trừ phần còn lại của thẻ cũ</dt><dd className="num">−{formatMoney(p.creditAmount ?? 0)}</dd></div>
          </>
        )}
        <div><dt>Số tiền</dt><dd className="num">{formatMoney(p.amount)}</dd></div>
        {p.paymentMethod != null && <div><dt>Cách thanh toán</dt><dd>{PaymentMethod.label(p.paymentMethod)}</dd></div>}
        <div><dt>Trạng thái</dt><dd><StatusTag tone={PaymentStatus.tone(status)}>{PaymentStatus.label(status)}</StatusTag></dd></div>
        {p.paidAt && <div><dt>Thời điểm</dt><dd className="num">{formatDateTime(p.paidAt)}</dd></div>}
        <div><dt>Mã giao dịch</dt><dd className="num">{p.paymentId ?? paymentId}</dd></div>
        {p.transId && <div><dt>Mã giao dịch MoMo</dt><dd className="num">{p.transId}</dd></div>}
      </dl>
      <div className="pay-result__actions">
        {status === 2 ? (
          <>
            <Button to={kind === 'class' ? '/account?tab=schedule' : '/account?tab=membership'}>
              {kind === 'class' ? 'Xem lịch tập' : 'Xem thẻ thành viên'}
            </Button>
            <Button variant="secondary" to="/account?tab=invoices">Xem hóa đơn</Button>
          </>
        ) : waiting && !momo ? (
          <Button icon="refresh" onClick={check}>Tải lại</Button>
        ) : waiting ? null : status === 6 ? (
          <Button to="/account?tab=bookings">Lớp đã đặt</Button>
        ) : (
          <Button to={retryTo}>{kind === 'class' ? 'Đặt lại lớp' : kind === 'upgrade' ? 'Nâng cấp lại' : 'Chọn lại gói tập'}</Button>
        )}
      </div>
    </div>
  );
}
