import { Link } from 'react-router-dom';
import '../styles/refund-guide.css';

export default function RefundGuide({ staff = false }) {
  return (
    <details className="refund-guide">
      <summary>{staff ? 'Quy trình xử lý và xác nhận hoàn tiền' : 'Hủy lớp và nhận lại học phí như thế nào?'}</summary>
      <p>Lớp đã thanh toán được hoàn đủ học phí đã trả khi hủy trước lúc lớp bắt đầu. Sau khi lớp bắt đầu, hủy không được hoàn. Đơn chưa thanh toán không có tiền để hoàn.</p>
      <ol>
        <li>{staff ? 'Member hủy lượt đặt đủ điều kiện, hoặc lễ tân hủy hộ tại Đặt lớp.' : <>Mở <Link className="text-link" to="/account?tab=bookings">Lớp đã đặt</Link>, chọn Hủy và đọc điều kiện trước khi xác nhận.</>}</li>
        <li>{staff ? 'Vào Hóa đơn, chọn bộ lọc Hoàn tiền → Chờ hoàn tiền, đối chiếu người nhận và số tiền đã trả.' : <>Vào <Link className="text-link" to="/account?tab=invoices">Hóa đơn</Link> để theo dõi trạng thái Chờ hoàn tiền. Liên hệ lễ tân để thống nhất nhận chuyển khoản hoặc tiền mặt.</>}</li>
        <li>{staff ? 'Thực hiện trả tiền thật bằng chuyển khoản ngân hàng hoặc tiền mặt cho member và giữ chứng từ.' : 'Lễ tân trả tiền bằng phương thức đã thống nhất. SePay không tự động chuyển tiền hoàn.'}</li>
        <li>{staff ? 'Chỉ sau khi đã trả tiền, bấm Xác nhận đã hoàn tiền, nhập mã giao dịch/số phiếu và xác nhận. Hóa đơn mới chuyển Đã hoàn tiền, báo cáo cập nhật khoản hoàn.' : 'Sau khi lễ tân ghi xác nhận, trạng thái chuyển Đã hoàn tiền; bạn có thể mở chi tiết giao dịch để đối chiếu.'}</li>
      </ol>
      <p className="muted small">Hủy lượt đặt và hoàn tiền là hai bước riêng. Không xác nhận đã hoàn chỉ để đổi trạng thái khi chưa thực sự trả tiền.</p>
    </details>
  );
}
