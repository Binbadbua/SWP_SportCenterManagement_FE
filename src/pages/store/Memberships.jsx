import { useNavigate } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { isMember, useAuth } from '../../context/AuthContext.jsx';
import { IMAGES } from '../../lib/images.js';
import { formatDate, todayUtcDateString } from '../../lib/format.js';
import { PackageCard } from '../../components/cards.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice, SampleDataNotice } from '../../components/ui.jsx';

// Plans come from GET /api/membership-packages. Choosing one opens its checkout page (Checkout.jsx),
// where a member confirms the dates and pays online.
const INCLUDED = [
  ['Mọi lớp tập nhóm', true, true, true],
  ['Phòng gym & hồ bơi', 'Giờ thấp điểm', true, true],
  ['Gặp huấn luyện viên', false, 'Hằng tháng', 'Hằng tháng'],
  ['Kế hoạch tập riêng', false, false, true],
  ['Đánh giá tiến độ', false, false, true],
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

  return (
    <>
      <section className="plan-hero">
        <img src={IMAGES.memberships} alt="" />
        <div className="plan-hero__shade" />
        <div className="container plan-hero__content">
          <h1 className="display plan-hero__title">Gói tập</h1>
          <p className="plan-hero__lead">Một thẻ cho mọi lớp học, sân tập và làn bơi. Thanh toán một lần, tập bao nhiêu tùy thích.</p>
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

        {active.length > 0 && (
          <section className="block">
            <h2 className="section-title">Quyền lợi của từng gói</h2>
            <div className="table-wrap">
              <table className="table compare">
                <thead>
                  <tr>
                    <th scope="col">Quyền lợi</th>
                    {active.slice(0, 3).map((p) => <th scope="col" key={p.id}>{p.packageName}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {INCLUDED.map(([name, ...cols]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      {cols.slice(0, Math.min(3, active.length)).map((v, i) => (
                        <td key={i}>{v === true ? 'Có' : v === false ? '—' : v}</td>
                      ))}
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
