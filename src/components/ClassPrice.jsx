import { formatMoney } from '../lib/format.js';
import { priceAfter } from '../lib/pricing.js';
import '../styles/class-price.css';

// A preview only; checkout never supplies this amount to the server.
export default function ClassPrice({ price, pricing, className = '' }) {
  const known = typeof price === 'number' && Number.isFinite(price) && price >= 0;
  const percent = pricing?.deal?.percent ?? 0;
  const discounted = known && price > 0 && percent > 0 && !pricing?.loading && !pricing?.error;
  return (
    <div className={`class-price ${discounted ? 'class-price--discounted' : ''} ${className}`}>
      {discounted && <del className="class-price__original num"><span className="visually-hidden">Giá gốc: </span>{formatMoney(price)}</del>}
      <strong className="class-price__amount num">{discounted && <span className="visually-hidden">Giá sau ưu đãi: </span>}{!known ? 'Xem chi tiết' : price === 0 ? 'Miễn phí' : formatMoney(priceAfter(price, discounted ? percent : 0))}</strong>
      {discounted && <span className="class-price__saving">Giảm {percent}% theo thẻ</span>}
      {known && price > 0 && pricing?.loading && <span className="class-price__hint">Đang kiểm tra ưu đãi…</span>}
      {known && price > 0 && pricing?.error && <span className="class-price__hint">Chưa kiểm tra được ưu đãi</span>}
    </div>
  );
}
