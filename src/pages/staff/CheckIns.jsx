import { useMemo, useState } from 'react';
import { api } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { daysUntil, formatClock, formatDate, realPhone, todayLocalDateString } from '../../lib/format.js';
import { cardsOn } from '../../lib/membership.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, EmptyState, ErrorNotice, Field, Loading, Notice } from '../../components/ui.jsx';

// The door (CHANGELOG Part B, B47): a member comes in to train on their own with a card valid today. Reception pick the
// member, see their card and log the visit; the API refuses a member without a valid card. A manager reads the log.
// Not the coach's attendance: coming into the center and being present in a class session are two different things.
export default function CheckIns() {
  const { user } = useAuth();
  const toast = useToast();
  const desk = user?.role === 'Receptionist';
  const [day, setDay] = useState(todayLocalDateString());
  const [memberId, setMemberId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const members = useApi(() => api.members.list(), [], { skip: !desk });
  const cards = useApi(() => api.memberships.byMember(memberId), [memberId], { skip: !memberId });
  const visits = useApi(() => api.checkIns.list(day), [day]);

  const memberOptions = useMemo(
    () =>
      [...(members.data ?? [])]
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
        .map((m) => ({ value: m.id, label: [m.fullName, realPhone(m.phone) || m.email].filter(Boolean).join(' · ') })),
    [members.data],
  );
  const today = todayLocalDateString();
  const [card] = cardsOn(cards.data, today);
  const inToday = new Set((day === today ? visits.data ?? [] : []).map((v) => v.memberId));

  const checkIn = async (e) => {
    e.preventDefault();
    if (!memberId) return setError('Vui lòng chọn học viên.');
    setBusy(true);
    setError(null);
    try {
      const v = await api.checkIns.create(memberId);
      toast.success(`Đã ghi lượt vào của ${v.memberName}: ${v.packageName}, còn ${v.daysRemaining} ngày.`);
      setMemberId('');
      if (day === today) visits.reload();
      else setDay(today);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Vào cửa</h1>
          <p className="muted">
            {desk
              ? 'Kiểm tra thẻ thành viên khi học viên đến tự tập và ghi lượt vào. Lớp học do huấn luyện viên điểm danh riêng.'
              : 'Các lượt học viên vào trung tâm tự tập, theo ngày. Lễ tân ghi lượt vào tại quầy.'}
          </p>
        </div>
      </header>

      <div className={desk ? 'two-col' : undefined}>
        {desk && (
          <form className="panel" onSubmit={checkIn} noValidate>
            <h2 className="panel-title">Ghi lượt vào</h2>
            <ErrorNotice error={members.error} onRetry={members.reload} />
            <Field
              label="Học viên"
              name="memberId"
              type="select"
              required
              value={memberId}
              onChange={(_, v) => {
                setMemberId(v);
                setError(null);
              }}
              options={memberOptions}
              placeholder={members.loading ? 'Đang tải danh sách học viên…' : 'Chọn học viên…'}
              help="Gõ vài chữ đầu của tên để nhảy nhanh tới người cần tìm."
            />
            {memberId &&
              (cards.loading ? (
                <p className="muted small">Đang kiểm tra thẻ thành viên…</p>
              ) : cards.error ? (
                <ErrorNotice error={cards.error} onRetry={cards.reload} />
              ) : card ? (
                <Notice tone="success" title={card.packageName}>
                  Còn hiệu lực đến {formatDate(card.endDate)} (còn {daysUntil(card.endDate)} ngày).
                  {inToday.has(memberId) && ' Học viên đã vào một lần hôm nay.'}
                </Notice>
              ) : (
                <Notice
                  tone="warning"
                  title="Học viên chưa có thẻ còn hiệu lực hôm nay"
                  action={<Button size="sm" variant="secondary" to="/staff/memberships">Bán thẻ</Button>}
                >
                  Bán hoặc gia hạn thẻ trước khi cho vào tự tập. Lớp đã đặt vẫn học bình thường.
                </Notice>
              ))}
            {error && <p className="field__error" role="alert">{error}</p>}
            <Button type="submit" disabled={busy || !memberId || cards.loading || (!!cards.data && !card)}>
              {busy ? 'Đang ghi…' : 'Ghi lượt vào'}
            </Button>
          </form>
        )}

        <section className="panel">
          <div className="panel-bar">
            <h2 className="panel-title">{day === today ? 'Lượt vào hôm nay' : `Lượt vào ngày ${formatDate(day)}`}</h2>
            <Field label="Ngày" name="day" type="date" value={day} max={today} onChange={(_, v) => v && setDay(v)} />
          </div>
          {visits.loading ? (
            <Loading />
          ) : (
            <>
              <ErrorNotice error={visits.error} onRetry={visits.reload} />
              {visits.data?.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Giờ vào</th>
                        <th scope="col">Học viên</th>
                        <th scope="col">Thẻ</th>
                        <th scope="col">Hết hạn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.data.map((v) => (
                        <tr key={v.id}>
                          <td className="num">{formatClock(v.checkInTime)}</td>
                          <td className="cell-strong">{v.memberName}</td>
                          <td>{v.packageName}</td>
                          <td className="num">{formatDate(v.membershipEndDate)} · còn {v.daysRemaining} ngày</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !visits.error && (
                  <EmptyState title="Chưa có lượt vào nào">
                    {day === today ? 'Lượt vào được ghi khi học viên đến quầy lễ tân.' : 'Ngày này không có ai vào tự tập.'}
                  </EmptyState>
                )
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
