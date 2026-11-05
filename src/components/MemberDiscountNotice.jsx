import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import { Button, Notice } from './ui.jsx';
import '../styles/class-price.css';

export default function MemberDiscountNotice({ pricing }) {
  if (!pricing?.member) return null;
  if (pricing.loading) return <p className="member-discount-status" role="status">Đang kiểm tra ưu đãi thẻ của bạn…</p>;
  if (pricing.error) return (
    <Notice tone="warning" title="Chưa kiểm tra được ưu đãi thành viên" action={<Button size="sm" variant="secondary" onClick={pricing.reload}>Thử lại ưu đãi</Button>}>
      Giá đang hiển thị là học phí gốc. Hãy tải lại ưu đãi; số tiền chính xác sẽ được máy chủ xác nhận khi tạo đơn.
    </Notice>
  );
  const { deal, nextDeal } = pricing;
  if (!deal.percent && !nextDeal) return null;
  return (
    <div className="member-discount-notice" role="status">
      {deal.percent > 0 && <p><strong>{deal.pkg.packageName}: giảm {deal.percent}% học phí.</strong> Giá bên dưới đã áp dụng thẻ còn hiệu lực hôm nay.</p>}
      {nextDeal && <p>Ưu đãi {nextDeal.percent}% của <strong>{nextDeal.pkg.packageName}</strong> bắt đầu từ <strong>{formatDate(nextDeal.card.startDate)}</strong>; chưa áp dụng trước ngày này.</p>}
      <p className="member-discount-notice__note">Ưu đãi được kiểm tra lại lúc tạo đơn. <Link className="text-link" to="/account?tab=membership">Xem thẻ thành viên</Link></p>
    </div>
  );
}
