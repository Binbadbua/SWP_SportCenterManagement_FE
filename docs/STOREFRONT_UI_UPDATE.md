# Cập nhật giao diện danh mục SportCenter — 05/11/2026

Tiếp nối Home/Login, các trang khách hàng được đồng bộ Be Vietnam Pro và tông cam–trắng. Font trong .store áp dụng cho cả trang chi tiết, tài khoản và checkout; khu staff giữ kiểu riêng. Các xử lý nghiệp vụ dùng API hiện có.

| Phần | Thay đổi |
|---|---|
|Lớp học|Giới thiệu và tìm kiếm tại trang, panel bộ lọc, đếm kết quả, thẻ ảnh/môn/HLV/ngày/học phí toàn khóa/chỗ và liên kết chi tiết. q/sport/status/coach/sort trên URL được giữ.|
|Huấn luyện viên|Thẻ hồ sơ mới với ảnh thật hoặc initials, kinh nghiệm/chuyên môn/môn dạy; tìm theo tên/chuyên môn, sắp theo kinh nghiệm/tên. Không thêm rating hoặc dữ liệu quảng bá giả.|
|Gói tập|Hero nhẹ, thẻ gói có phân cấp giá/thời hạn/quyền lợi/discount, hướng dẫn, phân biệt thẻ với lớp và bảng so sánh cuộn trên mobile. Giá toàn gói theo API, bình quân/ngày chỉ tham khảo.|
|Lịch học|Font, khung giới thiệu, điều hướng ngày và từng buổi học mới; vẫn dùng dải7ngày và link lớp như trước.|
|Trang chi tiết|Font/cỡ tiêu đề, khung thông tin, ảnh và CTA đồng bộ; giữ guard đăng ký/thanh toán/hủy cũ.|
|Chat|Nút tròn chỉ LogoMark SportCenter, không chữ Trợ lý AI ngoài nút; vẫn có tên truy cập, mở/đóng bằng bàn phím/Escape và panel cũ.|

Các file chính: StoreLayout.jsx; Classes.jsx, Coaches.jsx, Memberships.jsx, Schedule.jsx; cards.jsx (ClassCard/CoachCard), AiChatWidget.jsx; thêm storefront-refresh.css, catalog-redesign.css, membership-redesign.css và chỉnh ai-chat.css. Không thêm package mới.

Dữ liệu: chỗ trống ưu tiên currentEnrolled gồm Pending holds; khi lịch chưa tải/lỗi, nhãn không khẳng định nhận đăng ký. Mẫu offline được báo rõ và không cho chọn gói giả để checkout. Loading/error/empty được giữ; hướng dẫn thanh toán khi options chưa rõ không suy ra chế độ lễ tân. Home ảnh động và hai chú thích đã bỏ giữ nguyên.

## Cách xem nhanh

1. Mở /classes: tìm kiếm, lọc môn/trạng thái/HLV, đổi sắp xếp và xóa bộ lọc; mở thẻ lớp đúng chi tiết.
2. Mở /coaches: thử tên/chuyên môn, sắp xếp và mở hồ sơ; liên hệ cuộn tới footer.
3. Mở /memberships: xem giá toàn gói/quyền lợi/bảng so sánh; chọn gói thật mở đúng checkout. Không cần gửi thanh toán để kiểm giao diện.
4. Mở /schedule: chuyển trước/sau và Về hôm nay, mở lớp từ buổi học.
5. Kiểm360/375px và desktop: font tiếng Việt, ảnh, overflow, bảng gói chỉ cuộn bên trong. Mở/đóng bong bóng chat logo, Escape trả focus; guest vẫn cần đăng nhập.

## Xác minh và phạm vi

Build105modulesPASS, git diff--checkPASS. Kiểm browser sử dụng dữ liệu/API mô phỏng để đánh giá UI/điều hướng; kết quả cuối bổ sung phía dưới. Không gọi Gemini thật, ghi dữ liệu hoặc xác nhận lại các lỗi BE/AI cũ; không load test/deploy/commit/push. Các bản ghi trước của Home/Login và lỗi BE giữ nguyên trong tài liệu lịch sử.

### Xác minh cuối Đợt38 — 05/11/2026

Manual browser preview chính39/39PASS:4trang danh mục ở1440/375/360px, font thực nạp đúng, tìm/lọc lớp, tìm/xóa tìm HLV, liên kết gói tới checkout, chuyển tuần/Về hôm nay,2trang chi tiết, Help/Registermobile, bong bóng logo/tên truy cập/Escape trả focus và khung chat nằm trong viewport. Không có ảnh local hỏng hoặc runtime/console errors. Lượt chính100GET mô phỏng,0AI inference/ghi nghiệp vụ; giá/discount/sĩ số trong ảnh là fixture, không phải dữ liệu vừa tạo hoặc sửa trên DB. Evidence: FE/artifacts/storefront-refresh-2026-11-05/final/2026-11-04T20-20-30-456Z/report.json và10screenshots.

Ảnh desktop bổ sung sau tinh chỉnh CSS8/8PASS: FE/artifacts/storefront-refresh-2026-11-05/final-layout/2026-11-04T20-22-43-016Z/report.json,6screenshots; đây là lượt layout riêng, không cộng với39check như bộ nghiệp vụ mới. Chỉnh cuối gồm input/selectmobile16px, khoảng trắng trước footer44px, giữ dấu cách khi link giới thiệu bỏ ngắt dòng và thẻ lớp ở CoachDetailmobile một cột. Build cuối105modulesPASS, entryJS294,75kB/gzip91,06kB; không cảnh báo chunk>500kB. Ảnh kiểm mục tiêu sau các chỉnh cuối nằm tiếp trong artifacts/storefront-refresh-2026-11-05.

