import { useMemo, useState } from 'react';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { BookingStatus } from '../../lib/enums.js';
import { formatDate, isSessionOver, realPhone } from '../../lib/format.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, EmptyState, ErrorNotice, Field, Loading, SampleDataNotice, StatusTag } from '../../components/ui.jsx';

// A booking holds its spot unless it was cancelled (the API deletes cancelled bookings, but older
// rows may still say Cancelled)
const holdsSpot = (b) => b.status !== 3;

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
  const bookings = useApi(() => api.bookings.byMember(lookupId), [lookupId], { skip: !lookupId });

  const memberOptions = useMemo(
    () =>
      [...(members.data ?? [])]
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
        .map((m) => ({ value: m.id, label: [m.fullName, realPhone(m.phone) || m.email].filter(Boolean).join(' · ') })),
    [members.data],
  );
  const memberName = (id) => (members.data ?? []).find((m) => m.id === id)?.fullName ?? 'This member';

  // Classes open for booking; one that can't take this member says why and can't be picked
  const heldByMember = new Set((memberBookings.data ?? []).filter(holdsSpot).map((b) => b.classId));
  const sessionsKnown = !!sessions.data && !sessions.error && !sessions.usingSample;
  const withSessionsLeft = new Set((sessions.data ?? []).filter((s) => !isSessionOver(s)).map((s) => s.classId));
  const classOptions = (classes.data ?? [])
    .filter((c) => c.status === 1 || c.status === 2)
    .sort((a, b) => a.className.localeCompare(b.className, 'vi'))
    .map((c) => {
      const left = c.currentEnrolled == null ? null : c.maxCapacity - c.currentEnrolled;
      const blocked = heldByMember.has(c.id)
        ? 'already booked'
        : left !== null && left <= 0
          ? 'full'
          : sessionsKnown && !withSessionsLeft.has(c.id)
            ? 'no sessions left'
            : null;
      const spots = left === null ? null : `${left} ${left === 1 ? 'spot' : 'spots'} left`;
      return {
        value: c.id,
        label: [c.className, c.categoryName, blocked ?? spots].filter(Boolean).join(' · '),
        disabled: !!blocked,
      };
    });

  const book = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!memberId || !classId) {
      setFormError('Choose a member and a class.');
      return;
    }
    const who = memberName(memberId);
    const className = (classes.data ?? []).find((c) => c.id === classId)?.className ?? 'this class';
    const alreadyBooked = `${who} is already booked into ${className}.`;
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
      toast.success(`${b.memberName ?? who} is booked into ${b.className ?? className}.`);
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
    if (!window.confirm(`Cancel ${b.memberName}’s booking for ${b.className}?`)) return;
    try {
      await api.bookings.cancel(b.id, b.memberId);
      toast.success(`${b.memberName}’s booking for ${b.className} was cancelled.`);
      bookings.reload();
      if (b.memberId === memberId) memberBookings.reload();
      classes.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const memberPlaceholder = members.loading ? 'Loading members…' : 'Choose a member…';

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Bookings</h1>
          <p className="muted">Book a member into a class at the desk, or look up their bookings to help them cancel.</p>
        </div>
      </header>

      {(members.usingSample || classes.usingSample) && (
        <SampleDataNotice onRetry={() => { members.reload(); classes.reload(); }} />
      )}
      <ErrorNotice error={!members.usingSample ? members.error : null} onRetry={members.reload} />

      <div className="two-col">
        <form className="panel" onSubmit={book} noValidate>
          <h2 className="panel-title">Book a class</h2>
          <Field
            label="Member"
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
            help="Everyone registered online or at the desk. Type the first letters of a name to jump to it."
          />
          <Field
            label="Class"
            name="classId"
            type="select"
            required
            value={classId}
            onChange={(_, v) => {
              setClassId(v);
              setFormError(null);
            }}
            options={classOptions}
            placeholder={classes.loading ? 'Loading classes…' : 'Choose a class…'}
            help={
              memberId
                ? 'Classes the member already holds, full classes and classes with no sessions left can’t be picked.'
                : 'Choose the member first to see which classes they can join.'
            }
          />
          {formError && <p className="field__error" role="alert">{formError}</p>}
          <Button type="submit" disabled={saving}>{saving ? 'Booking…' : 'Book class'}</Button>
        </form>

        <section className="panel">
          <h2 className="panel-title">Find a member’s bookings</h2>
          <Field
            label="Member"
            name="lookupId"
            type="select"
            value={lookupId}
            onChange={(_, v) => setLookupId(v)}
            options={memberOptions}
            placeholder={memberPlaceholder}
            help="A booking can be cancelled until the member has attended a session."
          />

          {!lookupId ? (
            <p className="muted">Choose a member to see the classes they have booked.</p>
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
                        <p className="muted small">Starts {formatDate(b.classStartDate)} · booked {formatDate(b.bookingDate)}</p>
                      </div>
                      <StatusTag tone={BookingStatus.tone(b.status)}>{BookingStatus.label(b.status)}</StatusTag>
                      {b.status === 1 && <Button variant="ghost" size="sm" onClick={() => cancel(b)}>Cancel</Button>}
                    </li>
                  ))}
                </ul>
              ) : (
                !bookings.error && (
                  <EmptyState title="No bookings for this member">Book them into a class with the form on the left.</EmptyState>
                )
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
