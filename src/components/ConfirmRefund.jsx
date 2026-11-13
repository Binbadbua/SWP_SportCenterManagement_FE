import { useEffect, useRef, useState } from 'react';
import { api } from '../api/endpoints.js';
import { formatMoney } from '../lib/format.js';
import { useToast } from './Toast.jsx';
import { Button, Field, Notice } from './ui.jsx';
import '../styles/refund-guide.css';

// Recording an actual payout; this endpoint does not itself transfer money.
export default function ConfirmRefund({ invoice, onDone, onClose }) {
  const toast = useToast();
  const [reference, setReference] = useState('');
  const [returned, setReturned] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  const currentInvoice = useRef(invoice?.id);
  currentInvoice.current = invoice?.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [error, setError] = useState(null);
  const amount = Number(invoice?.refundAmount ?? invoice?.amount);
  const valid = Number.isFinite(amount) && amount > 0 && !!invoice?.refundPending;
  const save = async (event) => {
    event.preventDefault();
    if (running.current) return;
    if (!valid) return setError('Hóa đơn không có khoản hoàn đang chờ hợp lệ. Hãy tải lại danh sách.');
    if (!returned) return setError('Chỉ xác nhận sau khi đã thực sự trả tiền cho học viên.');
    const value = reference.trim();
    if (!value) return setError('Vui lòng nhập mã giao dịch hoặc số phiếu hoàn tiền.');
    if (value.length > 200) return setError('Mã xác nhận tối đa 200 ký tự.');
    const tokenAtStart = (() => { try { return localStorage.getItem('sportcenter.token'); } catch { return null; } })();
    const invoiceAtStart = invoice.id;
    const stillCurrent = () => mounted.current && currentInvoice.current === invoiceAtStart && (() => { try { return localStorage.getItem('sportcenter.token'); } catch { return null; } })() === tokenAtStart;
    running.current = true; setBusy(true); setError(null);
    try {
      const fresh = await api.invoices.get(invoice.id);
      if (!stillCurrent()) return;
      const currentAmount = Number(fresh?.refundAmount ?? fresh?.amount);
      if (!fresh?.refundPending || !Number.isFinite(currentAmount) || currentAmount !== amount) {
        throw new Error('Yêu cầu hoàn tiền đã thay đổi hoặc được xử lý. Hãy đóng và tải lại hóa đơn trước khi xác nhận.');
      }
      await api.payments.refundConfirm(invoice.id, value);
      if (!stillCurrent()) return;
      toast.success('Đã xác nhận hoàn ' + formatMoney(amount) + ' cho ' + invoice.memberName + '.');
      onClose?.();
      await onDone?.();
    } catch (err) {
      if (stillCurrent()) setError(err.message);
    } finally {
      running.current = false; if (mounted.current) setBusy(false);
    }
  };
  return (
    <form onSubmit={save} noValidate>
      <Notice tone="warning" title="Thực hiện trả tiền trước, ghi xác nhận sau">
        Hoàn {Number.isFinite(amount) ? formatMoney(amount) : 'số tiền cần kiểm tra'} cho {invoice?.memberName} bằng chuyển khoản ngân hàng hoặc tiền mặt.
        SePay không tự chuyển khoản hoàn tiền. Nút bên dưới chỉ ghi nhận khoản bạn đã trả.
      </Notice>
      <Field label="Mã giao dịch hoặc số phiếu hoàn tiền" name="refundReference" value={reference}
        onChange={(_name, value) => { setReference(value); setError(null); }} required maxLength={200}
        error={error} help="Dùng mã giao dịch ngân hàng hoặc số phiếu chi thật để đối chiếu, không nhập mã giả chỉ để demo trạng thái." />
      <label className="refund-confirm-check">
        <input type="checkbox" checked={returned} onChange={e => setReturned(e.target.checked)} disabled={busy} />
        <span>Tôi đã trả đúng số tiền trên cho học viên và đã đối chiếu chứng từ.</span>
      </label>
      <div className="form-actions">
        <Button type="submit" disabled={busy || !returned || !valid}>{busy ? 'Đang xác nhận…' : 'Ghi nhận đã hoàn tiền'}</Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Đóng</Button>
      </div>
    </form>
  );
}
