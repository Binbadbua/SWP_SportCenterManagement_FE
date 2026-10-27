import { useClassPricing } from '../../hooks/usePricing.js';
import { Button } from '../../components/ui.jsx';

const FAQ = [
  ['Làm sao để đặt lớp?', 'Mở trang lớp, xem các buổi học rồi bấm “Đặt lớp này”. Một lần đặt là tham gia được mọi buổi của lớp đó. Bạn cần một thẻ thành viên còn hiệu lực vào ngày của buổi học kế tiếp; lớp học không thu thêm phí.'],
  ['Thẻ thành viên dùng để làm gì?', 'Thẻ là học phí trọn gói theo thời gian, không phải thẻ giảm giá: trả một lần, trong thời hạn thẻ bạn đặt lớp không mất thêm phí. Mỗi gói ghi rõ các môn được dùng trong phần mô tả. Gia hạn bằng cách mua tiếp một gói ở Tài khoản của tôi → Thẻ thành viên, thẻ mới bắt đầu ngay sau ngày thẻ cũ hết hạn.'],
  ['Tôi xem lịch tập của mình ở đâu?', 'Ở Tài khoản của tôi → Lịch tập: mọi buổi sắp tới của những lớp bạn đã đặt, theo từng ngày. Buổi nào nằm ngoài thời hạn thẻ sẽ được đánh dấu để bạn gia hạn kịp.'],
  ['Tôi có hủy được không?', 'Được, ở Tài khoản của tôi → Lớp đã đặt, trước khi bạn học buổi đầu tiên. Sau đó, hãy nhờ lễ tân.'],
  ['Nếu lớp đã đủ người thì sao?', 'Trang lớp có ghi số chỗ còn lại. Hết chỗ thì không đặt được nữa, bạn hãy xem các lớp khác cùng môn.'],
  ['Thanh toán gói tập thế nào?', 'Ở trang Gói tập, bấm “Chọn” ở gói bạn muốn để sang trang xác nhận, chọn chuyển khoản hoặc thẻ rồi đặt mua. Đơn được giữ 30 phút: bạn thanh toán với lễ tân, lễ tân xác nhận xong thì thẻ được kích hoạt ngay; quá 30 phút chưa xác nhận thì đơn tự hủy. Bạn cũng có thể mua tại quầy lễ tân: nhân viên kích hoạt thẻ và xuất hóa đơn ngay.'],
  ['Tôi lấy hóa đơn ở đâu?', 'Ở Tài khoản của tôi → Hóa đơn, bấm “In” để in hoặc lưu hóa đơn thành tệp PDF. Lễ tân cũng in được hóa đơn cho bạn tại quầy.'],
  ['Ai điểm danh cho tôi?', 'Huấn luyện viên điểm danh có mặt hoặc vắng ở mỗi buổi. Bạn xem lại ở Tài khoản của tôi → Điểm danh.'],
  ['Tôi đổi mật khẩu ở đâu?', 'Ở Tài khoản của tôi → Hồ sơ, mục Mật khẩu: nhập mật khẩu hiện tại rồi mật khẩu mới.'],
  ['Cần hỗ trợ khác?', 'Gửi yêu cầu ở Tài khoản của tôi → Hỗ trợ. Lễ tân sẽ trả lời ngay tại đó và bạn theo dõi được trạng thái.'],
];

// The answers that change once classes have fees (CHANGELOG Part B, B53)
const WITH_CLASS_FEES = {
  'Làm sao để đặt lớp?': 'Mở trang lớp, xem học phí và các buổi học rồi bấm “Đặt lớp và thanh toán”. Một lần đặt là tham gia được mọi buổi của lớp. Đơn giữ chỗ cho bạn 30 phút để thanh toán với lễ tân; lễ tân xác nhận xong là đặt lớp xong. Lớp miễn phí thì đặt ngay.',
  'Thẻ thành viên dùng để làm gì?': 'Thẻ dùng cho mọi môn: trong thời hạn thẻ, bạn được giảm học phí mọi lớp theo mức của gói, kèm các dịch vụ ghi ở trang Gói tập. Không có thẻ bạn vẫn đặt lớp được với học phí gốc. Gia hạn bằng cách mua tiếp một gói ở Tài khoản của tôi → Thẻ thành viên, thẻ mới bắt đầu ngay sau ngày thẻ cũ hết hạn.',
  'Tôi xem lịch tập của mình ở đâu?': 'Ở Tài khoản của tôi → Lịch tập: mọi buổi sắp tới của những lớp bạn đã đặt, theo từng ngày; lớp đang chờ thanh toán có nhãn riêng.',
  'Tôi có hủy được không?': 'Lượt đặt chưa thanh toán: tự hủy ở Tài khoản của tôi → Lớp đã đặt. Lớp đã thanh toán: báo lễ tân trước buổi học đầu để hủy và nhận lại học phí; sau buổi đầu thì không hủy được.',
};

export default function Help() {
  const billed = useClassPricing();
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
            <p>{(billed && WITH_CLASS_FEES[q]) || a}</p>
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
