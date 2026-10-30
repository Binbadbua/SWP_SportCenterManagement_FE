import { useClassPricing, usePaymentOptions } from '../../hooks/usePricing.js';
import { Button } from '../../components/ui.jsx';

// The answers follow what the API does today: class fees once it bills classes (CHANGELOG Part B, B53), SePay once it
// takes online payments (B54); before them a booking needs a card and a web order waits for reception.
function faq({ fees, online, hold }) {
  return [
    [
      'Làm sao để đặt lớp?',
      fees
        ? `Mở trang lớp, xem học phí và các buổi học rồi bấm “Đặt lớp và thanh toán”. Chỉ đặt được lớp chưa bắt đầu; một lần đặt là tham gia được mọi buổi của lớp. ${online ? `Bạn thanh toán trực tuyến qua SePay (quét mã VietQR bằng ứng dụng ngân hàng); chỗ được giữ ${hold} phút, SePay báo đã nhận tiền là đặt lớp xong.` : `Bạn chuyển khoản; chỗ được giữ ${hold} phút, lễ tân đối soát xong là đặt lớp xong.`} Lớp miễn phí thì đặt ngay.`
        : 'Mở trang lớp, xem các buổi học rồi bấm “Đặt lớp này”. Chỉ đặt được lớp chưa bắt đầu; một lần đặt là tham gia được mọi buổi của lớp. Bạn cần một thẻ thành viên còn hiệu lực vào ngày của buổi học kế tiếp; lớp học không thu thêm phí.',
    ],
    [
      'Thẻ thành viên và lớp học khác nhau thế nào?',
      `Thẻ thành viên là quyền vào trung tâm tự tập (gym, cardio, hồ bơi) không giới hạn trong thời hạn thẻ; lễ tân kiểm tra thẻ khi bạn vào cửa. Lớp học là khóa có huấn luyện viên, lịch cố định và sĩ số giới hạn, đặt riêng ở trang lớp. ${fees ? 'Thẻ còn hiệu lực được giảm học phí mọi lớp theo mức của gói; không có thẻ vẫn đặt lớp được với học phí gốc.' : 'Trong thời hạn thẻ, bạn đặt lớp không mất thêm phí.'}`,
    ],
    ['Có những gói nào?', 'Ba gói dùng cho mọi môn: 1 tháng, 6 tháng và 1 năm. Gói càng dài càng rẻ và được tặng thêm ngày tập; giá và quyền lợi của từng gói ghi ở trang Gói tập.'],
    [
      'Thanh toán gói tập thế nào?',
      online
        ? `Ở trang Gói tập, bấm “Chọn” ở gói bạn muốn, kiểm tra ngày bắt đầu rồi chọn Chuyển khoản ngân hàng qua SePay. Trang thanh toán hiện mã QR: mở ứng dụng ngân hàng, quét mã và xác nhận. Thanh toán xong, thẻ được kích hoạt và hóa đơn được xuất ngay; quá ${hold} phút chưa thanh toán thì đơn tự hủy. Đơn trên web không trả tại quầy; nếu đến trực tiếp, lễ tân bán thẻ cho bạn tại quầy.`
        : `Ở trang Gói tập, bấm “Chọn” ở gói bạn muốn, kiểm tra ngày bắt đầu rồi đặt mua và chuyển khoản, ghi mã giao dịch trong nội dung. Lễ tân đối soát xong thì thẻ được kích hoạt và hóa đơn được xuất; quá ${hold} phút chưa xác nhận thì đơn tự hủy. Nếu đến trực tiếp, lễ tân bán thẻ cho bạn tại quầy.`,
    ],
    ['Gia hạn hay nâng cấp thẻ thế nào?', 'Ở Tài khoản của tôi → Thẻ thành viên. Gia hạn: mua tiếp một gói, thẻ mới bắt đầu ngay sau ngày thẻ cũ hết hạn. Nâng cấp: bấm “Nâng cấp gói” để chuyển sang gói dài hơn ngay hôm nay; phần còn lại của thẻ cũ (theo số ngày chưa dùng) được trừ vào giá gói mới.'],
    ['Vào trung tâm tự tập thế nào?', 'Đến quầy lễ tân: lễ tân kiểm tra thẻ còn hiệu lực hôm nay và ghi lượt vào. Các lượt vào của bạn nằm ở Tài khoản của tôi → Thẻ thành viên.'],
    [
      'Tôi xem lịch tập của mình ở đâu?',
      fees
        ? 'Ở Tài khoản của tôi → Lịch tập: mọi buổi sắp tới của những lớp bạn đã đặt, theo từng ngày; lớp đang chờ thanh toán có nhãn riêng.'
        : 'Ở Tài khoản của tôi → Lịch tập: mọi buổi sắp tới của những lớp bạn đã đặt, theo từng ngày. Buổi nào nằm ngoài thời hạn thẻ sẽ được đánh dấu để bạn gia hạn kịp.',
    ],
    [
      'Tôi có hủy được không?',
      fees && online
        ? 'Được, ở Tài khoản của tôi → Lớp đã đặt. Lượt chờ thanh toán: hủy lúc nào cũng được, chưa bị trừ tiền. Trước khi lớp bắt đầu: hoàn đủ học phí qua lễ tân bằng chuyển khoản hoặc tiền mặt. Lớp đã bắt đầu: vẫn hủy được nhưng không hoàn học phí và không đặt lại được; web hỏi lại trước khi hủy.'
        : fees
          ? 'Lượt chưa thanh toán: tự hủy ở Tài khoản của tôi → Lớp đã đặt. Lớp đã thanh toán: báo lễ tân trước khi lớp bắt đầu để hủy và nhận lại học phí; lớp đã bắt đầu thì không hoàn học phí.'
          : 'Được, ở Tài khoản của tôi → Lớp đã đặt. Lớp đã bắt đầu vẫn hủy được, nhưng sau đó bạn không đặt lại được lớp đó vì lớp không nhận đặt thêm; web hỏi lại trước khi hủy.',
    ],
    ['Nếu lớp đã đủ người thì sao?', 'Trang lớp có ghi số chỗ còn lại. Hết chỗ thì không đặt được nữa, bạn hãy xem các lớp khác cùng môn.'],
    ['Tôi lấy hóa đơn ở đâu?', 'Ở Tài khoản của tôi → Hóa đơn, bấm “In” để in hoặc lưu hóa đơn thành tệp PDF. Lễ tân cũng in được hóa đơn cho bạn tại quầy.'],
    ['Ai điểm danh cho tôi?', 'Huấn luyện viên điểm danh có mặt hoặc vắng ở mỗi buổi học. Bạn xem lại ở Tài khoản của tôi → Điểm danh.'],
    ['Tôi đổi mật khẩu ở đâu?', 'Ở Tài khoản của tôi → Hồ sơ, mục Mật khẩu: nhập mật khẩu hiện tại rồi mật khẩu mới.'],
    ['Cần hỗ trợ khác?', 'Gửi yêu cầu ở Tài khoản của tôi → Hỗ trợ. Lễ tân sẽ trả lời ngay tại đó và bạn theo dõi được trạng thái.'],
  ];
}

export default function Help() {
  const billed = useClassPricing();
  const opts = usePaymentOptions();
  const items = faq({ fees: !!billed, online: !!opts?.online, hold: opts?.holdMinutes ?? 30 });
  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1 className="page-title display">Trợ giúp</h1>
        <p className="page-lead">Giải đáp những câu hỏi lễ tân hay nhận được nhất.</p>
      </header>
      <div className="accordions">
        {items.map(([q, a], i) => (
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
