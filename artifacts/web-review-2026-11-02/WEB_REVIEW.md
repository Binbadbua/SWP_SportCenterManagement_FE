# Rà soát FE, chatbox và 5 flow — Đợt29

Hoàn tất ngày **03/11/2026** (giờ Việt Nam). Các lượt rà soát chính diễn ra ngày02/11; chat UI, đồng bộ phiên và payment UI được chốt lại rạng sáng03/11. Timestamp trong đường dẫn evidence là UTC; giữ thư mục web-review-2026-11-02 để không đổi lịch sử.

**Kết luận:** FE đã có chatbox kết nối API thật và đã sửa các lỗi tải dữ liệu/form phát hiện trong lượt này. Các trang được kiểm tra hoạt động trong phạm vi đọc và xem trước form. Chưa thể kết luận toàn bộ nghiệp vụ đã hoàn thiện: AI thật vẫn lỗi503 ở lần gọi gần nhất, một số lỗi BE còn mở, và chưa có chứng cứ mới cho chuyển tiền/hoàn tiền/expiry toàn trình. Không sửa source BE, không tạo QA hoặc giao dịch mới trong lượt rà soát này.

## Chatbox đã bàn giao

Chạy FE tại thư mục dự án bằng `npm.cmd run dev -- --host 127.0.0.1 --port 5182`, mở http://127.0.0.1:5182, đăng nhập rồi bấm **Trợ lý AI** ở góc dưới bên phải. Nếu FE đã chạy trên cổng khác thì dùng địa chỉ đó. Khách thấy nút đăng nhập; chat dùng cho tài khoản đã đăng nhập theo contract `Authenticated`. Hóa đơn in không có widget.

- Gọi GET `/api/ai/options` khi mở và POST `/api/ai/chat` khi gửi. Không chứa API key của Gemini trong FE, không trả câu trả lời mẫu khi API hỏng.
- Câu hỏi tối đa2.000ký tự; Enter gửi, Shift+Enter xuống dòng, không gửi nhầm khi đang gõ IME. Chỉ một yêu cầu đang chờ; có tiến trình, Dừng chờ, timeout35giây, giữ câu hỏi và Thử lại. Dừng chờ ở FE không chứng minh BE/provider đã dừng xử lý.
- Xử lý503/429/401/403/mất mạng/timeout và HTTP200 không có `reply`. Không tự retry inference. `configured=true` không được hiển thị thành provider đã xác minh.
- Context chỉ gồm tối đa3cặp hỏi/đáp đã thành công, giới hạn6.000ký tự; cuộc trò chuyện nằm trong bộ nhớ, tối đa20lượt hiển thị. Đăng xuất/đổi tài khoản/vai trò/phiên sẽ xóa hội thoại, abort và bỏ phản hồi cũ. Không lưu chat vào localStorage; BE/provider có lưu hay không chưa được xác minh.
- Nội dung trả về hiển thị dạng văn bản, có disclaimer; mobile375px và chiều cao480px vẫn có ô nhập/nút, hỗ trợ Escape và trả focus. Đã xem ảnh thật từ browser test; chưa chứng nhận toàn bộ trình đọc màn hình hoặc bàn phím ảo trên thiết bị thật.

Code chính: `src/components/AiChatWidget.jsx`, `src/lib/ai.js`, `src/styles/ai-chat.css`, wrapper mới trong `src/api/endpoints.js`. Widget có ErrorBoundary riêng để lỗi của chat không làm trắng trang.

## Đối chiếu 5 flow

