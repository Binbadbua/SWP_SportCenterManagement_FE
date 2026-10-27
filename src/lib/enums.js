// Mirrors SWP_SportCenter.Repository/Enum/*.cs — the API sends enums as numbers.
// `tone` drives the colour of the status tag in the UI.

const enumOf = (entries) => {
  const byValue = Object.fromEntries(entries.map((e) => [e.value, e]));
  return {
    options: entries,
    label: (v) => byValue[v]?.label ?? String(v ?? ''),
    tone: (v) => byValue[v]?.tone ?? 'neutral',
  };
};

export const AccountRole = enumOf([
  // name = the C# enum name the JWT carries as the role
  { value: 1, key: 'member', name: 'Member', label: 'Học viên' },
  { value: 2, key: 'coach', name: 'Coach', label: 'Huấn luyện viên' },
  { value: 3, key: 'receptionist', name: 'Receptionist', label: 'Lễ tân' },
  { value: 4, key: 'manager', name: 'CenterManager', label: 'Quản lý trung tâm' },
]);

export const AccountStatus = enumOf([
  { value: 1, label: 'Hoạt động', tone: 'success' },
  { value: 2, label: 'Ngưng hoạt động', tone: 'neutral' },
  { value: 3, label: 'Bị khóa', tone: 'danger' },
]);

export const AttendanceStatus = enumOf([
  { value: 1, label: 'Có mặt', tone: 'success' },
  { value: 2, label: 'Vắng', tone: 'danger' },
  { value: 3, label: 'Đi muộn', tone: 'warning' },
]);

export const BookingStatus = enumOf([
  { value: 1, label: 'Đã đặt', tone: 'info' },
  { value: 2, label: 'Đã tham gia', tone: 'success' },
  { value: 3, label: 'Đã hủy', tone: 'neutral' },
  // Class fees (CHANGELOG Part B, B53): a web booking holds its place while reception waits for the money
  { value: 4, label: 'Chờ thanh toán', tone: 'warning' },
]);

export const ClassStatus = enumOf([
  { value: 1, label: 'Sắp khai giảng', tone: 'info' },
  { value: 2, label: 'Đang diễn ra', tone: 'success' },
  { value: 3, label: 'Đã kết thúc', tone: 'neutral' },
  { value: 4, label: 'Đã hủy', tone: 'danger' },
]);

export const InvoiceStatus = enumOf([
  { value: 1, label: 'Chờ thanh toán', tone: 'warning' },
  { value: 2, label: 'Đã thanh toán', tone: 'success' },
  { value: 3, label: 'Đã hủy', tone: 'neutral' },
  // A paid class cancelled before its first session (B53)
  { value: 4, label: 'Đã hoàn tiền', tone: 'neutral' },
]);

export const MembershipStatus = enumOf([
  { value: 1, label: 'Còn hiệu lực', tone: 'success' },
  { value: 2, label: 'Chưa kích hoạt', tone: 'neutral' },
  { value: 3, label: 'Hết hạn', tone: 'danger' },
  { value: 4, label: 'Đã hủy', tone: 'neutral' },
]);

export const PaymentMethod = enumOf([
  { value: 1, label: 'Tiền mặt' },
  { value: 2, label: 'Chuyển khoản' },
  { value: 3, label: 'Thẻ' },
]);

export const RoomStatus = enumOf([
  { value: 1, label: 'Sẵn sàng', tone: 'success' },
  { value: 2, label: 'Tạm ngưng', tone: 'danger' },
]);

// Members' gender is stored as the English word; the website shows it in Vietnamese
export const Gender = enumOf([
  { value: 'Male', label: 'Nam' },
  { value: 'Female', label: 'Nữ' },
  { value: 'Other', label: 'Khác' },
]);

// Online payment of a package (GET /api/payments/{id}), from the invoice behind it
export const PaymentStatus = enumOf([
  { value: 1, label: 'Chờ thanh toán', tone: 'warning' },
  { value: 2, label: 'Thành công', tone: 'success' },
  { value: 3, label: 'Thất bại', tone: 'danger' },
  { value: 4, label: 'Đã hủy', tone: 'neutral' },
]);

// SWP_SportCenter.Repository/Entity/SupportRequest.cs
export const SupportRequestStatus = enumOf([
  { value: 1, label: 'Mới gửi', tone: 'warning' },
  { value: 2, label: 'Đang xử lý', tone: 'info' },
  { value: 3, label: 'Đã giải quyết', tone: 'success' },
  { value: 4, label: 'Đã hủy', tone: 'neutral' },
]);
