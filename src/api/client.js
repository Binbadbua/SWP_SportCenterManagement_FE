// Thin fetch wrapper for the ASP.NET Core API.
// - In development, leave VITE_API_BASE_URL empty: Vite proxies /api to the back-end (see vite.config.js).
// - In production, set VITE_API_BASE_URL to the API origin, e.g. https://api.example.com

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

// A link the API hands back as a path ("/api/payments/…") points at the API, not at this site
export const apiUrl = (path) => (/^https?:\/\//i.test(path) ? path : BASE_URL + path);

export class ApiError extends Error {
  constructor(message, { status = 0, offline = false, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.offline = offline; // true when the back-end could not be reached at all
    this.details = details;
  }
}

const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// The API has no exception handler: a service that throws comes back as HTTP 500 with a plain-text
// stack trace ("System.Exception: Lớp học không tồn tại.\n   at ..."). Keep only the message.
function messageFromText(text) {
  const firstLine = (text ?? '').split('\n')[0].trim();
  if (!firstLine || firstLine.startsWith('<')) return null; // empty or an HTML error page
  return firstLine.replace(/^[\w.]+Exception:\s*/, '') || null;
}

// Messages the API still writes in English, as the website shows them
const VI_MESSAGES = {
  'Invalid username or password': 'Sai tên đăng nhập hoặc mật khẩu.',
  'Account is not active': 'Tài khoản đang bị khóa hoặc chưa hoạt động.',
  'Username already exists': 'Tên đăng nhập này đã có người dùng.',
  'Email already exists': 'Email này đã được sử dụng.',
  'Account not found': 'Không tìm thấy tài khoản.',
  'Invalid account identity': 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.',
  'Account ID not found in token': 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.',
  'Member not found': 'Không tìm thấy học viên.',
  'Member profile not found': 'Không tìm thấy hồ sơ học viên.',
  'Membership not found': 'Không tìm thấy thẻ thành viên.',
  'Membership package not found': 'Không tìm thấy gói tập.',
  'Class not found': 'Không tìm thấy lớp học.',
  'Class session not found': 'Không tìm thấy buổi học.',
  'Coach not found': 'Không tìm thấy huấn luyện viên.',
  'Center manager not found': 'Không tìm thấy quản lý.',
  'Training plan not found': 'Không tìm thấy kế hoạch tập luyện.',
  'Training result not found': 'Không tìm thấy kết quả tập luyện.',
  'Invoice not found': 'Không tìm thấy hóa đơn.',
  'Booking not found': 'Không tìm thấy lượt đặt lớp.',
  'Attendance not found': 'Không tìm thấy điểm danh.',
  'Audit log not found': 'Không tìm thấy nhật ký.',
  'Package name is required': 'Vui lòng nhập tên gói.',
  'Price cannot be negative': 'Giá không được âm.',
  'Duration must be greater than 0': 'Số ngày phải lớn hơn 0.',
  'Training plan title is required': 'Vui lòng nhập tiêu đề kế hoạch.',
  'Coach comment is required': 'Vui lòng nhập nhận xét.',
  'Member does not belong to this training plan': 'Học viên này không thuộc kế hoạch tập luyện đã chọn.',
  'StartDate must be before or equal to EndDate': 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
  'PageSize and PageIndex must be greater than 0': 'Tham số phân trang không hợp lệ.',
};
const toVietnamese = (message) => {
  const key = String(message ?? '').trim().replace(/\.$/, '');
  if (VI_MESSAGES[key]) return VI_MESSAGES[key];
  if (/^You can only .* your own training (plan|result)$/.test(key)) return 'Bạn chỉ được thao tác trên kế hoạch và kết quả của chính mình.';
  const required = key.match(/^The (\w+) field is required$/);
  if (required) return `Vui lòng nhập ${required[1]}.`;
  if (/^The JSON value could not be converted/.test(key)) return 'Dữ liệu gửi lên không hợp lệ.';
  return message;
};

// ASP.NET Core returns ProblemDetails: { title, detail } or validation { errors: { Field: [msg] } },
// some actions return a plain string (NotFound("...")) or { message }.
function messageFrom(body, status, text) {
  if (body?.errors && typeof body.errors === 'object') {
    const first = Object.values(body.errors).flat().filter(Boolean);
    if (first.length) return first.join(' ');
  }
  if (typeof body === 'string' && body) return body;
  if (body?.message) return body.message;
  if (body?.detail) return body.detail;
  if (body?.title) return body.title;
  const fromText = body === null ? messageFromText(text) : null;
  if (fromText) return fromText;
  if (status === 401) return 'Vui lòng đăng nhập để xem nội dung này.';
  if (status === 403) return 'Tài khoản của bạn không có quyền thực hiện thao tác này (HTTP 403).';
  if (status === 404) return 'Không tìm thấy dữ liệu.';
  return `Yêu cầu thất bại (HTTP ${status}).`;
}

export async function request(method, path, body) {
  let res;
  
  // 1. Chuẩn bị Headers cơ bản
  // A file upload goes as FormData: the browser writes the multipart Content-Type (with its boundary) itself
  const form = body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !form) {
    headers['Content-Type'] = 'application/json';
  }

  // 2. Lấy Token từ localStorage và đính kèm vào Authorization Header
  const token = localStorage.getItem('sportcenter.token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers, // Sử dụng bộ headers đã được đính kèm Token
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra máy chủ rồi thử lại.', { offline: true });
  }

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? parse(text) : null;

  if (!res.ok) {
    // The Vite dev proxy answers 502 when the back-end is down; Render answers 502/503/504 while it starts.
    // A 500 comes from the API itself (see messageFromText), so it is a real error, not "offline"; so is a
    // 502 that carries the API's JSON message (the photo store could not be reached).
    const offline = [502, 503, 504].includes(res.status) && !data?.message;
    if (offline) {
      throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra máy chủ rồi thử lại.', { status: res.status, offline: true });
    }
    throw new ApiError(toVietnamese(messageFrom(data, res.status, text)), { status: res.status, details: data });
  }
  return data;
}

export const http = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  del: (path) => request('DELETE', path),
};