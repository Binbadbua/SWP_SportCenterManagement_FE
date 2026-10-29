import Modal from './Modal.jsx';
import { Button, Notice } from './ui.jsx';
import { cancelTerms } from '../lib/classes.js';

// Asks before a member cancels a class booking and says plainly what they get back (lib/classes.js → cancelTerms):
// a started class gets a warning that nothing is refunded. `booking` null = closed.
export default function CancelBooking({ booking, started, busy, onConfirm, onClose }) {
  const terms = booking ? cancelTerms(booking, started) : null;
  const harsh = terms?.tone === 'danger';
  return (
    <Modal
      open={!!booking}
      title={booking?.status === 4 ? 'Hủy lượt đặt đang chờ thanh toán?' : `Hủy đặt lớp ${booking?.className ?? ''}?`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Giữ lớp</Button>
          <Button variant={harsh ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Đang hủy…' : harsh && Number(booking?.price ?? 0) > 0 ? 'Vẫn hủy, không hoàn tiền' : harsh ? 'Vẫn hủy' : 'Hủy đặt lớp'}
          </Button>
        </>
      }
    >
      {terms && (
        <Notice tone={harsh ? 'warning' : 'info'} title={terms.title}>
          {terms.text}
        </Notice>
      )}
    </Modal>
  );
}
