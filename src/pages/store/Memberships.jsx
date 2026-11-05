import { useNavigate } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { usePaymentOptions } from '../../hooks/usePricing.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { IMAGES } from '../../lib/images.js';
import { formatDate, formatMoney, todayCenterDateString } from '../../lib/format.js';
import { benefitsOf, hasPackageDiscounts, summaryOf } from '../../lib/pricing.js';
import { cardsOn } from '../../lib/membership.js';
import Icon from '../../components/Icon.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice, SampleDataNotice } from '../../components/ui.jsx';
import '../../styles/membership-redesign.css';

// A membership grants access for its duration; coached classes retain their own booking and fee rules.
const howItWorks = ({ online, fees, known }) => [
  [
    'Chọn gói và thanh toán',
    online === undefined
      ? 'Chọn thời hạn phù hợp và làm theo hướng dẫn trên đơn thanh toán. Thẻ được kích hoạt sau khi khoản thanh toán được xác nhận.'
      : online
        ? 'Thanh toán qua SePay: quét mã VietQR bằng ứng dụng ngân hàng và giữ nguyên nội dung chuyển khoản. Thẻ được kích hoạt khi hệ thống xác nhận đã nhận tiền.'
        : 'Đặt mua trên web rồi chuyển khoản theo hướng dẫn. Lễ tân đối soát xong thì thẻ được kích hoạt và hóa đơn được xuất.',
    'check',
  ],
  ['Vào cửa bằng thẻ', 'Đến trung tâm, lễ tân kiểm tra thẻ và ghi lượt vào. Trong thời hạn thẻ, bạn tự tập không giới hạn ở khu gym, cardio và hồ bơi.', 'user'],
  fees
    ? ['Ưu đãi khi đăng ký lớp', 'Lớp có huấn luyện viên và học phí toàn khóa riêng. Thẻ còn hiệu lực được giảm theo mức của gói; không có thẻ thì trả giá gốc.', 'grid']
    : known
      ? ['Đặt lớp trong thời hạn thẻ', 'Chọn lớp chưa bắt đầu, có buổi học kế tiếp nằm trong thời hạn thẻ. Xem lịch và điều kiện đăng ký tại trang chi tiết lớp.', 'grid']
      : ['Khám phá thêm lớp học', 'Xem học phí, ưu đãi áp dụng và điều kiện đăng ký tại trang chi tiết của từng lớp.', 'grid'],
  ['Gia hạn hoặc nâng cấp', 'Gia hạn để thẻ mới nối tiếp thẻ cũ. Khi nâng cấp lên gói dài hơn, gói mới có hiệu lực ngay và giá được trừ phần còn lại của thẻ cũ.', 'calendar'],
];

function MembershipPlanCard({ pkg, sample, onChoose, bestSeller = false }) {
  const benefits = benefitsOf(pkg);
  const daily = Number.isFinite(pkg.price) && pkg.durationDays > 0 ? Math.round(pkg.price / pkg.durationDays) : null;
  return (
    <article className={`membership-plan ${bestSeller ? 'membership-plan--bestseller' : ''}`}>
      <div className="membership-plan__top">
        <span className="membership-plan__duration"><Icon name="calendar" size={16} />{pkg.durationDays} ngày</span>
        {bestSeller && <span className="membership-plan__stamp">BEST SELLER</span>}
      </div>
      <h3>{pkg.packageName}</h3>
      <p className="membership-plan__description">{summaryOf(pkg) || 'Xem thời hạn và các quyền lợi để chọn gói phù hợp với bạn.'}</p>
      <div className="membership-plan__pricing"><strong>{formatMoney(pkg.price)}</strong><span>/ toàn gói</span></div>
      {daily !== null && <p className="membership-plan__daily">Bình quân {formatMoney(daily)}/ngày</p>}
      <div className="membership-plan__perks">
        {Number(pkg.discountPercent) > 0 && <p className="membership-plan__discount"><Icon name="check" size={17} />Giảm {pkg.discountPercent}% học phí lớp khi đủ điều kiện</p>}
        {benefits.length > 0 ? <ul>{benefits.map(benefit => <li key={benefit}><Icon name="check" size={16} /><span>{benefit}</span></li>)}</ul> : <p className="membership-plan__fallback">Quyền lợi cụ thể được hiển thị tại bước chọn gói.</p>}
      </div>
      <Button className="membership-plan__choose" block disabled={sample} onClick={() => onChoose(pkg.id)} aria-label={`Chọn gói ${pkg.packageName}`}>Chọn gói này<Icon name="arrowRight" size={18} /></Button>
      {sample && <p className="membership-plan__sample">Dữ liệu mẫu — tải lại để chọn gói thật.</p>}
    </article>
  );
}