| Flow | Đã kiểm/sửa trong lượt này | Phần còn cần xác nhận/hoàn thiện |
|---|---|---|
|1 — User/membership|Đọc trang hồ sơ/thẻ/hóa đơn và các vai trò; đồng bộ hai tab; bỏ callback hồ sơ cũ sau đổi phiên. Mua/gia hạn/nâng cấp chờ đủ cards/invoices/profile/packages/options, hiện lỗi kèm retry thay vì kết luận sai là chưa có thẻ.|B63 forgot/reset500 là kết quả live ngày02/11 trước đó, chưa kiểm lại trong lượt UI này. Không tạo kỳ thẻ/giao dịch mới để chứng minh kích hoạt/nối kỳ/nâng cấp toàn trình.|
|2 — Lớp/lịch/booking|Số chỗ ưu tiên `currentEnrolled` có tính Pending holds, không dùng roster Coach chỉ có người đã ghi danh để ghi đè. Khóa ngày/buổi theo giờ trung tâm Việt Nam, xóa state đặt lớp khi đổi classId. Checkout chờ thẻ và booking để không báo giá/cho đặt quá sớm.|B58 DELETE lớp status1 đã có buổi quá khứ vẫn200 là lỗi BE còn mở theo evidence cũ. Lần này không tạo hold15phút mới hoặc hủy booking thật.|
|3 — SePay/thanh toán/báo cáo|Options500/503 không bị biến thành chế độ lễ tân xác nhận30phút; retry lấy lại options. Không dùng giá mock trên trang giao dịch. Copy đúng QR/ngân hàng; payment UI có trạng thái kiểm tra, resume từ app ngân hàng, gộp request và dừng khi Paid.|Không chứng minh thời gian ngân hàng→SePay→webhook→DB; không cam kết2–3giây. B66 đơn8.000đ cũ vẫn chưa được đối soát ở lần đọc trước. Hoàn tiền ngoài hệ thống rồi lễ tân xác nhận theo flow hiện có; không nói SePay tự hoàn.|
|4 — Training/attendance|Sửa RangeError làm form thêm giáo án/kết quả không mở. Giữ mapping `sessionId` đã sửa Đợt26, kiểm form Coach thật trên desktop/mobile; mock regression kiểm các ngày mặc định. Luồng BE trước đó yêu cầu Present trước khi tạo result.|FE hiện là giáo án, điểm và nhận xét; chưa có biểu đồ tiến bộ hoặc các trường reps/mức tạ riêng như tài liệu nguồn. Lượt này không ghi điểm danh/kết quả thật trên DB demo.|
|5 — AI|Flow5A có chatbox thực tế, đầy đủ trạng thái chờ/lỗi/thử lại và context;43/43 browser checks bằng API mô phỏng. Wrapper exercise-suggestions đã có.|Chat/exercise inference thật gần nhất đều503 (Đợt28), nên chất lượng câu trả lời, dữ liệu riêng, tính đúng của giá/catalogue và phạm vi trả lời chưa kiểm được. **Chưa có giao diện Flow5B Coach Copilot** để tạo/duyệt giáo án từ AI.|

Các DOCX Flow1–5 là tài liệu yêu cầu để đối chiếu. Các phát biểu trong đó không được coi là kết quả test hoặc lệnh thay đổi hệ thống. File mẫu `docs/DEMO_MAU_5_FLOW.docx` được thêm ghi chú mới, giữ nguyên nội dung mẫu và lịch sử.

## Các sửa lỗi FE có ý nghĩa

| Nhóm | Nguyên nhân/đổi hành vi |
|---|---|
|Form staff bị trắng|CrudPage truyền `user` vào hàm defaultValue, trong khi hàm ngày nhận `now`, gây Invalid time value. Bọc bốn default ngày bằng hàm không nhận tham số; form lịch/thẻ/giáo án/kết quả mở đúng.|
|Dữ liệu riêng bị cũ|useApi giấu dữ liệu scope cũ ngay render đầu khi dependency đổi; skip/unmount vô hiệu hóa kết quả/401 cũ. Scope App gồm cả token, và401 chỉ xử lý đăng xuất nếu token lúc gửi vẫn là phiên hiện tại; storage bị chặn không làm loader treo. AuthProvider đồng bộ storage giữa các tab và chặn updateUser từ tài khoản/phiên cũ.|
|Thanh toán khi chưa đủ dữ liệu|Ba checkout chờ dữ liệu có thẩm quyền, hiển thị lỗi+retry, chặn submit; cache payment options chỉ lưu200 hợp lệ hoặc404/405 legacy thật. Không biến outage thành thông tin thanh toán cũ.|
|Múi giờ/số chỗ|Ngày học, bắt đầu/kết thúc buổi và guard lớp theo Asia/Ho_Chi_Minh; giữ cách hiển thị timestamp thanh toán/audit hiện có. `currentEnrolled` là số chỗ chính thức có cả giữ chỗ.|
|UX/tải trang|Tab tài khoản đang chọn được cuộn vào vùng nhìn mobile. Có thông báo đọc được sau6giây chờ máy chủ. Tách lazy pages/resource config; giữ header/sidebar khi chờ trang; chat có fallback riêng.|

