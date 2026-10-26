import { useSearchParams } from 'react-router-dom';
import { api, isMissingRoute } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { PaymentStatus } from '../../lib/enums.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';
import { Button, EmptyState, ErrorNotice, Loading, Notice, StatusTag } from '../../components/ui.jsx';

// Shown after checkout (?paymentId=…). The API has no payment gateway yet: reception or a manager confirms
// the money within 30 minutes, after that the API cancels the order (status 4). The page always asks the
// API for the payment's real state; a gateway's query string, once there is one, is not trusted.
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
        {paid ? 'Thanh toán thành công' : pending ? 'Đang chờ xác nhận thanh toán' : 'Đơn đã hết hạn hoặc bị hủy'}
      </h1>
      <p className="muted">
        {paid
          ? `${p.packageName ?? 'Thẻ'} đã được kích hoạt và hóa đơn đã được xuất.`
          : pending
            ? 'Đơn được giữ 30 phút. Hãy thanh toán với lễ tân (chuyển khoản hoặc quẹt thẻ) và đọc mã giao dịch bên dưới; lễ tân xác nhận xong thì thẻ được kích hoạt ngay. Quá 30 phút chưa xác nhận thì đơn tự hủy. Bấm Tải lại để xem trạng thái mới.'
            : 'Đơn quá 30 phút chưa được xác nhận hoặc đã bị hủy, nên thẻ chưa được kích hoạt. Nếu bạn đã chuyển tiền, hãy báo lễ tân kèm mã giao dịch bên dưới.'}
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
