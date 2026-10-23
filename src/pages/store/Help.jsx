import { Button } from '../../components/ui.jsx';

const FAQ = [
  ['Làm sao để đặt lớp?', 'Mở trang lớp, xem các buổi học rồi bấm “Đặt lớp này”. Một lần đặt là tham gia được mọi buổi của lớp đó.'],
  ['Tôi có hủy được không?', 'Được, ở Tài khoản của tôi → Lớp đã đặt, trước khi bạn học buổi đầu tiên. Sau đó, hãy nhờ lễ tân.'],
  ['Nếu lớp đã đủ người thì sao?', 'Trang lớp có ghi số chỗ còn lại. Hết chỗ thì không đặt được nữa, bạn hãy xem các lớp khác cùng môn.'],
  ['Thanh toán gói tập thế nào?', 'Ở trang Gói tập, bấm “Chọn” ở gói bạn muốn để sang trang xác nhận và thanh toán trực tuyến (chuyển khoản hoặc thẻ). Bạn cũng có thể thanh toán tại quầy lễ tân: nhân viên kích hoạt thẻ và xuất hóa đơn ngay.'],
  ['Ai điểm danh cho tôi?', 'Huấn luyện viên điểm danh có mặt hoặc vắng ở mỗi buổi. Bạn xem lại ở Tài khoản của tôi → Điểm danh.'],
  ['Tôi đổi mật khẩu ở đâu?', 'Ở Tài khoản của tôi → Hồ sơ, mục Mật khẩu: nhập mật khẩu hiện tại rồi mật khẩu mới.'],
  ['Cần hỗ trợ khác?', 'Gửi yêu cầu ở Tài khoản của tôi → Hỗ trợ. Lễ tân sẽ trả lời ngay tại đó và bạn theo dõi được trạng thái.'],
];

export default function Help() {
  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1 className="page-title display">Trợ giúp</h1>
        <p className="page-lead">Giải đáp những câu hỏi lễ tân hay nhận được nhất.</p>
      </header>
      <div className="accordions">
        {FAQ.map(([q, a], i) => (
          <details key={q} open={i === 0}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <div className="block">
        <Button to="/classes" variant="secondary">Xem các lớp học</Button>{' '}
        <Button to="/account?tab=support">Hỏi lễ tân</Button>
      </div>
    </div>
  );
}