Lượt browser đầu bị ngắt ở phép kiểm status3 vì fixture không có lớp kết thúc, không phải phát hiện lỗi FE/BE; giữ báo cáo cũ và giới hạn lượt cuối theo dữ liệu fixture đã có. Chưa kiểm thiết bị iOS/Android thật hoặc tải production. Không dùng39/39 để kết luận AI/provider, thanh toán thật hoặc tất cả API đã đạt. Mọi lịch sử trước giữ nguyên, không tự commit/push/deploy.

Bổ sung ảnh/kiểm mục tiêu cuối Đợt38: các lượt sau chỉnh CSS8/8 +8/8 +4/4PASS; tổng các lượt đạt151GET mô phỏng, không runtime/console errors, không gọi BE/AI hoặc ghi nghiệp vụ. Ảnh đã giúp phát hiện và sửa khối hỗ trợ HLV mobile bị bó hẹp: chuyển sang grid41px+nội dung, CTA hàng riêng; ô sắp xếp HLV rộng toàn hàng để đọc đủ nhãn. Thẻ lớp ở CoachDetailmobile nay một cột và các link giới thiệu giữ dấu cách khi bỏ ngắt dòng. Build hoàn chỉnh105modulesPASS, entryJS294,75kB/gzip91,08kB; diff--checkPASS.

Bằng chứng bổ sung: final-mobile/2026-11-04T20-26-50-726Z và final-coaches-mobile/2026-11-04T20-29-13-820Z dưới FE/artifacts/storefront-refresh-2026-11-05. Ảnh HLV375px mới nhất: final-coaches-mobile/2026-11-04T20-29-13-820Z/screenshots/coaches-mobile375-final.png. Các ảnh trước giữ làm lịch sử; các số kiểm UI không phải số endpoint BE đã được test. Chrome kiểm tra đã đóng/dọn profile riêng, Vite local5182 giữ để xem. Không sửa thêm nghiệp vụ hoặc tự commit/push/deploy.

## Cập nhật05/11/2026 — Đợt39: toàn bộ font, chuyển động và dữ liệu demo

Font Be Vietnam Pro nay áp dụng toàn hệ thống gồm staff/modal/bản in, thay phạm vi chỉ storefront của Đợt38. Home bỏ khối gói tập và request packages. Chọn môn hiện lớp đang diễn ra(status2) và mở đúng bộ lọc sport/status2. Sắp khai giảng bỏ chips môn, CTA Xem các lớp sắp khai giảng → /classes?status=1. HLV và lớp sắp mở trôi chậm18px/giây ngược chiều trong khung nội dung; có pause, prev/next, dừng khi hover/focus và giảm chuyển động. Hero tự trừ chiều cao thực header để phủ hết màn hình lần mở đầu.

Trang Classes có ảnh slideshow tất cả môn thay khối Xếp lịch cho một bạn khỏe hơn, chỉ ảnh và không tương tác. Gói30ngày được làm nổi bật bằng màu/tem BEST SELLER theo yêu cầu mới, bỏ trái tim trên tất cả thẻ; không tính/xuất dữ liệu thống kê hoặc đổi giá.

### Lớp demo đã cập nhật thật qua API

| Lớp | Thời gian mới | Buổi | Học phí giữ nguyên |
|---|---|---:|---:|
|Bơi Lội Trẻ Em K2|01–04/12/2026|3|12.000đ|
|Gym Kỹ Thuật Nâng Cao|05/12/2026–03/02/2027|9|20.000đ|
|Bóng Rổ Thiếu Niên U15|06/12/2026–07/03/2027|8|10.000đ|

Cả3status1/0học viên lúc kiểm. Người dùng đã xác nhận mở rộng từ1lớp đang diễn ra sang cả2lớp đã kết thúc nhưng trống.25PUT200 dời cả20buổi; giữ ID/HLV/phòng/giờ/thứ/sĩ số/giá, không trùng lịch.14/14đối chiếuPASS:17lớp/210buổi khác và52booking/51invoice không đổi. [Chi tiết dữ liệu trước/sau](../artifacts/demo-dates-2026-11-05/2026-11-05T07-10-16-738Z/DEMO_DATES_APPLIED.md). Trước khi demo, tải lại /classes?status=1; không reset/rollback nếu đã có người đặt mới.

### Xác minh giao diện

Build106modulesPASS; browser42/42 và7/7mục tiêuPASS, font3role staff/modal, hero1920/1440/375/360, rows/3lớp/hover/focus/reducedmotion, slideshow/tem/links.126GET mô phỏng, không runtime/console hoặc ghi nghiệp vụ/inference trong browser. [Báo cáo UI](../artifacts/home-demo-polish-2026-11-05/2026-11-05T07-26-22-483Z/report.json), [kiểm clone/header cuối](../artifacts/home-demo-polish-2026-11-05/targeted-final/2026-11-05T07-32-36-669Z/report.json). Kiểm UI mô phỏng và kiểm live dời dữ liệu là hai phạm vi riêng; không xác nhận AI/thanh toán thật/tải production. Giữ mọi lịch sử, không sửa source BE hoặc tự commit/push/deploy.

## Cập nhật05/11/2026 — Thanh tiện ích trên cùng (Đợt40)

Chỉ thanh chứa Liên hệ/Trợ giúp/tài khoản/Đăng xuất đổi nền cam#c63b13, chữ trắng; có hover gạch chân/focus trắng. Thanh logo SportCenter, menu, tìm kiếm và icon bên dưới giữ kiểu gốc. Thay đổi chỉ trong storefront-refresh.css, không đổi kích thước/JSX/nghiệp vụ. Build106modulesPASS và diff--checkPASS; không chạy lại browser suite cho cập nhật màu nhỏ.
