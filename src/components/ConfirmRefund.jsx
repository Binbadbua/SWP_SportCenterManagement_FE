import { useState } from 'react';
import { api } from '../api/endpoints.js';
import { formatMoney } from '../lib/format.js';
import { useToast } from './Toast.jsx';
import { Button, Field, Notice } from './ui.jsx';

// SePay does not send a refund: reception records the bank transfer or cash refund after paying it.
export default function ConfirmRefund({ invoice, onDone, onClose }) {
  const toast = useToast();
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    const value = reference.trim();
    if (!value) return setError('Vui lòng nhập mã giao dịch hoặc số phiếu hoàn tiền.');
    if (value.length > 200) return setError('Mã xác nhận tối đa 200 ký tự.');
    setBusy(true);
    setError(null);
    try {
      await api.payments.refundConfirm(invoice.id, value);
      toast.success('Đã xác nhận hoàn tiền cho ' + invoice.memberName + '.');
      onClose?.();
      await onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} noValidate>
      <Notice tone="warning" title="Chỉ xác nhận sau khi đã trả tiền">
        Hoàn {formatMoney(invoice.amount)} cho {invoice.memberName} bằng chuyển khoản hoặc tiền mặt.
        SePay không tự chuyển khoản hoàn tiền. Sau khi bạn xác nhận, hóa đơn mới chuyển sang Đã hoàn tiền.
      </Notice>
      <Field
        label="Mã giao dịch hoặc số phiếu hoàn tiền"
        name="refundReference"
        value={reference}
        onChange={(_name, value) => { setReference(value); setError(null); }}
        required
        maxLength={200}
        error={error}
        help="Ghi lại chứng từ để đối chiếu khoản tiền đã hoàn."
      />
      <div className="form-actions">
        <Button type="submit" disabled={busy}>{busy ? 'Đang xác nhận…' : 'Xác nhận đã hoàn tiền'}</Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Đóng</Button>
      </div>
    </form>
  );
}

