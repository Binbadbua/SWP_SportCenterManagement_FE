import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/endpoints.js';
import { useApi } from '../hooks/useApi.js';
import { isStaff, useAuth } from '../context/AuthContext.jsx';
import { InvoiceStatus, PaymentMethod } from '../lib/enums.js';
import { formatDate, formatDateTime, formatMoney, moneyInWords, realPhone } from '../lib/format.js';
import { Button, EmptyState, ErrorNotice, Loading } from '../components/ui.jsx';

// A printable invoice ("in/xuất hóa đơn"): the browser's print dialog prints it or saves it as a PDF.
// Reception and managers read it from GET /api/invoices/{id}/export, a member from their own invoices; the
// card's dates and the member's contact details come from the card and the member's profile.
async function loadForStaff(id) {
  const invoice = await api.invoices.export(id);
  const card = await api.memberships.get(invoice.memberMembershipId).catch(() => null);
  const member = card?.memberId ? await api.members.get(card.memberId).catch(() => null) : null;
  return { invoice, card, member };
}

async function loadForMember(id) {
  const [invoices, cards, me] = await Promise.all([
    api.invoices.mine(),
    api.memberships.mine(),
    api.members.me.get().catch(() => null),
  ]);
  const invoice = invoices.find((i) => i.id === id);
  if (!invoice) throw Object.assign(new Error('Không tìm thấy hóa đơn này trong tài khoản của bạn.'), { status: 404 });
  return { invoice, card: cards.find((c) => c.id === invoice.memberMembershipId) ?? null, member: me };
}

// Days from the first to the last day of a card, both included
const daysOf = (card) =>
  Math.round((Date.parse(String(card.endDate).slice(0, 10)) - Date.parse(String(card.startDate).slice(0, 10))) / 86400000) + 1;

export default function InvoicePrint() {
  const { id } = useParams();
  const { user } = useAuth();
  const staff = isStaff(user);
  const data = useApi(() => (staff ? loadForStaff(id) : loadForMember(id)), [id, user?.accountId], { skip: !user });
  const code = `HD-${String(id).slice(0, 8).toUpperCase()}`;
  const back = staff ? '/staff/invoices' : '/account?tab=invoices';

  // The title names the PDF a "save as PDF" creates
  useEffect(() => {
    const before = document.title;
    document.title = `SportCenter invoice ${code}`;
    return () => {
      document.title = before;
    };
  }, [code]);

  if (!user) {
    return (
      <div className="invoice-page">
        <EmptyState
          title="Đăng nhập để xem hóa đơn"
          action={<Button to={`/login?next=${encodeURIComponent(`/print/invoices/${id}`)}`}>Đăng nhập</Button>}
        >
          Hóa đơn chỉ hiện với học viên đã mua và với nhân viên lễ tân, quản lý.
        </EmptyState>
      </div>
    );
  }
  if (data.loading) {
    return (
      <div className="invoice-page">
        <Loading label="Đang tải hóa đơn" />
      </div>
    );
  }
  if (!data.data) {
    return (
      <div className="invoice-page">
        <ErrorNotice error={data.error} onRetry={data.reload} />
        <div className="invoice-page__tools">
          <Button variant="secondary" icon="arrowLeft" to={back}>Về danh sách hóa đơn</Button>
        </div>
      </div>
    );
  }

  const { invoice: i, card, member } = data.data;
  const pendingOnline = i.status === 1 && !i.receptionistId;
  const phone = realPhone(member?.phone);
  return (
    <div className="invoice-page">
      <div className="invoice-page__tools no-print">
        <Button variant="secondary" icon="arrowLeft" to={back}>Về danh sách hóa đơn</Button>
        <Button onClick={() => window.print()}>In hoặc lưu PDF</Button>
      </div>

      <article className="invoice" aria-labelledby="invoice-title">
        <header className="invoice__head">
          <div>
            <p className="invoice__brand display">SportCenter</p>
            <p className="muted">Trung tâm thể thao</p>
          </div>
          <div className="invoice__meta">
            <h1 id="invoice-title" className="invoice__title">Hóa đơn thanh toán</h1>
            <dl>
              <div><dt>Số hóa đơn</dt><dd className="num">{code}</dd></div>
              <div><dt>Ngày thanh toán</dt><dd className="num">{i.paymentDate ? formatDateTime(i.paymentDate) : '—'}</dd></div>
              <div><dt>Trạng thái</dt><dd>{InvoiceStatus.label(i.status)}</dd></div>
            </dl>
          </div>
        </header>

        <section className="invoice__party">
          <h2>Khách hàng</h2>
          <p className="cell-strong">{member?.fullName ?? i.memberName}</p>
          {phone && <p>Điện thoại: <span className="num">{phone}</span></p>}
          {member?.email && <p>Email: {member.email}</p>}
          {i.status !== 2 && (
            <p className="invoice__stamp">{i.status === 1 ? 'Chưa thanh toán' : 'Đã hủy'}</p>
          )}
        </section>

        <table className="invoice__lines">
          <thead>
            <tr>
              <th scope="col">Nội dung</th>
              <th scope="col">Thời hạn</th>
              <th scope="col" className="num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{i.packageName}</td>
              <td className="num">
                {card ? `${formatDate(card.startDate)} – ${formatDate(card.endDate)} (${daysOf(card)} ngày)` : '—'}
              </td>
              <td className="num">{formatMoney(i.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>Tổng cộng</th>
              <td className="num">{formatMoney(i.amount)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="invoice__words"><span>Bằng chữ:</span> {moneyInWords(i.amount)}.</p>

        <dl className="invoice__facts">
          <div><dt>Hình thức thanh toán</dt><dd>{PaymentMethod.label(i.paymentMethod)}</dd></div>
          <div>
            <dt>Người thu</dt>
            <dd>{i.receptionistName || (pendingOnline ? 'Mua trên web, chờ lễ tân xác nhận' : 'Mua trên web')}</dd>
          </div>
        </dl>

        <footer className="invoice__sign">
          <div>
            <p className="cell-strong">Người nộp tiền</p>
            <p className="muted small">(Ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p className="cell-strong">Người thu tiền</p>
            <p className="muted small">(Ký, ghi rõ họ tên)</p>
          </div>
        </footer>
        <p className="invoice__printed muted small">In lúc {formatDateTime(new Date())} · Mã hóa đơn đầy đủ: <span className="num">{i.id}</span></p>
      </article>
    </div>
  );
}