export default function Memberships() {
  const { user } = useAuth();
  const member = isMember(user);
  const opts = usePaymentOptions();
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const mine = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const navigate = useNavigate();
  const active = (packages.data ?? []).filter(pkg => pkg.status === 1).sort((a, b) => a.durationDays - b.durationDays);
  const monthPlans = active.filter(pkg => Number(pkg.durationDays) === 30);
  const bestSellerId = (monthPlans.find(pkg => /^gói\s*(1|một)\s*tháng$/i.test(String(pkg.packageName ?? '').trim())) ?? monthPlans[0])?.id;
  const today = todayCenterDateString();
  const current = cardsOn(mine.data, today)[0];
  const discounts = hasPackageDiscounts(packages.data);
  const catalogueKnown = !!packages.data && !packages.usingSample && !packages.error;
  const steps = howItWorks({ online: opts?.online, fees: discounts, known: catalogueKnown });
  const choose = id => {
    if (!packages.usingSample) navigate(`/memberships/${id}/checkout`);
  };

  return (
    <div className="membership-page">
      <section className="membership-hero" aria-labelledby="membership-title">
        <div className="container membership-hero__inner">
          <div className="membership-hero__copy">
            <p className="membership-eyebrow">Đầu tư cho một bạn khỏe hơn</p>
            <h1 id="membership-title">Một gói tập.<br /><span>Nhiều động lực.</span></h1>
            <p className="membership-hero__lead">Chọn thẻ thành viên phù hợp với nhịp sống của bạn. Tự tập theo thời hạn gói, tìm hiểu quyền lợi và duy trì thói quen vận động mỗi ngày.</p>
            <div className="membership-hero__actions"><a className="membership-primary-link" href="#membership-plans">Khám phá các gói<Icon name="arrowRight" size={18} /></a><a className="membership-text-link" href="#membership-guide">Thẻ thành viên dùng thế nào?<Icon name="chevronDown" size={17} /></a></div>
            <div className="membership-hero__details"><span><Icon name="check" size={16} />Một thẻ cho mọi môn</span><span><Icon name="calendar" size={16} />Nhiều lựa chọn thời hạn</span></div>
          </div>
          <div className="membership-hero__photo"><img src={IMAGES.memberships} alt="Không gian dụng cụ tập luyện tại trung tâm" fetchPriority="high" decoding="async" /></div>
        </div>
      </section>

      <div className="container membership-content">
        {current && <Notice tone="success" title={`Bạn đang dùng ${current.packageName}`} action={<Button size="sm" variant="secondary" to="/account?tab=membership">Thẻ của tôi</Button>}>Còn hiệu lực đến {formatDate(current.endDate)}. Để chuyển sang gói dài hơn ngay hôm nay, mở Tài khoản của tôi → Thẻ thành viên → Nâng cấp gói.</Notice>}

        <section id="membership-plans" className="membership-section" aria-labelledby="membership-plans-title">
          <div className="membership-section-head"><div><p className="membership-eyebrow">Tìm lựa chọn của bạn</p><h2 id="membership-plans-title">Gói tập phù hợp với bạn</h2></div><p>Xem thời hạn, giá và quyền lợi trước khi chọn. Giá hiển thị cho toàn bộ thời hạn của gói.</p></div>
          {packages.usingSample && <SampleDataNotice onRetry={packages.reload} />}
          {packages.error?.status === 401 ? <EmptyState title="Đăng nhập để xem gói tập và giá" action={<Button to="/login?next=/memberships">Đăng nhập</Button>}>Bạn mới đến? Hãy tạo tài khoản để bắt đầu.</EmptyState> : <ErrorNotice error={!packages.usingSample ? packages.error : null} onRetry={packages.reload} />}
          {packages.loading ? <Loading label="Đang tải các gói thành viên" /> : active.length ? <div className="membership-plans">{active.map(pkg => <MembershipPlanCard key={pkg.id} pkg={pkg} sample={packages.usingSample} onChoose={choose} bestSeller={pkg.id === bestSellerId} />)}</div> : !packages.error && <EmptyState title="Hiện chưa có gói tập nào đang bán">Hãy hỏi lễ tân về các gói tập.</EmptyState>}
          {active.length > 0 && <p className="membership-price-note"><Icon name="bell" size={16} />Thẻ thành viên dành cho quyền lợi của gói. Học phí và điều kiện đặt lớp được hiển thị riêng tại từng lớp học.</p>}
        </section>

        <section id="membership-guide" className="membership-section membership-guide" aria-labelledby="membership-guide-title">
          <div className="membership-section-head"><div><p className="membership-eyebrow">Dễ bắt đầu, dễ duy trì</p><h2 id="membership-guide-title">Từ chọn gói đến buổi tập đầu tiên</h2></div></div>
          <ol className="membership-steps">{steps.map(([title, text, icon], index) => <li className="membership-step" key={title}><div className="membership-step__top"><span>0{index + 1}</span><Icon name={icon} size={21} /></div><h3>{title}</h3><p>{text}</p></li>)}</ol>
        </section>

        <section className="membership-section" aria-labelledby="membership-difference-title">
          <div className="membership-section-head"><div><p className="membership-eyebrow">Hiểu rõ trước khi đăng ký</p><h2 id="membership-difference-title">Thẻ thành viên và lớp học</h2></div><p>Hai lựa chọn bổ sung cho nhau, với quyền lợi và cách đăng ký riêng.</p></div>
          <div className="membership-difference">
            <article><span className="membership-difference__icon"><Icon name="user" size={25} /></span><h3>Thẻ thành viên</h3><p>Quyền vào trung tâm tự tập trong thời hạn thẻ.</p><ul><li><Icon name="check" size={16} />Trả một lần cho toàn bộ thời hạn.</li><li><Icon name="check" size={16} />Tự tập tại gym, cardio và hồ bơi.</li><li><Icon name="check" size={16} />Lễ tân kiểm tra thẻ và ghi lượt vào.</li></ul></article>
            <article><span className="membership-difference__icon"><Icon name="grid" size={25} /></span><h3>Lớp có huấn luyện viên</h3><p>Khóa học có lịch cố định, sĩ số giới hạn và người hướng dẫn.</p><ul><li><Icon name="check" size={16} />{discounts ? 'Học phí riêng cho toàn khóa; thẻ đủ điều kiện được giảm.' : catalogueKnown ? 'Đăng ký theo điều kiện thẻ được hiển thị tại lớp.' : 'Xem học phí và ưu đãi tại trang chi tiết lớp.'}</li><li><Icon name="check" size={16} />Đăng ký trước khi lớp bắt đầu.</li><li><Icon name="check" size={16} />Điểm danh, kế hoạch và đánh giá theo lớp.</li></ul></article>
          </div>
        </section>

        {active.length > 1 && <section id="membership-compare" className="membership-section" aria-labelledby="membership-compare-title"><div className="membership-section-head"><div><p className="membership-eyebrow">Đặt các lựa chọn cạnh nhau</p><h2 id="membership-compare-title">So sánh các gói</h2></div><p>Bình quân mỗi ngày là mức tham khảo, được làm tròn đến đồng. Thanh toán theo giá toàn gói.</p></div><div className="membership-table-wrap" role="region" aria-label="Bảng so sánh gói tập, cuộn ngang trên màn hình nhỏ" tabIndex={0}><table className="membership-table"><thead><tr><th scope="col">Gói tập</th><th scope="col">Thời hạn</th><th scope="col">Giá toàn gói</th><th scope="col">Bình quân / ngày</th>{discounts && <th scope="col">Giảm học phí</th>}<th scope="col">Ưu đãi</th></tr></thead><tbody>{active.map(pkg => <tr key={pkg.id}><th scope="row">{pkg.packageName}</th><td className="num">{pkg.durationDays} ngày</td><td className="num">{formatMoney(pkg.price)}</td><td className="num">{formatMoney(Math.round(pkg.price / Math.max(1, pkg.durationDays)))}</td>{discounts && <td className="num">{pkg.discountPercent ?? 0}%</td>}<td>{summaryOf(pkg) || '—'}</td></tr>)}</tbody></table></div></section>}
      </div>
    </div>
  );
}
