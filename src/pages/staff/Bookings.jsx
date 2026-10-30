import { useMemo, useState } from 'react';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { BookingStatus, DESK_METHODS } from '../../lib/enums.js';
import { daysUntil, formatDate, formatMoney, isSessionOver, realPhone, todayCenterDateString } from '../../lib/format.js';
import { classStarted } from '../../lib/classes.js';
import { cardCheck, cardsOn } from '../../lib/membership.js';
import { discountFor, hasClassPrices, priceAfter } from '../../lib/pricing.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, EmptyState, ErrorNotice, Field, Loading, Notice, SampleDataNotice, StatusTag } from '../../components/ui.jsx';

// A booking holds its spot unless it was cancelled (the API deletes cancelled bookings, but older
// rows may still say Cancelled)
const holdsSpot = (b) => b.status !== 3;
const paid = (b) => b.status === 1 && Number(b.price ?? 0) > 0;

// The member's card, shown under the member picker. With class fees (CHANGELOG Part B, B53) it only gives a
// discount; before them a class needs a card valid on its next session.
function CardStatus({ cards, priced, discount }) {
  if (cards.loading) return <p className="muted small">Đang kiểm tra thẻ thành viên…</p>;
  if (cards.error) return <ErrorNotice error={cards.error} onRetry={cards.reload} />;
  const list = cards.data ?? [];
  const today = todayCenterDateString();
  const [active] = cardsOn(list, today);
  if (active) {
    return (
      <Notice tone="success" title={active.packageName}>
        Còn hiệu lực đến {formatDate(active.endDate)} (còn {daysUntil(active.endDate)} ngày).{' '}
        {priced
          ? discount > 0
            ? `Được giảm ${discount}% học phí mọi lớp.`
            : 'Gói này không giảm học phí.'
          : 'Đặt được các lớp có buổi học kế tiếp trong thời hạn thẻ.'}
      </Notice>
    );
  }
  const pending = list.find((m) => m.status === 2 && String(m.endDate).slice(0, 10) >= today);
  const later = list.find((m) => m.status === 1 && String(m.startDate).slice(0, 10) > today);
  return (
    <Notice
      tone={priced ? 'info' : 'warning'}
      title={later ? `${later.packageName} bắt đầu từ ${formatDate(later.startDate)}` : 'Học viên chưa có thẻ còn hiệu lực'}
      action={!later && (
        <Button size="sm" variant="secondary" to={pending ? '/staff/invoices' : '/staff/memberships'}>
          {pending ? 'Thu tiền' : 'Bán thẻ'}
        </Button>
      )}
    >
      {priced
        ? later
          ? 'Hôm nay học viên trả học phí gốc; thẻ có hiệu lực từ ngày đó thì được giảm.'
          : 'Học viên trả học phí gốc. Có thẻ còn hiệu lực thì được giảm học phí theo gói.'
        : later
          ? 'Chỉ đặt được các lớp có buổi học kế tiếp từ ngày đó trở đi.'
          : pending
            ? `${pending.packageName} chưa được kích hoạt vì chưa thanh toán. Thu tiền ở trang Hóa đơn (đơn mua trên web: bấm “Xác nhận đã nhận tiền”) rồi đặt lớp.`
            : 'Lớp học không thu thêm phí nhưng cần thẻ thành viên còn hiệu lực. Bán thẻ cho học viên ở trang Thẻ thành viên rồi quay lại đặt lớp.'}
    </Notice>
  );
}

