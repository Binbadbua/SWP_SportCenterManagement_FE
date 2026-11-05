# Home và Login mới — Đợt35,04/11/2026

Đã thiết kế lại Home và trang đăng nhập theo yêu cầu: font tiếng Việt dễ đọc, tông cam–trắng, bố cục rõ mục đích và giảm các nút xem lớp lặp lại. Bản local: http://127.0.0.1:5182 . Thay đổi chưa được assistant commit/push/deploy.

## Nội dung đã cập nhật

| Phần | Thiết kế và hành vi mới |
|---|---|
|Typography|Be Vietnam Pro tự host, weight400/500/600/700/800 cho Home/Login; header/footer storefront và chữ thương hiệu được đồng bộ. Hạn chế headline khổng lồ, tăng line-height cho dấu tiếng Việt. Các form staff giữ kiểu riêng.|
|Banner dưới menu|Gỡ PromoStrip “Lớp mới mở mỗi tuần / Tìm lớp học” và cả nhánh “Buổi tập đầu tiên miễn phí”; xóa component/CSS không còn dùng, StoreLayout không render banner trên các trang public.|
|Hero Home|Bố cục hai cột, headline “Mỗi buổi tập, một bước tiến.” với ảnh sân tennis đóng khung. Dùng ảnh đầu tiên qua IMAGES.hero; không còn slideshow headline lớn. CTA đưa đến khu lớp sắp mở và lịch theo ngày, có thông tin hỗ trợ ngắn.|
|Chọn môn|Grid ảnh, tên môn/số lớp sắp mở, hover và link đúng `/classes?sport=<id>`. Mặc định8môn, có mở rộng/thu gọn nếu danh mục dài; không còn rail tự trôi.|
|Sắp khai giảng|Bộ lọc môn tại chỗ, trạng thái có aria-pressed, tối đa4thẻ với ảnh, HLV, ngày, học phí toàn khóa và số chỗ khi BE có dữ liệu. Tính ngày theo helper Việt Nam, gồm lớp status1 khai giảng hôm nay; mở chi tiết vẫn dùng guard booking hiện có.|
|Hai khối quảng bá cũ|Thay bằng hướng dẫn3bước và khu lịch tập/tài khoản. Link hướng dẫn `/help`; CTA cá nhân tùy guest/Member/staff đến register, account schedule hoặc staff. Không lặp lại hai nút xem lớp ở các ảnh lớn.|
|Gói thành viên|Thẻ gói gọn, giá/thời hạn/ưu đãi/quyền lợi từAPI. Không gắn nhãn “Được chọn nhiều nhất” khi không có thống kê. Nêu rõ thẻ và học phí lớp là hai nghiệp vụ riêng. Dữ liệu mẫu không dẫn tới checkout bằng ID giả.|
|Huấn luyện viên|Grid hồ sơ, avatar thật hoặc initials dự phòng theo tên, số năm kinh nghiệm và chuyên môn. Chữ initials được override bằng font mới, không còn Anton trong phần này.|
|Login|Ảnh và form bo góc, headline câu thường, input/focus/nút cam. Giữ xử lý signIn, redirect role/next, tên field, registered/error/slowhint và hiện/ẩn mật khẩu. Mobile đặt form trước ảnh để đăng nhập ngay.|
|Mobile/footer|Responsive360/375px; contact và brand ở hàng riêng, số điện thoại không bị cắt nhỏ; liên kết footer được wrap, khoảng trắng cuối Home gọn hơn.|

Không thay API hoặc source BE, không seed/đổi giá/dữ liệu/ảnh của người dùng, không chuyển framework. Nội dung/giao diện mới thay phần Home trước đó theo yêu cầu; các thay đổi ngoài phạm vi như README/lịch sử kiểm AI và việc xóa file Word lock được giữ nguyên.

## Kết quả xác minh

- Production build cuối: **PASS102modules**, Vite8.3.3, không cảnh báo chunk>500kB. EntryJS khoảng293,22kB/gzip90,77kB; đây không phải tổng dung lượng tải hoặc chứng nhận hiệu năng production.
- Bounded manual preview cuối: **29/29PASS**, Home/Login desktop1440 và mobile375/360. Kiểm viewport, font thực tế đã nạp, ảnh, field label, runtime, filter Yoga2→all4, link môn, validation rỗng, hiện/ẩn mật khẩu và mock login giữ next=/account?tab=schedule. Không viết testfile mới chỉ để xác nhận màu/bố cục.
- Evidence cuối: `../artifacts/home-redesign-2026-11-04/2026-11-04T14-52-12-644Z/report.json`; screenshots cùng thư mục. Lượt đầu và các ảnh trước chỉnh initials/footer được giữ riêng làm lịch sử.
- Browser preview dùng **API mô phỏng và dữ liệu local** để đánh giá layout nhất quán; giá/tên trong ảnh là fixture, không ghi vào DB. Không có AI inference hoặc thao tác tài chính thật. Các kết quả này không thay việc test toàn bộ nghiệp vụ BE.
- Đối chiếu danh mục thật bằng4GET vô danh: categories/classes/coaches/packages đều200; lần lượt23/20/10/20bản ghi và các trường cần dùng khớp FE. `../artifacts/home-redesign-2026-11-04/live-catalogue/2026-11-04T14-53-06-962Z/report.json`. Lượt này mất khoảng30,8–31,1giây; chưa có log để xác định nguyên nhân. Home giữ hero và loading/trạng thái chờ ở từng khối, không chuyển dữ liệu chưa tải thành số liệu thật bằng0.

