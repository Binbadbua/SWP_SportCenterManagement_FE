import { useMemo, useState } from 'react';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { BookingStatus } from '../../lib/enums.js';
import { daysUntil, formatDate, isSessionOver, realPhone, todayUtcDateString } from '../../lib/format.js';
import { cardCheck, cardsOn } from '../../lib/membership.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, EmptyState, ErrorNotice, Field, Loading, Notice, SampleDataNotice, StatusTag } from '../../components/ui.jsx';

// A booking holds its spot unless it was cancelled (the API deletes cancelled bookings, but older
// rows may still say Cancelled)
const holdsSpot = (b) => b.status !== 3;

// The member's card, shown under the member picker: classes need a card valid on their next session
function CardStatus({ cards }) {
  if (cards.loading) return <p className="muted small">Đang kiểm tra thẻ thành viên…</p>;
  if (cards.error) return <ErrorNotice error={cards.error} onRetry={cards.reload} />;
  const list = cards.data ?? [];
  const today = todayUtcDateString();
  const [active] = cardsOn(list, today);
  if (active) {
    return (
      <Notice tone="success" title={active.packageName}>
        Còn hiệu lực đến {formatDate(active.endDate)} (còn {daysUntil(active.endDate)} ngày). Đặt được các lớp có buổi
        học kế tiếp trong thời hạn thẻ.
      </Notice>
    );
  }
  const pending = list.find((m) => m.status === 2 && String(m.endDate).slice(0, 10) >= today);
  const later = list.find((m) => m.status === 1 && String(m.startDate).slice(0, 10) > today);
  return (
    <Notice
      tone="warning"
      title={later ? `${later.packageName} bắt đầu từ ${formatDate(later.startDate)}` : 'Học viên chưa có thẻ còn hiệu lực'}
      action={!later && (
        <Button size="sm" variant="secondary" to={pending ? '/staff/invoices' : '/staff/memberships'}>
          {pending ? 'Thu tiền' : 'Bán thẻ'}
        </Button>
      )}
    >
      {later
        ? 'Chỉ đặt được các lớp có buổi học kế tiếp từ ngày đó trở đi.'
        : pending
          ? `${pending.packageName} chưa được kích hoạt vì chưa thanh toán. Thu tiền ở trang Hóa đơn (đơn mua trên web: bấm “Xác nhận đã nhận tiền”) rồi đặt lớp.`
          : 'Lớp học không thu thêm phí nhưng cần thẻ thành viên còn hiệu lực. Bán thẻ cho học viên ở trang Thẻ thành viên rồi quay lại đặt lớp.'}
    </Notice>
  );
}

// Front desk: book a member into a class, or look up and cancel their bookings.
export default function Bookings() {
  const toast = useToast();
  const members = useApi(() => api.members.list(), [], { sample: mock.members });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const sessions = useApi(() => api.schedules.list(), [], { sample: mock.sessions });
  const [memberId, setMemberId] = useState('');
  const [classId, setClassId] = useState('');
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

  // Classes open for booking; one that can't take this member says why and can't be picked
  const heldByMember = new Set((memberBookings.data ?? []).filter(holdsSpot).map((b) => b.classId));
  const sessionsKnown = !!sessions.data && !sessions.error && !sessions.usingSample;
  const cardsKnown = !!memberId && !!memberCards.data && !memberCards.error;
  const withSessionsLeft = new Set((sessions.data ?? []).filter((s) => !isSessionOver(s)).map((s) => s.classId));
  // The member's cards against each class's next session (null while either is still unknown)
  const cardFor = (id) => (cardsKnown && sessionsKnown ? cardCheck(memberCards.data, sessions.data, id) : null);
  const classOptions = (classes.data ?? [])
    .filter((c) => c.status === 1 || c.status === 2)
    .sort((a, b) => a.className.localeCompare(b.className, 'vi'))
    .map((c) => {
      const left = c.currentEnrolled == null ? null : c.maxCapacity - c.currentEnrolled;
      const blocked = heldByMember.has(c.id)
        ? 'đã đặt'
        : left !== null && left <= 0
          ? 'đã đủ chỗ'
          : sessionsKnown && !withSessionsLeft.has(c.id)
            ? 'hết buổi học'
            : cardFor(c.id)?.ok === false
              ? 'thẻ không còn hiệu lực vào buổi tới'
              : null;
      const spots = left === null ? null : `còn ${left} chỗ`;
      return {
        value: c.id,
        label: [c.className, c.categoryName, blocked ?? spots].filter(Boolean).join(' · '),
        disabled: !!blocked,
      };
    });
  const chosenCard = classId ? cardFor(classId) : null;

  const book = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!memberId || !classId) {
      setFormError('Vui lòng chọn học viên và lớp học.');
      return;
    }
    const who = memberName(memberId);
    const className = (classes.data ?? []).find((c) => c.id === classId)?.className ?? 'lớp này';
    const alreadyBooked = `${who} đã đặt lớp ${className} rồi.`;
    // The API does not check the card yet (CHANGELOG Part B, B45), so the desk does
    if (chosenCard && !chosenCard.ok) {
      setFormError(`${chosenCard.reason} ${who} cần thẻ còn hiệu lực vào buổi học kế tiếp của lớp (${formatDate(chosenCard.nextDate)}).`);
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
      const b = await api.bookings.create({ memberId, classId });
      toast.success(`Đã đặt lớp ${b.className ?? className} cho ${b.memberName ?? who}.${chosenCard?.warning ? ` ${chosenCard.warning}` : ''}`);
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

  const cancel = async (b) => {
    if (!window.confirm(`Hủy lượt đặt lớp ${b.className} của ${b.memberName}?`)) return;
    try {
      await api.bookings.cancel(b.id, b.memberId);
      toast.success(`Đã hủy lượt đặt lớp ${b.className} của ${b.memberName}.`);
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
          <p className="muted">Đặt lớp cho học viên tại quầy, hoặc tra cứu các lớp họ đã đặt để hỗ trợ hủy.</p>
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
          {memberId && <CardStatus cards={memberCards} />}
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
              memberId
                ? 'Không chọn được lớp học viên đã đặt, lớp đã đủ chỗ, lớp đã hết buổi học và lớp có buổi kế tiếp nằm ngoài thời hạn thẻ của học viên.'
                : 'Chọn học viên trước để biết họ có thể vào những lớp nào.'
            }
          />
          {chosenCard?.warning && <p className="muted small">{chosenCard.warning}</p>}
          {formError && <p className="field__error" role="alert">{formError}</p>}
          <Button type="submit" disabled={saving || (!!memberId && memberCards.loading)}>{saving ? 'Đang đặt…' : 'Đặt lớp'}</Button>
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
            help="Lượt đặt chỉ hủy được khi học viên chưa tham gia buổi nào."
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
                        <p className="muted small">Khai giảng {formatDate(b.classStartDate)} · đặt ngày {formatDate(b.bookingDate)}</p>
                      </div>
                      <StatusTag tone={BookingStatus.tone(b.status)}>{BookingStatus.label(b.status)}</StatusTag>
                      {b.status === 1 && <Button variant="ghost" size="sm" onClick={() => cancel(b)}>Hủy</Button>}
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
