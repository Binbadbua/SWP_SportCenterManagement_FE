import { useNavigate } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { usePaymentOptions } from '../../hooks/usePricing.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { IMAGES } from '../../lib/images.js';
import { formatDate, formatMoney, todayCenterDateString } from '../../lib/format.js';
import { hasPackageDiscounts, summaryOf } from '../../lib/pricing.js';
import { PackageCard } from '../../components/cards.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice, SampleDataNotice } from '../../components/ui.jsx';

// Plans come from GET /api/membership-packages: the three plans of 28/10/2026 (1 month, 6 months, 1 year) for every
// sport, their perks one per line. Choosing one opens its checkout page (Checkout.jsx). A card is the member's way in
// to train on their own (reception check them in at the door, B47); classes are coached courses booked apart. Once the
// API bills classes (CHANGELOG Part B, B53) a card takes its package's discount off every class; before that a card
// is what a booking needs.
const howItWorks = ({ online, fees }) => [
  [
    'Chọn gói và thanh toán',
    online
      ? 'Gói dùng cho mọi môn. Thanh toán trực tuyến qua SePay (quét mã VietQR bằng ứng dụng ngân hàng); thẻ được kích hoạt ngay khi SePay báo đã nhận tiền.'
      : 'Gói dùng cho mọi môn. Đặt mua trên web rồi chuyển khoản; lễ tân đối soát xong thì thẻ được kích hoạt và hóa đơn được xuất.',
  ],
  ['Vào cửa bằng thẻ', 'Đến trung tâm, lễ tân kiểm tra thẻ và ghi lượt vào. Trong thời hạn thẻ bạn tự tập không giới hạn ở khu gym, cardio và hồ bơi.'],
  fees
    ? ['Giảm học phí mọi lớp', 'Lớp học có huấn luyện viên và học phí cả khóa riêng. Trong thời hạn thẻ bạn được giảm theo mức của gói; không có thẻ thì trả giá gốc.']
    : ['Đặt lớp trong thời hạn thẻ', 'Lớp học có huấn luyện viên. Bạn đặt được các lớp chưa bắt đầu có buổi học kế tiếp nằm trong thời hạn thẻ.'],
  ['Gia hạn hoặc nâng cấp', 'Gia hạn: thẻ mới nối tiếp ngay sau thẻ cũ. Nâng cấp lên gói dài hơn: có hiệu lực ngay hôm nay, phần còn lại của thẻ cũ được trừ vào giá.'],
];

