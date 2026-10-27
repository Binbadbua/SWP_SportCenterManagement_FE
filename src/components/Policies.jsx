import { Link } from 'react-router-dom';

// The member terms and privacy policy people agree to (Register, Checkout), each shown on its own page
// (pages/store/Policy.jsx). Keep them true to how the site works; a rule the center adds goes here too.
export const POLICY_UPDATED = '27/10/2026';

export const POLICIES = {
  terms: {
    path: '/terms',
    title: 'Điều khoản thành viên',
    lead: 'Áp dụng cho mọi tài khoản học viên của SportCenter: tài khoản, gói tập, đặt lớp, điểm danh và nội quy.',
    items: [
      ['Tài khoản', 'Mỗi người dùng một tài khoản, khai đúng họ tên, email, số điện thoại và ngày sinh. Bạn tự giữ bí mật mật khẩu; thao tác bằng tài khoản của bạn được xem là do bạn thực hiện.'],
      ['Gói tập và thẻ thành viên', 'Thẻ có hiệu lực theo số ngày của gói, tính từ ngày bắt đầu, và chỉ dùng cho chính chủ tài khoản. Mua tại quầy lễ tân hoặc đặt mua trên web (đơn được giữ 30 phút để lễ tân xác nhận thanh toán); hóa đơn lưu ở Tài khoản của tôi → Hóa đơn.'],
      ['Đặt lớp', 'Lớp học không thu thêm phí ngoài thẻ thành viên: để đặt lớp, bạn cần một thẻ còn hiệu lực vào ngày của buổi học kế tiếp, và các buổi sau ngày thẻ hết hạn chỉ học được khi đã gia hạn. Một lần đặt giữ chỗ cho mọi buổi của lớp. Bạn tự hủy trên web khi chưa học buổi nào; sau đó hãy nhờ lễ tân. Lớp đã đủ chỗ hoặc đã kết thúc không nhận đặt thêm.'],
      ['Điểm danh và tập luyện', 'Huấn luyện viên ghi có mặt hoặc vắng ở từng buổi, cùng kế hoạch và kết quả tập của bạn; bạn xem lại trong tài khoản.'],
      ['Nội quy', 'Đến đúng giờ, làm theo hướng dẫn của huấn luyện viên và nội quy phòng tập. Trung tâm có thể khóa tài khoản khai thông tin giả hoặc vi phạm nội quy.'],
      ['Hoàn tiền, bảo lưu', 'Gửi yêu cầu ở Tài khoản của tôi → Hỗ trợ; lễ tân xem xét từng trường hợp và trả lời tại đó.'],
    ],
  },
  privacy: {
    path: '/privacy',
    title: 'Chính sách bảo mật',
    lead: 'Trung tâm thu thập thông tin gì, dùng để làm gì, ai được xem và bảo vệ thông tin của bạn ra sao.',
    items: [
      ['Thông tin thu thập', 'Họ tên, tên đăng nhập, email, số điện thoại, ngày sinh, giới tính, mục tiêu tập luyện; lịch sử đặt lớp, điểm danh, thẻ thành viên, hóa đơn, kế hoạch và kết quả tập.'],
      ['Mục đích', 'Quản lý tài khoản, đặt lớp, điểm danh, lập kế hoạch tập, xuất hóa đơn và gửi thông báo về lịch học, thay đổi lịch, thời hạn gói.'],
      ['Ai được xem', 'Chỉ nhân viên trung tâm, theo vai trò: lễ tân và quản lý xem hồ sơ, thẻ, hóa đơn; huấn luyện viên xem thông tin cơ bản và mục tiêu tập để lên kế hoạch cho học viên lớp mình dạy. Trung tâm không bán hay chia sẻ thông tin của bạn cho bên khác.'],
      ['Thanh toán đơn mua trên web', 'Web không hỏi số thẻ ngân hàng: bạn chuyển khoản hoặc quẹt thẻ với lễ tân, lễ tân xác nhận đơn. Trung tâm không lưu số thẻ của bạn.'],
      ['Bảo vệ', 'Mật khẩu được mã hóa một chiều trước khi lưu, dữ liệu truyền qua kết nối HTTPS, phiên đăng nhập tự hết hạn sau 2 giờ.'],
      ['Quyền của bạn', 'Xem và sửa thông tin ở Tài khoản của tôi → Hồ sơ; yêu cầu khóa hoặc xóa tài khoản qua mục Hỗ trợ hoặc lễ tân (0900 000 000).'],
    ],
  },
};

// Opens in a new tab so a half-filled form (register, checkout) is still there when the reader comes back
function PolicyLink({ kind }) {
  return (
    <Link className="text-link" to={POLICIES[kind].path} target="_blank" rel="noopener">
      {POLICIES[kind].title}
      <span className="visually-hidden"> (mở trong tab mới)</span>
    </Link>
  );
}

// The words next to an agree checkbox, with the two policies as links. `termsNote` adds a few words
// after the terms link (Checkout points out that refunds are part of them).
export function AgreeToPolicies({ lead = 'Tôi đã đọc và đồng ý với', termsNote = '' }) {
  return (
    <>
      {lead} <PolicyLink kind="terms" />{termsNote && ` ${termsNote}`} và <PolicyLink kind="privacy" /> của trung tâm.
    </>
  );
}
