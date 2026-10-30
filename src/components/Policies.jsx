import { Link } from 'react-router-dom';
import { FRONT_DESK_PHONE } from '../lib/contact.js';

// The member terms and privacy policy people agree to (Register, Checkout), each shown on its own page
// (pages/store/Policy.jsx). Keep them true to how the site works; a rule the center adds goes here too.
export const POLICY_UPDATED = '30/10/2026';

export const POLICIES = {
  terms: {
    path: '/terms',
    title: 'Điều khoản thành viên',
    lead: 'Áp dụng cho mọi tài khoản học viên của SportCenter: tài khoản, gói tập, đặt lớp, điểm danh và nội quy.',
    items: [
      ['Tài khoản', 'Mỗi người dùng một tài khoản, khai đúng họ tên, email, số điện thoại và ngày sinh. Bạn tự giữ bí mật mật khẩu; thao tác bằng tài khoản của bạn được xem là do bạn thực hiện.'],
      ['Gói tập và thẻ thành viên', 'Mỗi gói dùng cho mọi môn: trong thời hạn thẻ, tính từ ngày bắt đầu, bạn tự tập không giới hạn ở khu gym, cardio và hồ bơi; lễ tân kiểm tra thẻ và ghi lượt vào khi bạn đến. Thẻ chỉ dùng cho chính chủ tài khoản. Đơn đặt trên web thanh toán trực tuyến, không trả tại quầy; đến trực tiếp thì mua tại quầy lễ tân. Hóa đơn lưu ở Tài khoản của tôi → Hóa đơn.'],
      ['Gia hạn và nâng cấp', 'Gia hạn: thẻ mới bắt đầu ngay sau ngày thẻ cũ hết hạn. Nâng cấp: chỉ lên gói dài hơn; gói mới có hiệu lực ngay hôm nay, thẻ cũ kết thúc hôm nay, và giá trị còn lại của thẻ cũ (số đã trả × số ngày còn lại ÷ số ngày của thẻ, làm tròn xuống nghìn đồng) được trừ vào giá gói mới.'],
      ['Đặt lớp', 'Lớp học không thu thêm phí ngoài thẻ thành viên: để đặt lớp, bạn cần một thẻ còn hiệu lực vào ngày của buổi học kế tiếp, và các buổi sau ngày thẻ hết hạn chỉ học được khi đã gia hạn. Chỉ đặt được lớp chưa bắt đầu; một lần đặt giữ chỗ cho mọi buổi của lớp. Lớp đã đủ chỗ hoặc đã kết thúc không nhận đặt thêm. Bạn tự hủy trên web bất cứ lúc nào; lớp đã bắt đầu thì sau khi hủy không đặt lại được.'],
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
      ['Thanh toán đơn mua trên web', 'Đơn mua trên web hiển thị mã VietQR của SePay; bạn chuyển khoản bằng ứng dụng ngân hàng. Trung tâm nhận thông báo giao dịch để xác nhận đơn, không thu thập mật khẩu hay thông tin đăng nhập ngân hàng.'],
      ['Bảo vệ', 'Mật khẩu được mã hóa một chiều trước khi lưu, dữ liệu truyền qua kết nối HTTPS, phiên đăng nhập tự hết hạn sau 2 giờ.'],
      ['Quyền của bạn', `Xem và sửa thông tin ở Tài khoản của tôi → Hồ sơ; yêu cầu khóa hoặc xóa tài khoản qua mục Hỗ trợ hoặc lễ tân (${FRONT_DESK_PHONE}).`],
    ],
  },
};

// The member terms that change once classes have fees (CHANGELOG Part B, B53); pages/store/Policy.jsx swaps them in
export const TERMS_WITH_CLASS_FEES = {
  'Gói tập và thẻ thành viên': 'Mỗi gói dùng cho mọi môn: trong thời hạn thẻ, tính từ ngày bắt đầu, bạn tự tập không giới hạn ở khu gym, cardio và hồ bơi và được giảm học phí mọi lớp theo mức của gói; lễ tân kiểm tra thẻ và ghi lượt vào khi bạn đến. Thẻ chỉ dùng cho chính chủ tài khoản. Đơn đặt trên web thanh toán trực tuyến, không trả tại quầy; đến trực tiếp thì mua tại quầy lễ tân. Hóa đơn lưu ở Tài khoản của tôi → Hóa đơn.',
  'Đặt lớp': 'Mỗi lớp có học phí cả khóa, trả một lần khi đặt; chỉ đặt được lớp chưa bắt đầu. Thẻ thành viên còn hiệu lực vào ngày thanh toán được giảm theo gói; không có thẻ thì trả giá gốc, và mua gói sau khi đã trả học phí không được hoàn phần chênh lệch. Đặt trên web thì thanh toán trực tuyến; chỗ được giữ trong lúc chờ thanh toán (15 phút với SePay), quá hạn lượt đặt tự hủy và chỗ được trả lại. Lớp đã đủ chỗ hoặc đã kết thúc không nhận đặt thêm.',
  'Hoàn tiền, bảo lưu': 'Hủy lớp đã thanh toán trước khi lớp bắt đầu: hoàn đủ học phí (qua lễ tân bằng chuyển khoản hoặc tiền mặt, tại quầy nếu bạn trả tại quầy). Lớp đã bắt đầu: vẫn hủy được nhưng không hoàn học phí và không đặt lại được. Lượt đặt chưa thanh toán hủy lúc nào cũng được, chưa bị trừ tiền. Thẻ thành viên và bảo lưu: gửi yêu cầu ở Tài khoản của tôi → Hỗ trợ; lễ tân xem xét từng trường hợp và trả lời tại đó.',
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