export default function Memberships() {
  const { user } = useAuth();
  const member = isMember(user);
  const opts = usePaymentOptions();
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const mine = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const navigate = useNavigate();
  const active = (packages.data ?? [])
    .filter((p) => p.status === 1)
    .sort((a, b) => a.durationDays - b.durationDays);
  const today = todayCenterDateString();
  const current = (mine.data ?? []).find((m) => m.status === 1 && String(m.endDate).slice(0, 10) >= today);
  const discounts = hasPackageDiscounts(packages.data);
  const steps = howItWorks({ online: !!opts?.online, fees: discounts });

  return (
    <>
      <section className="plan-hero">
        <img src={IMAGES.memberships} alt="" />
        <div className="plan-hero__shade" />
        <div className="container plan-hero__content">
          <h1 className="display plan-hero__title">Gói tập</h1>
          <p className="plan-hero__lead">
            {discounts
              ? 'Một thẻ cho mọi môn: tự tập không giới hạn ở khu gym, cardio, hồ bơi và được giảm học phí mọi lớp trong thời hạn thẻ.'
              : 'Một thẻ cho mọi môn: tự tập không giới hạn ở khu gym, cardio, hồ bơi và đặt các lớp có buổi học trong thời hạn thẻ.'}
          </p>
        </div>
      </section>

      <div className="container page">
        {current && (
          <Notice
            tone="success"
            title={`Bạn đang dùng ${current.packageName}`}
            action={<Button size="sm" variant="secondary" to="/account?tab=membership">Thẻ của tôi</Button>}
          >
            Còn hiệu lực đến {formatDate(current.endDate)}. Muốn chuyển sang gói dài hơn ngay hôm nay, dùng “Nâng cấp gói” ở
            Tài khoản của tôi → Thẻ thành viên.
          </Notice>
        )}
        {packages.usingSample && <SampleDataNotice onRetry={packages.reload} />}
        {packages.error?.status === 401 ? (
          <EmptyState title="Đăng nhập để xem gói tập và giá" action={<Button to="/login?next=/memberships">Đăng nhập</Button>}>
            Các gói tập chỉ hiện với người đã đăng nhập. Bạn mới đến? Hãy tạo tài khoản trước.
          </EmptyState>
        ) : (
          <ErrorNotice error={!packages.usingSample ? packages.error : null} onRetry={packages.reload} />
        )}

        {packages.loading ? (
          <Loading />
        ) : active.length ? (
          <div className="package-row package-row--light">
            {active.map((p, i) => (
              <PackageCard key={p.id} pkg={p} featured={i === 1} onChoose={() => navigate(`/memberships/${p.id}/checkout`)} />
            ))}
          </div>
        ) : (
          !packages.error && <EmptyState title="Hiện chưa có gói tập nào đang bán">Hãy hỏi lễ tân về các gói tập.</EmptyState>
        )}

        <section className="block">
          <h2 className="section-title">Thẻ thành viên dùng thế nào?</h2>
          <ol className="how-steps">
            {steps.map(([title, text], i) => (
              <li key={title} className="how-steps__item">
                <span className="how-steps__num display">{i + 1}</span>
                <p className="cell-strong">{title}</p>
                <p className="muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The line between the two (team rule, 28/10/2026): a card is access, a class is a coached course */}
        <section className="block">
          <h2 className="section-title">Thẻ thành viên và lớp học khác nhau thế nào?</h2>
          <div className="table-wrap">
            <table className="table compare">
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">Mục</span></th>
                  <th scope="col">Thẻ thành viên</th>
                  <th scope="col">Lớp học</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Là gì</th>
                  <td>Quyền vào trung tâm tự tập (gym, cardio, hồ bơi) không giới hạn trong thời hạn thẻ</td>
                  <td>Khóa học có huấn luyện viên, lịch cố định, sĩ số giới hạn, có kế hoạch và đánh giá tiến độ</td>
                </tr>
                <tr>
                  <th scope="row">Trả tiền</th>
                  <td>Một lần cho cả thời hạn thẻ</td>
                  <td>{discounts ? 'Học phí riêng, một lần cho cả khóa; có thẻ thì được giảm' : 'Không thu thêm khi bạn có thẻ còn hiệu lực'}</td>
                </tr>
                <tr>
                  <th scope="row">Dùng thế nào</th>
                  <td>Lễ tân kiểm tra thẻ khi bạn vào cửa</td>
                  <td>Đặt lớp trước khi lớp bắt đầu; huấn luyện viên điểm danh từng buổi</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {active.length > 1 && (
          <section className="block">
            <h2 className="section-title">So sánh các gói</h2>
            <p className="muted">Quyền lợi của từng gói ghi trên thẻ gói ở trên; nhân viên phục vụ tại trung tâm.</p>
            <div className="table-wrap">
              <table className="table compare">
                <thead>
                  <tr>
                    <th scope="col">Gói tập</th>
                    <th scope="col">Thời hạn</th>
                    <th scope="col">Giá</th>
                    <th scope="col">Bình quân mỗi ngày</th>
                    {discounts && <th scope="col">Giảm học phí</th>}
                    <th scope="col">Ưu đãi</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">{p.packageName}</th>
                      <td className="num">{p.durationDays} ngày</td>
                      <td className="num">{formatMoney(p.price)}</td>
                      <td className="num">{formatMoney(Math.round(p.price / Math.max(1, p.durationDays) / 100) * 100)}</td>
                      {discounts && <td className="num">{p.discountPercent ?? 0}%</td>}
                      <td>{summaryOf(p) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

    </>
  );
}