## Cách kiểm tra nhanh

1. Mở Home, kiểm banner cũ đã biến mất, font mới và hero hai cột trên desktop.
2. Bấm một môn trong grid → danh sách lớp được lọc đúng sport. Quay Home, bấm các bộ lọc ở Sắp khai giảng → danh sách đổi tại chỗ; thử trạng thái không có lớp và quay về Tất cả.
3. Mở hướng dẫn, lịch theo ngày, hồ sơ HLV hoặc gói tập bằng link tương ứng. Khi muốn thử thanh toán, dùng quy trình/dữ liệu demo đã thống nhất; không tạo đơn chỉ để kiểm layout.
4. Mở `/login`, thử rỗng và hiện/ẩn mật khẩu. Kiểm form trước ảnh trên mobile; đăng nhập thật theo role vẫn theo handler cũ.
5. Nếu giao diện cũ còn trong tab đang mở, tải lại trang; sau khi lấy code trên máy khác cần npm install vì có font mới và bản vá build tool.

## Dependency và giới hạn

Thêm `@fontsource/be-vietnam-pro@5.3.0` ([Fontsource](https://fontsource.org/fonts/be-vietnam-pro/use)); font được đóng gói cùng FE. Khi cài, npm phát hiện hai cảnh báo high đã có từ trước ở công cụ dev, không do font mới. Đã cập nhật Vite8.3.0→8.3.3 và source-map-js1.2.1→1.2.2 theo bản vá tương thích; npm sau cập nhật báo0vulnerabilities. Không chạy audit fix hoặc nâng major; kết quả audit không phải chứng nhận an toàn tuyệt đối.

Chưa kiểm bàn phím ảo trên thiết bị thật hoặc tải đồng thời. AI và các lỗi BE ghi ở Đợt34 không được đánh dấu đã sửa bởi lượt UI này. Giữ toàn bộ lịch sử trong CHANGELOG_AND_BE_ISSUES.md, TEST_FLOWS.md và CLAUDE.md.

## Cập nhật05/11/2026 — Hero chuyển ảnh theo yêu cầu tiếp theo

Phần hero hai cột/ảnh tĩnh của04/11 phía trên được thay bằng nền ảnh tràn ngang tự chuyển. Dùng lại5ảnh gốc, mỗi7giây đổi ảnh, chuyển mờ1,2giây kèm phóng nhẹ. Giữ font Be Vietnam Pro, tiêu đề/nội dung/CTA và các chú thích mới; chữ không thay đổi theo ảnh. Các khối dưới và Login giữ nguyên. PromoStrip tiếp tục được gỡ.

Có nút Tạm dừng ảnh/Tiếp tục ảnh ở trái dưới, thao tác được bằng bàn phím; tránh nút chat AI góc phải. Chế độ giảm chuyển động tắt autoplay/zoom và được cập nhật khi người dùng đổi tùy chọn hệ thống. Tải ảnh lần lượt và trước một ảnh; không đổi API hay ghi dữ liệu.

Kiểm lại: build102modulesPASS, manual preview29/29PASS trên1440/375/360px, không runtime/console errors; kiểm nội dung/font/link, ảnh tải/zoom/chuyển, dừng/chạy lại, reduced-motion ban đầu/trong phiên và không đè nút AI. Bằng chứng `../artifacts/home-hero-motion-2026-11-05/2026-11-04T19-47-16-757Z/report.json`;4ảnh ở screenshots cùng thư mục. Đây là kiểm giao diện với API mô phỏng; không thay trạng thái các lỗi AI/BE trước đó. Báo cáo đầu giữ riêng với ghi chú sửa phép đo Unicode/scrollbar. Chỉ sửa application Home.jsx/home-redesign.css, không sửa source BE hoặc tự commit/push/deploy.

Cách thử nhanh mới thay bước1 của hướng dẫn04/11: mở Home, đợi7giây xem ảnh đổi, thử nút dừng/tiếp tục; kiểm chữ và hai CTA luôn giữ nguyên. Các bước còn lại vẫn áp dụng.

Bổ sung xác minh vòng ảnh:13/13PASS, đủ5ảnh theo thứ tự rồi quay lại tennis, tất cả ảnh tải được. Evidence: FE/artifacts/home-hero-motion-2026-11-05/full-cycle/2026-11-04T19-48-03-496Z/report.json. Tổng cả hai lượt cuối24GET mô phỏng,0runtime/console errors,0AI/BE/business writes.

## Cập nhật05/11/2026 — Bỏ hai khối chú thích hero (Đợt37)

Xóa hoàn toàn nhãn “Không gian cho năng lượng mới” và thẻ “Tập theo cách của bạn”, gồm icon và phụ đề. Dọn CSS/wrapper không còn dùng và bỏ cột phụ trong hero; giữ nội dung chính, font, ảnh động và điều khiển dừng/tiếp tục. Đây là yêu cầu mới thay việc giữ chú thích ở Đợt36. Build102modulesPASS và diff--checkPASS; không chạy lại bộ browser hoặc API. Khi kiểm Home, hai khối phải biến mất trên desktop/mobile. Lịch sử trên giữ nguyên.

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
