import { useSearchParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { PaymentStatus } from '../../lib/enums.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';
import { Button, EmptyState, ErrorNotice, Loading, Notice, StatusTag } from '../../components/ui.jsx';

// Where the payment gateway sends the member back (the returnUrl given to POST /api/payments/checkout,
// with ?paymentId=…). The page asks the API for the payment's real state instead of trusting the
// gateway's query string. The payment API is not built yet (CHANGELOG Part B, B38).
export default function PaymentResult() {
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId');
  const payment = useApi(() => api.payments.get(paymentId), [paymentId], { skip: !paymentId });

  if (!paymentId) {
    return (
      <div className="container page narrow">
        <EmptyState title="Không có thông tin giao dịch" action={<Button to="/memberships">Xem các gói tập</Button>}>
          Trang này hiện kết quả sau khi bạn thanh toán một gói tập.
        </EmptyState>
      </div>
    );
  }
  if (payment.loading) {
    return (
      <div className="container page narrow">
        <Loading label="Đang kiểm tra giao dịch" />
      </div>
    );
  }
  if (!payment.data) {
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

  const p = payment.data;
  const paid = p.status === 2;
  const pending = p.status === 1;
  return (
    <div className="container page narrow pay-result">
      <p className="label">Kết quả thanh toán</p>
      <h1 className="pay-result__title">
        {paid ? 'Thanh toán thành công' : pending ? 'Đang chờ xác nhận thanh toán' : 'Thanh toán chưa thành công'}
      </h1>
      <p className="muted">
        {paid
          ? `Thẻ ${p.packageName ?? ''} đã được kích hoạt và hóa đơn đã được xuất.`
          : pending
            ? 'Ngân hàng chưa báo kết quả. Trang sẽ cập nhật khi bạn tải lại.'
            : 'Bạn chưa bị trừ tiền. Hãy thử lại hoặc chọn cách thanh toán khác.'}
      </p>
      <dl className="checkout__lines">
        <div><dt>Gói tập</dt><dd>{p.packageName ?? '—'}</dd></div>
        <div><dt>Số tiền</dt><dd className="num">{formatMoney(p.amount)}</dd></div>
        <div><dt>Trạng thái</dt><dd><StatusTag tone={PaymentStatus.tone(p.status)}>{PaymentStatus.label(p.status)}</StatusTag></dd></div>
        {p.paidAt && <div><dt>Thời điểm</dt><dd className="num">{formatDateTime(p.paidAt)}</dd></div>}
        <div><dt>Mã giao dịch</dt><dd className="num">{p.paymentId ?? paymentId}</dd></div>
      </dl>
      <div className="pay-result__actions">
        {paid ? (
          <>
            <Button to="/account?tab=membership">Xem thẻ thành viên</Button>
            <Button variant="secondary" to="/account?tab=invoices">Xem hóa đơn</Button>
          </>
        ) : pending ? (
          <Button icon="refresh" onClick={payment.reload}>Tải lại</Button>
        ) : (
          <Button to="/memberships">Chọn lại gói tập</Button>
        )}
      </div>
    </div>
  );
}
