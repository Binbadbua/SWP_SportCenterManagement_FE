import { addDaysToDateInput, formatDate, todayCenterDateString } from './format.js';

const DAY_MS = 86400000;
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const validDay = day => isoDay.test(String(day)) && Number.isFinite(Date.parse(day + 'T00:00:00Z')) && new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day;
const dayValue = day => Date.parse(day + 'T00:00:00Z');

export function revenueDay(value) {
  if (!value) return null;
  const text = String(value);
  if (isoDay.test(text)) return validDay(text) ? text : null;

  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(text)) return null;
  const instant = new Date(text);
  return Number.isFinite(instant.getTime()) ? todayCenterDateString(instant) : null;
}

export function validateRevenueRange(from, to, grain = 'day') {
  if (!validDay(from) || !validDay(to)) return 'Vui lòng nhập ngày bắt đầu và kết thúc hợp lệ.';
  if (from > to) return 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
  const days = Math.round((dayValue(to) - dayValue(from)) / DAY_MS) + 1;
  if (days > 3660) return 'Vui lòng chọn khoảng báo cáo tối đa 10 năm.';
  if (!['day', 'week', 'month'].includes(grain)) return 'Cách nhóm thời gian không hợp lệ.';
  return null;
}

export function revenuePeriod(day, grain) {
  if (grain === 'month') return { key: day.slice(0, 7), label: day.slice(5, 7) + '/' + day.slice(0, 4) };
  if (grain === 'week') {
    const weekday = new Date(day + 'T00:00:00Z').getUTCDay();
    const start = addDaysToDateInput(day, -(weekday === 0 ? 6 : weekday - 1));
    return { key: start, label: formatDate(start) + ' – ' + formatDate(addDaysToDateInput(start, 6)) };
  }
  return { key: day, label: formatDate(day) };
}

export function revenueInvoiceInfo(invoice, classes = []) {
  const cls = classes.find(item => item.id === invoice.classId);
  const kind = String(invoice.kind ?? '').toLowerCase();
  const isClass = kind === 'class' || !!invoice.classId || !!invoice.classBookingId;
  const isMembership = !isClass && (kind === 'membership' || kind === 'upgrade' || !!invoice.memberMembershipId);
  return {
    invoice,
    kind: isClass ? 'class' : isMembership ? 'membership' : 'unknown',
    classId: isClass ? invoice.classId ?? '' : '',
    className: isClass ? invoice.className || cls?.className || 'Lớp chưa xác định' : isMembership ? 'Gói tập / nâng cấp' : 'Chưa xác định nội dung',
    categoryId: isClass ? invoice.categoryId ?? cls?.categoryId ?? '' : '',
    categoryName: isClass ? invoice.categoryName || cls?.categoryName || 'Chưa xác định môn' : isMembership ? 'Gói tập (không phân bổ theo môn)' : 'Chưa xác định nội dung',
  };
}