## Kết quả kiểm thử và evidence

Đường dẫn sau tính từ thư mục FE. Giữ cả báo cáo ban đầu thất bại để truy vết; dùng các lượt cuối dưới đây cho kết luận.

| Bộ kiểm tra | Kết quả cuối | Evidence |
|---|---|---|
|Web thật: khách + Member/Coach/Receptionist/Manager, điều hướng/xem form|211/211;67lượt trang,347APIcalls;0API/runtime errors; không business writes|`artifacts/web-review-2026-11-02/2026-11-02T11-37-20-366Z/report.json`|
|Mobile focus: tab, form Coach, vị trí launcher cạnh hành động chính|32/32;9lượt trang,87APIcalls|`artifacts/web-review-2026-11-02/2026-11-02T11-42-40-399Z/report.json`|
|Chat UI thật + toàn bộ API mô phỏng|43/43;15POSTchat mô phỏng;0runtime errors|`artifacts/web-review-2026-11-02/chat-ui/2026-11-02T18-33-51-958Z/report.json`|
|AuthProvider thật, hai tab cùng localStorage, không API ngoài|13/13|`artifacts/ui-stability-2026-11-02/auth-session/2026-11-02T18-22-41-263Z/report.json`|
|Payment UI + phản hồi mô phỏng, paymentId giả|23/23;1HTTP500 cố ý, đã phục hồi|`artifacts/web-review-2026-11-02/payment-ui/2026-11-02T18-23-47-614Z/ui-feedback.json`|
|useApi thật: dependency/skip/unmount/stale response/401/token mới/storage bị chặn|18/18|`artifacts/ui-stability-2026-11-02/use-api/2026-11-02T18-33-15-690Z/report.json`|
|Ba checkout/ClassDetail thật với API mô phỏng|21/21|`artifacts/ui-stability-2026-11-02/checkout/2026-11-02T11-45-55-568Z/report.json`|
|API client, AI reply/history và thời gian/module thật qua ViteSSR|19/19|`artifacts/web-review-2026-11-02/regressions/2026-11-02T11-39-59-108Z/report.json`|
|Production build cuối|PASS96modules, không còn cảnh báo chunk>500kB|`npm.cmd run build`; `artifacts/web-review-2026-11-02/build-final.json`|

Tổng read-only UI211+32=243checks/76lượt trang/434APIcalls, **không phải test lại toàn bộ144operation Swagger**. Hai lượt UI này trước thay đổi AuthProvider cuối; phiên cuối được xác minh riêng bằng13checks hai tab,18checks useApi (gồm token cũ401/token mới/storage bị chặn) và43checks chat chạy lại sau sửa cuối. Các mock tests không xác nhận nghiệp vụ trên BE. Lượt payment trước22/23 có phép đo peak concurrency cộng dồn qua nhiều full reload/StrictMode; đã sửa harness reset peak ngay trước burst focus/visibility/online, lượt cuối đo đúng max1. Không sửa app chỉ để làm pass test đó. Các lần chat harness startup lỗi do match nhầm đường dẫn Vite/Boolean selector/máy chủ cục bộ tắt không phải lỗi app; giữ raw evidence cũ.

## Hiệu năng, UX và độ ổn định

