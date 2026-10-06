import { useState } from 'react';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { BookingStatus } from '../../lib/enums.js';
import { formatDate } from '../../lib/format.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, EmptyState, ErrorNotice, Field, Loading, StatusTag } from '../../components/ui.jsx';

// Front desk: book a member into a class, or look up and cancel their bookings.
export default function Bookings() {
  const toast = useToast();
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const [memberId, setMemberId] = useState('');
  const [classId, setClassId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [lookupInput, setLookupInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const bookings = useApi(() => api.bookings.byMember(lookupId), [lookupId], { skip: !lookupId });

  const open = (classes.data ?? []).filter((c) => c.status === 1 || c.status === 2);

  const book = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!memberId.trim() || !classId) {
      setFormError('Enter a member ID and pick a class.');
      return;
    }
    setSaving(true);
    try {
      const b = await api.bookings.create({ memberId: memberId.trim(), classId });
      toast.success(`${b.memberName} is booked into ${b.className}.`);
      setLookupId(memberId.trim());
      setLookupInput(memberId.trim());
      bookings.reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (b) => {
    if (!window.confirm(`Cancel ${b.memberName}'s booking for ${b.className}?`)) return;
    try {
      await api.bookings.cancel(b.id, b.memberId);
      toast.success('Booking cancelled.');
      bookings.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="staff-page">
      <header className="staff-page__head">
        <div>
          <h1 className="staff-page__title display">Bookings</h1>
          <p className="muted">Book a member into a class at the desk, or look up their bookings to help them cancel.</p>
        </div>
      </header>

      <div className="two-col">
        <form className="panel" onSubmit={book} noValidate>
          <h2 className="panel-title">Book a class</h2>
          {classes.usingSample && <p className="muted small">API offline — class list shows sample data.</p>}
          <Field label="Member ID" name="memberId" required value={memberId} onChange={(_, v) => setMemberId(v)} help="From the member’s profile (member.member_id)." />
          <Field
            label="Class"
            name="classId"
            type="select"
            required
            value={classId}
            onChange={(_, v) => setClassId(v)}
            options={open.map((c) => ({ value: c.id, label: `${c.className} · ${c.categoryName} · starts ${formatDate(c.startDate)}` }))}
          />
          {formError && <p className="field__error" role="alert">{formError}</p>}
          <Button type="submit" disabled={saving}>{saving ? 'Booking…' : 'Book class'}</Button>
        </form>

        <section className="panel">
          <h2 className="panel-title">Find a member’s bookings</h2>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              setLookupId(lookupInput.trim());
            }}
          >
            <Field label="Member ID" name="lookup" value={lookupInput} onChange={(_, v) => setLookupInput(v)} />
            <Button type="submit" variant="secondary">Look up</Button>
          </form>

          {!lookupId ? (
            <p className="muted">Enter a member ID to see their bookings.</p>
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
                !bookings.error && <EmptyState title="No bookings for this member" />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