const money = value => value !== null && value !== undefined && !(typeof value === 'string' && !value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const empty = () => ({ gross: 0, refunds: 0, net: 0, receiptCount: 0, refundCount: 0, pendingRefund: 0, pendingCount: 0 });
const add = (target, item) => {
  for (const key of Object.keys(empty())) if (key !== 'net') { target[key] += item[key] ?? 0; if (!Number.isSafeInteger(target[key])) target.unsafe = true; }
  target.net = target.gross - target.refunds;
  if (!Number.isSafeInteger(target.net)) target.unsafe = true;
};

export function buildRevenueReport(invoices, classes, options) {
  const { from, to, grain = 'day', basis = 'cohort', dimension = 'time', kind = 'all', categoryId = '', classId = '' } = options;
  const error = validateRevenueRange(from, to, grain);
  if (error) return { error, rows: [], totals: empty(), cashAvailable: false, issues: [] };
  const seen = new Set();
  const issues = [];
  const selected = [];
  for (const invoice of invoices ?? []) {
    const id = invoice.id ?? invoice.invoiceId;
    if (!id || seen.has(id)) {
      issues.push({ code: !id ? 'missingId' : 'duplicate', invoiceId: id ?? null });
      continue;
    }
    seen.add(id);
    const item = revenueInvoiceInfo(invoice, classes);
    if (kind !== 'all' && item.kind !== kind) continue;
    if (categoryId && (item.kind !== 'class' || (categoryId === '__unknown' ? !!item.categoryId : item.categoryId !== categoryId))) continue;
    if (classId && (item.kind !== 'class' || item.classId !== classId)) continue;
    const status = Number(invoice.status);
    if (status !== 2 && status !== 4) continue;
    const amount = money(invoice.amount);
    if (amount === null) { issues.push({ code: 'invalidAmount', invoiceId: id }); continue; }
    const paidDay = revenueDay(invoice.paidAt ?? invoice.paymentDate);
    const confirmed = status === 4 && !invoice.refundPending;
    let refund = 0;
    if (confirmed) {
      refund = invoice.refundAmount == null ? amount : money(invoice.refundAmount);
      if (refund === null || refund > amount || (amount > 0 && refund === 0)) {
        issues.push({ code: 'invalidRefund', invoiceId: id }); continue;
      }
    }
    const refundDay = confirmed && refund > 0 ? revenueDay(invoice.refundedAt ?? invoice.refundConfirmedAt ?? invoice.refundDate) : null;
    let pending = 0;
    if (invoice.refundPending) {
      pending = money(invoice.requestedRefundAmount ?? invoice.refundAmount ?? amount);
      if (pending === null || pending > amount) { issues.push({ code: 'invalidPendingRefund', invoiceId: id }); pending = 0; }
    }
    if (!paidDay) issues.push({ code: 'missingPaymentDate', invoiceId: id, amount });
    if (confirmed && refund > 0 && !refundDay) issues.push({ code: 'missingRefundDate', invoiceId: id, amount: refund });
    selected.push({ ...item, id, amount, paidDay, refundDay, refund, pending, confirmed });
  }
  const cashAvailable = !issues.some(item => ['missingPaymentDate', 'missingRefundDate', 'invalidAmount', 'invalidRefund', 'missingId', 'duplicate'].includes(item.code));
  const result = { rows: [], totals: empty(), cashAvailable, issues, selectedCount: selected.length, unknownCategories: selected.filter(item => item.kind === 'class' && !item.categoryId).length, implicitFullRefundCount: selected.filter(item => item.confirmed && item.invoice.refundAmount == null).length };
  if (basis === 'cash' && !cashAvailable) return { ...result, error: 'Chưa đủ dữ liệu ngày thực thu/thực hoàn để lập báo cáo dòng tiền theo ngày phát sinh.' };

  const groups = new Map();
  const groupOf = (item, day) => {
    if (dimension === 'sport') return { key: item.kind === 'class' ? 'sport:' + (item.categoryId || '__unknown') : item.kind, label: item.categoryName };
    if (dimension === 'class') return { key: item.kind === 'class' ? 'class:' + (item.classId || '__unknown') : item.kind, label: item.classId ? item.className : item.kind === 'class' ? 'Lớp chưa có ID (chưa phân loại)' : item.className, sublabel: item.kind === 'class' ? item.categoryName : '' };
    return revenuePeriod(day, grain);
  };
  const push = (item, day, values) => {
    if (!day || day < from || day > to) return;
    const group = groupOf(item, day);
    if (!groups.has(group.key)) groups.set(group.key, { ...group, ...empty() });
    add(groups.get(group.key), values);
    add(result.totals, values);
  };

  for (const item of selected) {
    if (basis === 'cash') {
      push(item, item.paidDay, { gross: item.amount, receiptCount: 1, pendingRefund: item.pending, pendingCount: item.invoice.refundPending ? 1 : 0 });
      if (item.confirmed) push(item, item.refundDay, { refunds: item.refund, refundCount: 1 });
    } else {
      push(item, item.paidDay, { gross: item.amount, refunds: item.refund, receiptCount: 1, refundCount: item.confirmed ? 1 : 0, pendingRefund: item.pending, pendingCount: item.invoice.refundPending ? 1 : 0 });
    }
  }
  if (dimension === 'time') {
    for (let day = from; day <= to; day = addDaysToDateInput(day, 1)) {
      const period = revenuePeriod(day, grain);
      if (!groups.has(period.key)) groups.set(period.key, { ...period, ...empty() });
    }
  }
  if (result.totals.unsafe || [...groups.values()].some(row => row.unsafe)) return { ...result, error: 'Tổng số tiền vượt giới hạn tính chính xác; cần chia nhỏ khoảng báo cáo.', issues: [...issues, { code: 'unsafeTotal' }], rows: [], totals: empty() };
  result.rows = [...groups.values()].sort((a, b) => dimension === 'time' ? b.key.localeCompare(a.key) : b.net - a.net || a.label.localeCompare(b.label, 'vi'));
  return result;
}

export function revenueCsv(report, { from, to, basis, dimension }) {
  const cell = value => {
    if (typeof value === 'number') return String(value);
    let text = String(value ?? '');
    if (/^\s*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    ['Khoảng báo cáo', from, to],
    ['Cơ sở', basis === 'cash' ? 'Dòng tiền thực thu / thực hoàn' : 'Kỳ thu tiền, trừ hoàn của hóa đơn thuộc kỳ'],
    ['Chất lượng dữ liệu', report.issues.some(item => item.code !== 'missingRefundDate') ? 'Có dòng thiếu/không hợp lệ; các số chỉ là phần xác định được' : 'Đủ dữ liệu cho cơ sở báo cáo đã chọn'],
    [dimension === 'time' ? 'Kỳ' : dimension === 'sport' ? 'Môn / nội dung' : 'Lớp / nội dung', 'Số hóa đơn đã thu', 'Tổng đã thu', 'Đã hoàn', 'Thu sau hoàn', 'Đơn đã hoàn', 'Chờ hoàn của hóa đơn trong kỳ'],
    ...report.rows.map(row => [row.label, row.receiptCount, row.gross, row.refunds, row.net, row.refundCount, row.pendingRefund]),
    ['Tổng', report.totals.receiptCount, report.totals.gross, report.totals.refunds, report.totals.net, report.totals.refundCount, report.totals.pendingRefund],
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
