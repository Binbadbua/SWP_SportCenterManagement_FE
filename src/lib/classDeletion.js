import { classRunning } from './classes.js';

const hasCount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Only an explicit zero can unlock the running-class exception; absence is not an empty roster.
export function classDeletionLock(row) {
  if (!classRunning(row)) return null;
  if (!hasCount(row.currentEnrolled)) return 'Chưa xác định được số học viên và chỗ đang giữ; tải lại trước khi xóa lớp đang diễn ra.';
  return row.currentEnrolled > 0 ? 'Lớp đang diễn ra có học viên hoặc chỗ chờ thanh toán nên không được xóa.' : null;
}

// The deployed list endpoints currently return arrays. A paged response must prove that every row is present.
export function completeDeletionRows(body, label) {
  if (Array.isArray(body)) return body;
  const rows = body?.data ?? body?.items;
  const total = body?.totalItems ?? body?.totalCount ?? body?.total;
  if (!Array.isArray(rows) || !Number.isFinite(total) || total !== rows.length) {
    throw new Error('Chưa tải đủ ' + label + ' để kiểm tra an toàn. Vui lòng tải lại; chưa gửi yêu cầu xóa.');
  }
  return rows;
}

export function assertClassCanBeDeleted(row, roster, invoices) {
  if (!row?.id) throw new Error('Không xác định được lớp cần xóa.');
  const lock = classDeletionLock(row);
  if (lock) throw new Error(lock);
  if (hasCount(row.currentEnrolled) && row.currentEnrolled > 0) throw new Error('Lớp còn học viên hoặc chỗ chờ thanh toán nên không được xóa.');
  if (row.hasBookings === true || Number(row.bookingCount ?? 0) > 0) throw new Error('Lớp đã có lịch sử đăng ký nên không được xóa.');
  if (!Array.isArray(roster) || !Array.isArray(invoices)) throw new Error('Chưa kiểm tra đủ danh sách học viên và hóa đơn; chưa gửi yêu cầu xóa.');
  if (roster.length) throw new Error('Lớp có học viên hoặc lịch sử đăng ký trong danh sách; hãy giữ lớp để bảo toàn dữ liệu.');
  const financial = invoices.some(invoice => invoice.classId === row.id || (!invoice.classId && invoice.className && invoice.className === row.className));
  if (financial) throw new Error('Lớp đã có hóa đơn hoặc lịch sử thanh toán/hoàn tiền nên không được xóa.');
}

export function classDeletionSession() {
  try {
    const token = globalThis.localStorage?.getItem('sportcenter.token') ?? null;
    const user = JSON.parse(globalThis.localStorage?.getItem('sportcenter.session') ?? 'null');
    return { token, accountId: user?.accountId ?? null, role: user?.role ?? user?.Role ?? null };
  } catch { return { token: null, accountId: null, role: null }; }
}

export function assertClassDeletionSession(original) {
  const current = classDeletionSession();
  if (original.token !== current.token || original.accountId !== current.accountId || original.role !== current.role) {
    throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại lớp và xác nhận xóa trong phiên hiện tại.');
  }
}
