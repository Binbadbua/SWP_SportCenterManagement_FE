import { useNavigate } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { IMAGES } from '../../lib/images.js';
import { formatDate, formatMoney, todayUtcDateString } from '../../lib/format.js';
import { hasPackageDiscounts } from '../../lib/pricing.js';
import { PackageCard } from '../../components/cards.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice, SampleDataNotice } from '../../components/ui.jsx';

// Plans come from GET /api/membership-packages. Choosing one opens its checkout page (Checkout.jsx),
// where a member confirms the dates and pays online. Once the API bills classes (CHANGELOG Part B, B53) a
// package carries the discount it gives on every class and the services that come with it; before that a
// package carries only a name, description, length and price, and a card is what a booking needs.
const HOW_IT_WORKS = [
  ['Chọn gói và đặt mua', 'Đặt mua trên web hoặc tại quầy. Đơn mua trên web được giữ 30 phút.'],
  ['Thanh toán với lễ tân', 'Lễ tân xác nhận đã nhận tiền, thẻ được kích hoạt và hóa đơn được xuất ngay.'],
  ['Đặt lớp không mất thêm phí', 'Trong thời hạn thẻ, bạn đặt các lớp có buổi học kế tiếp nằm trong thời hạn đó.'],
  ['Gia hạn trước khi hết hạn', 'Mua tiếp một gói: thẻ mới bắt đầu ngay sau ngày thẻ cũ hết hạn.'],
];
const HOW_IT_WORKS_WITH_FEES = [
  ['Chọn gói và đặt mua', 'Gói dùng cho mọi môn. Đặt mua trên web hoặc tại quầy; đơn mua trên web được giữ 30 phút.'],
  ['Thanh toán với lễ tân', 'Lễ tân xác nhận đã nhận tiền, thẻ được kích hoạt và hóa đơn được xuất ngay.'],
  ['Giảm học phí mọi lớp', 'Mỗi lớp có học phí cả khóa. Trong thời hạn thẻ, bạn được giảm theo mức của gói; không có thẻ thì trả giá gốc.'],
  ['Gia hạn trước khi hết hạn', 'Mua tiếp một gói: thẻ mới bắt đầu ngay sau ngày thẻ cũ hết hạn.'],
];

export default function Memberships() {
  const { user } = useAuth();
  const member = isMember(user);
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const mine = useApi(() => api.memberships.mine(), [user?.accountId], { skip: !member });
  const navigate = useNavigate();
  const active = (packages.data ?? [])
    .filter((p) => p.status === 1)
    .sort((a, b) => a.durationDays - b.durationDays);
  const today = todayUtcDateString();
  const current = (mine.data ?? []).find((m) => m.status === 1 && String(m.endDate).slice(0, 10) >= today);
  const discounts = hasPackageDiscounts(packages.data);
  const steps = discounts ? HOW_IT_WORKS_WITH_FEES : HOW_IT_WORKS;

  return (
    <>
      <section className="plan-hero">
        <img src={IMAGES.memberships} alt="" />
        <div className="plan-hero__shade" />
        <div className="container plan-hero__content">
          <h1 className="display plan-hero__title">Gói tập</h1>
          <p className="plan-hero__lead">
            {discounts
              ? 'Một thẻ cho mọi môn: giảm học phí mọi lớp trong thời hạn thẻ, kèm các dịch vụ của trung tâm.'
              : 'Thanh toán một lần cho cả thời hạn của thẻ. Trong thời gian đó, đặt lớp không mất thêm phí.'}
          </p>
        </div>
      </section>

      <div className="container page">
        {current && (
          <Notice tone="success" title={`Bạn đang dùng ${current.packageName}`}>
            Còn hiệu lực đến {formatDate(current.endDate)}. Xem tất cả thẻ của bạn ở Tài khoản của tôi → Thẻ thành viên.
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

        {active.length > 1 && (
          <section className="block">
            <h2 className="section-title">So sánh các gói</h2>
            <p className="muted">
              {discounts
                ? 'Dịch vụ đi kèm của từng gói ghi trên thẻ gói ở trên; nhân viên phục vụ tại trung tâm.'
                : 'Các môn và dịch vụ của từng gói ghi trong phần mô tả; hỏi lễ tân nếu bạn chưa rõ.'}
            </p>
            <div className="table-wrap">
              <table className="table compare">
                <thead>
                  <tr>
                    <th scope="col">Gói tập</th>
                    <th scope="col">Thời hạn</th>
                    <th scope="col">Giá</th>
                    <th scope="col">Bình quân mỗi ngày</th>
                    {discounts && <th scope="col">Giảm học phí</th>}
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