// Front desk: book a member into a class (taking the class fee once the API bills classes), or look up and
// cancel their bookings.
export default function Bookings() {
  const toast = useToast();
  const members = useApi(() => api.members.list(), [], { sample: mock.members });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const sessions = useApi(() => api.schedules.list(), [], { sample: mock.sessions });
  const packages = useApi(() => api.packages.list(), [], { sample: mock.packages });
  const [memberId, setMemberId] = useState('');
  const [classId, setClassId] = useState('');
  const [method, setMethod] = useState('1'); // cash, the usual way at the desk
  const [lookupId, setLookupId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // The bookings of the member being booked mark the classes they already hold a spot in
  const memberBookings = useApi(() => api.bookings.byMember(memberId), [memberId], { skip: !memberId });
  const memberCards = useApi(() => api.memberships.byMember(memberId), [memberId], { skip: !memberId });
  const bookings = useApi(() => api.bookings.byMember(lookupId), [lookupId], { skip: !lookupId });

  const memberOptions = useMemo(
    () =>
      [...(members.data ?? [])]
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
        .map((m) => ({ value: m.id, label: [m.fullName, realPhone(m.phone) || m.email].filter(Boolean).join(' · ') })),
    [members.data],
  );
  const memberName = (id) => (members.data ?? []).find((m) => m.id === id)?.fullName ?? 'Học viên này';

  const priced = !classes.usingSample && hasClassPrices(classes.data);
  const heldByMember = new Set((memberBookings.data ?? []).filter(holdsSpot).map((b) => b.classId));
  const sessionsKnown = !!sessions.data && !sessions.error && !sessions.usingSample;
  const cardsKnown = !!memberId && !!memberCards.data && !memberCards.error;
  const withSessionsLeft = new Set((sessions.data ?? []).filter((s) => !isSessionOver(s)).map((s) => s.classId));
  // Before class fees: the member's cards against each class's next session (null while either is unknown)
  const cardFor = (id) => (!priced && cardsKnown && sessionsKnown ? cardCheck(memberCards.data, sessions.data, id) : null);
  const deal = priced && cardsKnown ? discountFor(memberCards.data, packages.data) : { percent: 0 };
  // Classes open for booking; one that can't take this member says why and can't be picked. A class takes members only
  // before it starts (team rule, 28/10/2026), at the desk as on the web.
  const classOptions = (classes.data ?? [])
    .filter((c) => c.status === 1 || c.status === 2)
    .sort((a, b) => a.className.localeCompare(b.className, 'vi'))
    .map((c) => {
      const left = c.currentEnrolled == null ? null : c.maxCapacity - c.currentEnrolled;
      const blocked = heldByMember.has(c.id)
        ? 'đã đặt'
        : classStarted(c, sessionsKnown ? sessions.data : [])
          ? 'đã bắt đầu'
          : left !== null && left <= 0
            ? 'đã đủ chỗ'
            : sessionsKnown && !withSessionsLeft.has(c.id)
              ? 'hết buổi học'
              : cardFor(c.id)?.ok === false
                ? 'thẻ không còn hiệu lực vào buổi tới'
                : null;
      const spots = left === null ? null : `còn ${left} chỗ`;
      const fee = priced ? (c.price > 0 ? formatMoney(c.price) : 'miễn phí') : null;
      return {
        value: c.id,
        label: [c.className, c.categoryName, fee, blocked ?? spots].filter(Boolean).join(' · '),
        disabled: !!blocked,
      };
    });
  const chosenCard = classId ? cardFor(classId) : null;
  const chosen = (classes.data ?? []).find((c) => c.id === classId);
  const fee = priced ? Number(chosen?.price ?? 0) : 0;
  const toPay = priceAfter(fee, deal.percent);

  const book = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!memberId || !classId) {
      setFormError('Vui lòng chọn học viên và lớp học.');
      return;
    }
    const who = memberName(memberId);
    const className = chosen?.className ?? 'lớp này';
    const alreadyBooked = `${who} đã đặt lớp ${className} rồi.`;
    // Before class fees the API does not check the card (B45), so the desk does
    if (chosenCard && !chosenCard.ok) {
      setFormError(`${chosenCard.reason} ${who} cần thẻ còn hiệu lực vào buổi học kế tiếp của lớp (${formatDate(chosenCard.nextDate)}).`);
      return;
    }
    if (fee > 0 && !method) {
      setFormError('Vui lòng chọn hình thức thanh toán.');
      return;
    }
    setSaving(true);
    try {
      // Checked again here: the member may have booked online since this page loaded
      const current = await api.bookings.byMember(memberId);
      if (current.some((b) => b.classId === classId && holdsSpot(b))) {
        setFormError(alreadyBooked);
        memberBookings.reload();
        return;
      }
      // With a fee the money is taken at the desk: the API books and bills at once, working out the amount
      const b = await api.bookings.create(fee > 0 ? { memberId, classId, paymentMethod: Number(method) } : { memberId, classId });
      toast.success(
        fee > 0
          ? `Đã thu ${formatMoney(b.price ?? toPay)} và đặt lớp ${b.className ?? className} cho ${b.memberName ?? who}.`
          : `Đã đặt lớp ${b.className ?? className} cho ${b.memberName ?? who}.${chosenCard?.warning ? ` ${chosenCard.warning}` : ''}`,
      );
      setClassId('');
      if (lookupId === memberId) bookings.reload();
      else setLookupId(memberId);
      memberBookings.reload();
      classes.reload();
    } catch (err) {
      // The API words a repeat booking for the member ("Bạn đã đăng ký…"); name the member instead
      setFormError(/đã đăng ký/i.test(err.message) ? alreadyBooked : err.message);
    } finally {
      setSaving(false);
    }
  };

  // The cancel rules of 28/10/2026 (B55): a paid class is refunded in full before it starts — through SePay when the
  // member paid online, at the desk otherwise — and not at all once it has started
  const startedOf = (b) => {
    const c = (classes.data ?? []).find((x) => x.id === b.classId);
    return c ? classStarted(c, sessionsKnown ? sessions.data : []) : false;
  };
  const cancel = async (b) => {
    const late = startedOf(b);
    const online = b.paymentMethod === 4 || b.paymentMethod === 5;
    const question = paid(b)
      ? late
        ? `Lớp ${b.className} đã bắt đầu: hủy lượt đặt của ${b.memberName} sẽ KHÔNG hoàn ${formatMoney(b.price)} học phí. Vẫn hủy?`
        : `Hủy lượt đặt lớp ${b.className} của ${b.memberName} và hoàn đủ ${formatMoney(b.price)}?`
      : b.status === 4
        ? `Hủy lượt đặt lớp ${b.className} đang chờ thanh toán của ${b.memberName}?`
        : late
          ? `Lớp ${b.className} đã bắt đầu: sau khi hủy, ${b.memberName} không đặt lại được lớp này. Vẫn hủy?`
          : `Hủy lượt đặt lớp ${b.className} của ${b.memberName}?`;
    if (!window.confirm(question)) return;
    try {
      const cancellation = await api.bookings.cancel(b.id, b.memberId);
      toast.success(
        cancellation?.refundPending
          ? "Đã hủy lớp. Hãy hoàn tiền rồi xác nhận ở Hóa đơn → Xác nhận đã hoàn tiền."
          : paid(b) && !late
          ? online
            ? `Đã hủy lượt đặt lớp ${b.className}; ${formatMoney(b.price)} được ghi nhận hoàn cho ${b.memberName}.`
            : `Đã hủy lượt đặt lớp ${b.className} và ghi hoàn ${formatMoney(b.price)}. Trả tiền cho ${b.memberName} tại quầy.`
          : `Đã hủy lượt đặt lớp ${b.className} của ${b.memberName}${paid(b) ? ' (không hoàn tiền)' : ''}.`,
      );
      bookings.reload();
      if (b.memberId === memberId) memberBookings.reload();
      classes.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const memberPlaceholder = members.loading ? 'Đang tải danh sách học viên…' : 'Chọn học viên…';

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Đặt lớp</h1>
          <p className="muted">
            {priced
              ? 'Thu học phí và đặt lớp cho học viên tại quầy, hoặc tra cứu các lớp họ đã đặt để hỗ trợ hủy.'
              : 'Đặt lớp cho học viên tại quầy, hoặc tra cứu các lớp họ đã đặt để hỗ trợ hủy.'}
          </p>
        </div>
      </header>

      {(members.usingSample || classes.usingSample) && (
        <SampleDataNotice onRetry={() => { members.reload(); classes.reload(); }} />
      )}
      <ErrorNotice error={!members.usingSample ? members.error : null} onRetry={members.reload} />

      <div className="two-col">
        <form className="panel" onSubmit={book} noValidate>
          <h2 className="panel-title">Đặt lớp cho học viên</h2>
          <Field
            label="Học viên"
            name="memberId"
            type="select"
            required
            value={memberId}
            onChange={(_, v) => {
              setMemberId(v);
              setFormError(null);
              // Show the same member's bookings on the right
              if (v) setLookupId(v);
            }}
            options={memberOptions}
            placeholder={memberPlaceholder}
            help="Mọi học viên đã đăng ký trên web hoặc tại quầy. Gõ vài chữ đầu của tên để nhảy nhanh tới người cần tìm."
          />
          {memberId && <CardStatus cards={memberCards} priced={priced} discount={deal.percent} />}
          <Field
            label="Lớp học"
            name="classId"
            type="select"
            required
            value={classId}
            onChange={(_, v) => {
              setClassId(v);
              setFormError(null);
            }}
            options={classOptions}
            placeholder={classes.loading ? 'Đang tải danh sách lớp…' : 'Chọn lớp học…'}
            help={
              !memberId
                ? 'Chọn học viên trước để biết họ có thể vào những lớp nào.'
                : priced
                  ? 'Không chọn được lớp học viên đã đặt, lớp đã bắt đầu, lớp đã đủ chỗ và lớp đã hết buổi học.'
                  : 'Không chọn được lớp học viên đã đặt, lớp đã bắt đầu, lớp đã đủ chỗ, lớp đã hết buổi học và lớp có buổi kế tiếp nằm ngoài thời hạn thẻ của học viên.'
            }
          />
          {fee > 0 && (
            <>
              <dl className="checkout__lines desk-fee">
                <div><dt>Học phí cả khóa</dt><dd className="num">{formatMoney(fee)}</dd></div>
                {deal.percent > 0 && (
                  <div>
                    <dt>{deal.pkg.packageName} giảm {deal.percent}%</dt>
                    <dd className="num">−{formatMoney(fee - toPay)}</dd>
                  </div>
                )}
                <div className="checkout__total"><dt>Thu của học viên</dt><dd className="num">{formatMoney(toPay)}</dd></div>
              </dl>
              <Field
                label="Hình thức thanh toán"
                name="paymentMethod"
                type="select"
                required
                value={method}
                onChange={(_, v) => setMethod(v)}
                options={DESK_METHODS.map((o) => ({ value: String(o.value), label: o.label }))}
                placeholder="Chọn hình thức…"
                help="Thu tiền xong mới bấm nút bên dưới: lớp được đặt và hóa đơn đã thanh toán được xuất ngay."
              />
            </>
          )}
          {chosenCard?.warning && <p className="muted small">{chosenCard.warning}</p>}
          {formError && <p className="field__error" role="alert">{formError}</p>}
          <Button type="submit" disabled={saving || (!!memberId && memberCards.loading)}>
            {saving ? 'Đang đặt…' : fee > 0 ? `Thu ${formatMoney(toPay)} và đặt lớp` : 'Đặt lớp'}
          </Button>
        </form>

        <section className="panel">
          <h2 className="panel-title">Tra cứu lớp đã đặt</h2>
          <Field
            label="Học viên"
            name="lookupId"
            type="select"
            value={lookupId}
            onChange={(_, v) => setLookupId(v)}
            options={memberOptions}
            placeholder={memberPlaceholder}
            help={
              priced
                ? 'Lượt đã thanh toán hủy trước buổi học đầu thì hoàn đủ học phí; lớp đã bắt đầu thì hủy không hoàn tiền. Lượt chờ thanh toán hủy lúc nào cũng được.'
                : 'Lớp đã bắt đầu thì sau khi hủy, học viên không đặt lại được lớp đó.'
            }
          />

          {!lookupId ? (
            <p className="muted">Chọn một học viên để xem các lớp họ đã đặt.</p>
          ) : bookings.loading ? (
            <Loading />
          ) : (
            <>
              <ErrorNotice error={bookings.error} onRetry={bookings.reload} />
              {bookings.data?.length ? (
                <ul className="booking-list">
                  {bookings.data.map((b) => (
                    <li key={b.id}>
                      <div>
                        <p className="cell-strong">{b.className}</p>
                        <p className="muted small">
                          Khai giảng {formatDate(b.classStartDate)} · đặt ngày {formatDate(b.bookingDate)}
                          {Number(b.price ?? 0) > 0 && ` · ${formatMoney(b.price)}`}
                        </p>
                      </div>
                      <StatusTag tone={BookingStatus.tone(b.status)}>{BookingStatus.label(b.status)}</StatusTag>
                      {(b.status === 1 || b.status === 4) && (
                        <Button variant="ghost" size="sm" onClick={() => cancel(b)}>
                          {paid(b) ? (startedOf(b) ? 'Hủy, không hoàn tiền' : 'Hủy, hoàn tiền') : 'Hủy'}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                !bookings.error && (
                  <EmptyState title="Học viên này chưa đặt lớp nào">Hãy đặt lớp cho họ bằng biểu mẫu bên trái.</EmptyState>
                )
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
