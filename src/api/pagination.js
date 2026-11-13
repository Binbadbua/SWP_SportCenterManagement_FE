// Read complete paged collections for reports/training. Never silently total only the first page.
const countOf = (value, label) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Thông tin phân trang ' + label + ' không hợp lệ. Chưa thể xác nhận dữ liệu đầy đủ.');
  return parsed;
};
export async function readAllPages(path, get, { pageSize = 100, maxPages = 100 } = {}) {
  const rows = [], seen = new Set();
  let expectedTotal;
  const uri = new URL(path, 'https://pagination.invalid');
  uri.searchParams.set('pageSize', String(pageSize));
  for (let page = 1; page <= maxPages; page++) {
    uri.searchParams.set('pageIndex', String(page));
    const body = await get(uri.pathname + uri.search);
    // The current invoice collection returns one complete plain array by API contract.
    if (Array.isArray(body)) {
      if (page !== 1) throw new Error('Máy chủ đổi định dạng phân trang. Chưa thể xác nhận dữ liệu đầy đủ.');
      return body;
    }
    const batch = body?.items ?? body?.data;
    if (!Array.isArray(batch)) throw new Error('Máy chủ chưa trả danh sách hợp lệ. Vui lòng tải lại.');
    if (body.pageIndex != null && countOf(body.pageIndex, 'pageIndex') !== page) throw new Error('Máy chủ trả sai trang dữ liệu. Vui lòng tải lại.');
    if (body.pageSize != null && countOf(body.pageSize, 'pageSize') < 1) throw new Error('Kích thước trang dữ liệu không hợp lệ.');
    for (const row of batch) {
      const id = row.id ?? row.invoiceId ?? row.trainingPlanId ?? row.trainingResultId;
      if (id != null && seen.has(String(id))) throw new Error('Máy chủ trả trùng trang dữ liệu. Chưa thể xác nhận báo cáo đầy đủ.');
      if (id != null) seen.add(String(id));
      rows.push(row);
    }
    const totalKey = ['totalItems', 'totalCount', 'total'].find(key => Object.prototype.hasOwnProperty.call(body, key));
    if (totalKey) {
      const total = countOf(body[totalKey], totalKey);
      if (expectedTotal !== undefined && total !== expectedTotal) throw new Error('Tổng bản ghi đã thay đổi khi tải. Vui lòng tải lại.');
      expectedTotal = total;
      if (rows.length > total) throw new Error('Tổng bản ghi đã thay đổi khi tải. Vui lòng tải lại.');
      if (rows.length === total) return rows;
      if (!batch.length) throw new Error('Chưa tải đủ bản ghi theo tổng máy chủ trả.');
    } else if (expectedTotal !== undefined) {
      throw new Error('Máy chủ thay đổi thông tin tổng bản ghi khi tải. Vui lòng tải lại.');
    } else if (!batch.length) {
      // A short page is insufficient proof: the server may cap pageSize below what was requested.
      return rows;
    }
  }
  throw new Error('Dữ liệu vượt giới hạn tải an toàn. Cần BE hỗ trợ bộ lọc/báo cáo phân trang.');
}
