import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import { apiUrl } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { PaymentMethod, PaymentStatus } from '../../lib/enums.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';
import { timeLeft } from '../../lib/payments.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice, StatusTag } from '../../components/ui.jsx';

// SePay returns a VietQR image URL. Only the API decides whether money was received.
export default function PaymentResult() {
  const [params] = useSearchParams();
  const id = params.get('paymentId');
  return id ? <PaymentView key={id} paymentId={id} /> : (
    <div className="container page narrow">
      <EmptyState title="Không có thông tin giao dịch" action={<Button to="/memberships">Xem các gói tập</Button>}>
        Trang này hiện kết quả sau khi bạn thanh toán một gói tập hoặc một lớp học.
      </EmptyState>
    </div>
  );
}

function PaymentView({ paymentId }) {
  const toast = useToast();
  const payment = useApi(() => api.payments.get(paymentId), [paymentId]);
  const [fresh, setFresh] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [cancelling, setCancelling] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [qrFailed, setQrFailed] = useState(false);
  const p = fresh ?? payment.data;
  const status = p?.status;
  const expiresAt = p?.expiresAt;
  const refundPending = !!p?.refundPending;
  const sepay = p?.provider === 'SePay';
  const check = useCallback(async () => {
    try {
      const answer = await api.payments.get(paymentId);
      if (answer) setFresh(answer);
      setCheckError(null);
    } catch (error) {
      setCheckError(error);
    }
  }, [paymentId]);

  useEffect(() => {
    if (status !== 1 && !refundPending) return undefined;
    const stopAt = refundPending ? Date.now() + 600000 : expiresAt ? Date.parse(expiresAt) + 120000 : Date.now() + 2400000;
    const timer = setInterval(() => {
      if (Date.now() > stopAt) clearInterval(timer);
      else check();
    }, sepay && !refundPending ? 3000 : 15000);
    return () => clearInterval(timer);
  }, [status, expiresAt, refundPending, sepay, check]);

  useEffect(() => {
    if (status !== 1 || !expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status, expiresAt]);

  const seen = useRef();
  useEffect(() => {
    if (seen.current === 1 && status === 2) toast.success('Thanh toán thành công. Bạn có thể xem hóa đơn trong tài khoản.');
    if (status !== undefined) seen.current = status;
  }, [status, toast]);

  if (payment.loading) return <div className="container page narrow"><Loading label="Đang kiểm tra giao dịch" /></div>;
  if (!p) return (
    <div className="container page narrow">
      {isMissingRoute(payment.error)
        ? <Notice tone="info" title="Máy chủ chưa có API thanh toán">Chưa kiểm tra được giao dịch này.</Notice>
        : <ErrorNotice error={payment.error} onRetry={payment.reload} />}
    </div>
  );

  const cancel = async () => {
    if (!window.confirm('Hủy đơn này? Chỉ hủy khi bạn chưa chuyển khoản. Nếu đã chuyển tiền, hãy chờ xác nhận hoặc liên hệ lễ tân.')) return;
    setCancelling(true);
    try {
      await api.payments.cancel(paymentId);
      setFresh(await api.payments.get(paymentId));
      toast.success('Đã hủy đơn. Chỗ giữ trong lớp (nếu có) được trả lại.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCancelling(false);
    }
  };
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success('Đã sao chép.');
    } catch {
      toast.info('Hãy chọn và sao chép thông tin chuyển khoản đang hiển thị.');
    }
  };
  const kind = p.kind === 'Upgrade' ? 'upgrade' : p.kind === 'Class' || p.className ? 'class' : 'package';
  const left = status === 1 && expiresAt ? timeLeft(expiresAt, now) : null;
  const overdue = status === 1 && !!expiresAt && !left;
  const waiting = status === 1 && !overdue;
  const what = kind === 'class' ? 'lớp ' + p.className : p.packageName || 'gói tập';
  const retryTo = kind === 'class'
    ? p.classId ? '/classes/' + p.classId + '/checkout' : '/classes'
    : kind === 'upgrade' ? '/memberships/upgrade'
    : p.packageId ? '/memberships/' + p.packageId + '/checkout' : '/memberships';
  const title = refundPending ? 'Đang chờ hoàn tiền'
    : status === 2 ? 'Thanh toán thành công'
    : waiting ? sepay ? 'Chuyển khoản qua SePay' : 'Đang chờ thanh toán'
    : overdue ? 'Đã hết thời gian giữ đơn'
    : status === 3 ? 'Thanh toán chưa thành công'
    : status === 5 ? 'Đơn đã hết hạn'
    : status === 6 ? 'Đã hoàn tiền' : 'Đơn đã bị hủy';
  const text = refundPending
    ? 'Lượt đặt đã hủy và đang chờ lễ tân hoàn tiền bằng chuyển khoản hoặc tiền mặt. SePay không tự chuyển khoản hoàn tiền; hóa đơn đổi trạng thái sau khi lễ tân xác nhận đã trả.'
    : status === 2
      ? kind === 'class' ? 'Bạn đã có chỗ trong ' + what + '. Các buổi học nằm ở Tài khoản của tôi → Lịch tập.'
      : kind === 'upgrade' ? 'Thẻ đã chuyển sang ' + what + ' và có hiệu lực từ hôm nay.'
      : what + ' đã được kích hoạt. Hóa đơn nằm trong tài khoản của bạn.'
    : waiting
      ? sepay ? 'Mở ứng dụng ngân hàng để quét mã VietQR, chuyển đúng số tiền và giữ nguyên nội dung bên dưới. Trang tự cập nhật khi SePay xác nhận tiền vào.'
      : 'Chuyển khoản và ghi đúng mã giao dịch. Bạn có thể kiểm tra lại trạng thái tại trang này.'
    : overdue || status === 5
      ? 'Đã hết thời gian thanh toán. Nếu bạn đã chuyển tiền, hãy liên hệ lễ tân kèm mã giao dịch; nếu chưa, hãy tạo đơn mới và dùng mã QR của đơn mới.'
    : status === 6
      ? 'Lễ tân đã xác nhận hoàn ' + formatMoney(p.refundAmount ?? p.amount) + '. Mã xác nhận được ghi bên dưới.'
    : status === 3 ? p.message || 'Giao dịch chưa hoàn tất. Hãy kiểm tra trạng thái trước khi đặt lại.'
    : 'Đơn đã được hủy. Nếu đã chuyển tiền, hãy liên hệ lễ tân để đối chiếu giao dịch.';

  return (
    <div className="container page narrow pay-result">
      <p className="label">Kết quả thanh toán</p>
      <h1 className="pay-result__title">{title}</h1>
      <p className="muted">{text}</p>
      <ErrorNotice error={checkError} onRetry={check} />
      {waiting && sepay && (
        <div className="pay-qr">
          {p.qrCodeUrl && !qrFailed ? (
            <img className="qr-code" src={apiUrl(p.qrCodeUrl)} width={232} height={232}
              alt="Mã QR chuyển khoản SePay" onError={() => setQrFailed(true)} />
          ) : (
            <Notice tone="warning" title="Chưa tải được mã QR">
              Chuyển khoản theo thông tin bên cạnh hoặc <button className="text-link" onClick={() => setQrFailed(false)}>thử tải lại mã</button>.
            </Notice>
          )}
          <div className="pay-qr__side">
            {left && <p className="pay-qr__timer">Còn <span className="num">{left}</span> để thanh toán</p>}
            <p className="pay-qr__amount num">{formatMoney(p.amount)}</p>
            <dl className="checkout__lines">
              <div><dt>Mã ngân hàng</dt><dd className="num">{p.bankBin || '—'}</dd></div>
              <div><dt>Số tài khoản</dt><dd className="num">{p.bankAccountNumber || '—'}</dd></div>
              <div><dt>Nội dung chuyển khoản</dt><dd className="num payment-reference">{p.paymentReference || '—'}</dd></div>
            </dl>
            <div className="pay-qr__actions">
              {p.bankAccountNumber && <Button variant="secondary" size="sm" onClick={() => copy(p.bankAccountNumber)}>Sao chép số tài khoản</Button>}
              {p.paymentReference && <Button variant="secondary" size="sm" onClick={() => copy(p.paymentReference)}>Sao chép nội dung</Button>}
              <Button variant="secondary" size="sm" onClick={() => copy(p.amount)}>Sao chép số tiền</Button>
              <Button variant="ghost" onClick={cancel} disabled={cancelling}>{cancelling ? 'Đang hủy…' : 'Hủy đơn'}</Button>
            </div>
            <p className="muted small">Giữ nguyên nội dung chuyển khoản để hệ thống nhận đúng đơn. Không chuyển tiền vào mã QR của đơn đã hủy hoặc hết hạn.</p>
          </div>
        </div>
      )}
      <dl className="checkout__lines">
        <div><dt>{kind === 'class' ? 'Lớp học' : kind === 'upgrade' ? 'Nâng cấp' : 'Gói tập'}</dt>
          <dd>{kind === 'upgrade' && p.fromPackageName ? p.fromPackageName + ' → ' : ''}{kind === 'class' ? p.className : p.packageName || '—'}</dd></div>
        {kind === 'class' && Number(p.discountPercent) > 0 && <>
          <div><dt>Học phí gốc</dt><dd className="num">{formatMoney(p.originalAmount)}</dd></div>
          <div><dt>Giảm theo thẻ</dt><dd className="num">{p.discountPercent}%</dd></div>
        </>}
        {kind === 'upgrade' && <>
          <div><dt>Giá gói mới</dt><dd className="num">{formatMoney(p.originalAmount)}</dd></div>
          <div><dt>Trừ giá trị thẻ cũ</dt><dd className="num">−{formatMoney(p.creditAmount ?? 0)}</dd></div>
        </>}
        <div><dt>Số tiền</dt><dd className="num">{formatMoney(p.amount)}</dd></div>
        {p.paymentMethod != null && <div><dt>Cách thanh toán</dt><dd>{sepay ? 'Chuyển khoản ngân hàng qua SePay' : PaymentMethod.label(p.paymentMethod)}</dd></div>}
        <div><dt>Trạng thái</dt><dd><StatusTag tone={refundPending ? 'warning' : PaymentStatus.tone(status)}>{refundPending ? 'Chờ hoàn tiền' : PaymentStatus.label(status)}</StatusTag></dd></div>
        {p.paidAt && <div><dt>Thời điểm thanh toán</dt><dd className="num">{formatDateTime(p.paidAt)}</dd></div>}
        <div><dt>Mã giao dịch</dt><dd className="num payment-reference">{p.paymentId ?? paymentId}</dd></div>
        {p.refundReference && <div><dt>Mã xác nhận hoàn tiền</dt><dd className="payment-reference">{p.refundReference}</dd></div>}
      </dl>
      <div className="pay-result__actions">
        {status === 2 && !refundPending ? <>
          <Button to={kind === 'class' ? '/account?tab=schedule' : '/account?tab=membership'}>{kind === 'class' ? 'Xem lịch tập' : 'Xem thẻ thành viên'}</Button>
          <Button variant="secondary" to="/account?tab=invoices">Xem hóa đơn</Button>
        </> : refundPending || status === 6 ? <><Button to="/account?tab=invoices">Xem hóa đơn</Button>{refundPending && <Button variant="secondary" onClick={check}>Kiểm tra lại</Button>}</>
          : waiting || overdue ? <Button variant="secondary" icon="refresh" onClick={check}>Kiểm tra lại</Button>
          : <Button to={retryTo}>{kind === 'class' ? 'Đặt lại lớp' : kind === 'upgrade' ? 'Nâng cấp lại' : 'Chọn lại gói tập'}</Button>}
      </div>
    </div>
  );
}