- Entry JS build trước khoảng572,07kB/gzip161,32kB; build hiện tại **285,38kB/gzip89,20kB**. Các modulepreload trong index cộng entry khoảng341,36kB JS; routes còn lại tải riêng, chat là một chunk11,65kB JS/6,87kB CSS. Đây là dung lượng entry, không phải tổng toàn app hay cam kết tốc độ nhanh gấp đôi. Lazy loading theo cơ chế React: https://react.dev/reference/react/lazy .
- Trong347APIcalls lượt full cuối: median184ms, p95763ms, max2.483ms; trang chậm nhất khoảng3,62giây. Trước đó đã quan sát catalogue chờ31,2–31,7giây rồi200; chưa có log để xác định nguyên nhân. GET nay có deadline45giây bao gồm đọc response body. Không áp deadline/retry tự động cho thao tác ghi thông thường để tránh kết luận sai một giao dịch đã thực hiện.
- Các số đo là Chrome cục bộ+Vite, tắt cache mạng trong harness; **không phải uptime, tải đồng thời, stress test hoặc chứng nhận Core Web Vitals/WCAG**. Ngoài phạm vi này chưa có cơ sở đánh giá ổn định production dài hạn.
- Ưu tiên UX tiếp: bổ sung Coach Copilot sau khi BE trả lời200; biểu đồ tiến bộ nếu nhóm giữ cam kết trong Flow4; kiểm trên iOS/Android thật với bàn phím ảo. Hero slideshow từng có khoảng nền tối ngắn lúc đổi ảnh, nên tinh chỉnh crossfade sau; không chặn thao tác nghiệp vụ. Lượt này giữ nội dung/ảnh demo của người dùng.

## Phần cần BE tiếp tục

Kết quả AI thật gần nhất là **02/11,18:06–18:09 Việt Nam**, không gọi inference mới trong lượt UI này: options200 configured=true/providerVerified=false; Memberchat503 sau5.271ms, Coach exercise503 sau25.206ms, chat retry503 sau25.277ms. Traces `0HNPOQ0CE830U:0000000E`, `...00000016`, `...00000019`. Bản gốc: `artifacts/be-recheck-2026-11-02/ai/2026-11-02T11-06-08-672Z/AI_RECHECK.md`. BE cần HTTP status/body gốc Gemini và logs/quota/project/model/network/timeout để chốt nguyên nhân; chưa đủ bằng chứng kết luận chắc chắn hết quota.

Giữ mở B58/B63/B66 theo evidence Đợt26/28; không đánh dấu đã fix hoặc khẳng định trạng thái deploy03/11 bằng dữ liệu02/11. B59 deadline mới, B60/B43 bypass Pending, B65 xóa Pending mới, B27 restore, B32 jobs và các nghiệp vụ bank/webhook/upgrade/refund cần môi trường/log phù hợp. Không dùng giao dịch thật8.000đ để confirm/cancel/refund hoặc gửi webhook giả. Không tạo thêm QA tài chính khó dọn trên DB dùng chung.

Để chốt AI sau BE sửa: Member hỏi một câu ngắn qua chatbox và kiểm POST200 có reply thật; câu tiếp theo kiểm history; sau đó đối chiếu giá/catalogue và phạm vi dữ liệu riêng. Coach exercise cần roster đúng và200 trước khi làm UI Copilot. Nếu lỗi, lưu giờ Việt Nam, endpoint, status, nội dung lỗi và traceId từ Network để gửi BE. Không quay retry liên tục khi503/429.

Các thay đổi hiện tại là bản cục bộ; chưa tự commit, push hoặc deploy. Không thay BE source, dữ liệu demo, giá20lớp, ảnh của người dùng hoặc giao dịch thật.

## Cập nhật Đợt30 — 03/11/2026

Kết quả AI thật mới thay mốc02/11 ở phần trên: chat503/37.102ms, Coachexercise503/37.213ms; không có reply. Chưa có kiểm thử tải/số người đồng thời chịu được. Xem `../ai-concurrency-review-2026-11-03/AI_AND_CAPACITY.md` và evidence mới được dẫn trong đó. Các số243/43checks ở báo cáo này vẫn giữ đúng phạm vi UI, không phải Gemini hay capacity.
