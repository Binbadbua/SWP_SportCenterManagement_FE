# Kiểm tra các mục còn chờ BE — 02/11/2026

**Chưa thể xác nhận BE đã sửa xong toàn bộ.** Kiểm tra bản deploy `https://sportcenter-deploy-latest-1.onrender.com`, khoảng 10:07–10:16 giờ Việt Nam. Ba khu vực vẫn lỗi: AI thiếu key Gemini (B48), xóa lớp đã có buổi đầu trong quá khứ (B58), quên/đặt lại mật khẩu trả500 (B63). Khoản8.000đ cũ B66 vẫn chưa được ghi nhận Paid trên API.

## Trạng thái toàn bộ danh mục còn chờ / cần kiểm hồi quy

| Mục | Kết quả mới | Đánh giá |
|---|---|---|
| B48 AI chat và gợi ý bài tập | Cả hai503; options báo Gemini, enabled=true, configured=false, configurationIssues=[Ai__ApiKey] | Còn lỗi cấu hình trên service deploy. |
| AI contract / quyền chat | Có GET/api/ai/options; chatAccess=Authenticated, exerciseAccess=Coach; có AiReply và schema lỗi | Có cải thiện. Staff chat không còn là lỗi so với kỳ vọng MemberPolicy cũ. |
| B58 xóa lớp đã bắt đầu | Lớp tạm status1, có buổi31/10, DELETE02/11 trả200; GET sau404 | Còn lỗi. Phải xét thời điểm buổi đầu, không chỉ enum Ongoing. |
| B63 / B36 forgot-reset | Không tồn tại email, OTP sai, thiếu email/body sai đều500 | Còn lỗi; chưa thử gửi email/OTP hoặc đổi mật khẩu thật. |
| B61 quyền đọc training | Coach sở hữu plan/result200; coach khác cùng ID404 | Đạt hồi quy với dữ liệu thực sự tồn tại. |
| B62 kiểm tra ghi danh | Coach tạo plan cho member không ghi danh trong lớp bị400, không tạo plan | Đạt hồi quy. |
| B64 upload | Text400; PNG6MiB413JSON | Đạt hồi quy; không upload ảnh hợp lệ tạo media mới. |
| B11 route export trùng | Swagger chỉ còn route đúng; Receptionist export200; route invoices/invoices cũ404 | Đã sửa alias cũ. Member403 ở staff export là đúng luồng FE, Member in từ danh sách hóa đơn của chính mình. |
| B65 xóa invoice Pending | Invoice cũ đã xóa vẫn404 và không trong list | Không thấy dữ liệu quay lại. Không tạo invoice mới để kiểm lại toàn bộ delete trên DB demo. |
| B60 / B43 chặn confirm/PUT SePay | Trước đây đã xác minh409 | Chưa chạy lại bằng đơn Pending mới; không dùng đơn thật hoặc tạo thêm invoice QA để probe bypass. |
| B59 đồng bộ hết hạn | Đơn membership cũ payment5/invoice3; membership đã404. Đơn class-expiry cũ5/invoice3 | Chỉ xác nhận trạng thái cuối của dữ liệu cũ. Chưa chứng minh đã giảm độ trễ ở deadline mới. |
| B66 khoản chuyển8.000đ cũ | Payment5 Expired, paidAt=null; invoice3 Cancelled, paymentDate=null | Cần BE đối soát giao dịch gốc; không đánh dấu đã xử lý dựa trên giao dịch mới người dùng báo thành công. |
| Chờ xác nhận >30giây ở giao dịch mới | Chưa có paymentId và log ngân hàng/SePay/webhook của giao dịch mới | Chưa đo được toàn trình. FE refresh2giây/quay lại tab đã có kiểm thử trước đó. |
| Dữ liệu QA cũ |3môn,2phòng Tạm ngưng,25invoice liên quan; không có lớp/HLV/gói QA cũ trong list | Chưa dọn sạch; không tự xóa lịch sử tài chính/điểm danh. |
| Manager ghi check-in | Body dùng UUID0 không thể ghi nhận lượt thật, nhận400 thay vì403 | Request tới nghiệp vụ; policy Manager hay chỉReceptionist vẫn cần nhóm chốt. Không coi là đã tạo check-in thành công. |
| B27 khôi phục profile đã xóa | Chỉ có kết quả đọc code cũ; không xóa profile demo | Cần fixture ở môi trường test hoặc BE cung cấp bằng chứng live. |
| B32 tự thông báo đổi lịch/hủy/nhắc hạn | Đọc được notification/audit; không sửa lịch thật để phát thông báo | Chưa xác minh causality hoặc job timer mới. |
| B12/B42 rotation secret cũ | Không thử khóa trong lịch sử hoặc đọc/in secrets | Cần BE/provider xác nhận rotation; API bình thường không chứng minh được. |
| B54/B55 webhook ngân hàng, áp dụng upgrade, hoàn ngân hàng | Không chuyển tiền, không giả webhook, không ép trạng thái | Cần BE/provider log và giao dịch kiểm soát để xác minh các nhánh toàn trình. |

## Nội dung gửi BE

### 1. AI Gemini thiếu Ai__ApiKey — B48

GET `/api/ai/options`200 trả:

```json
{"provider":"Gemini","enabled":true,"configured":false,"configurationIssues":["Ai__ApiKey"],"chatAccess":"Authenticated","exerciseAccess":"Coach","providerVerified":false}
```

POST chat của Member và exercise của Coach với học viên từ roster đều503:

> AI Gemini chưa cấu hình đầy đủ. Kiểm tra tại backend: Ai__ApiKey.

Trace chat `0HNPOHPODEBG2:0000002C`; exercise `0HNPOHPODEBG2:00000034`. BE cần đặt key Gemini hợp lệ trên đúng service Render, restart/redeploy rồi kiểm cả hai endpoint200 có nội dung. Không đưa key vào FE/VITE_. Có options/schema không đồng nghĩa inference thành công; lịch riêng, giá, history, phạm vi trả lời, quota/model/provider chưa được kiểm chứng do chưa có câu trả lời.

### 2. DELETE lớp vẫn bỏ qua buổi đầu đã qua — B58

Fixture duy nhất của lượt này:

- Class `433f3fd9-8212-47ff-b07b-162243703ddd`, tên `QA_DELETE_GUARD_20261102031105`, status1, price0, không học viên.
- Session `10ab181d-44d8-457b-ad78-749c5b545367`, ngày31/10/2026,06:15–06:30. Đã GET kiểm chứng session tồn tại trước phép thử.
- Manager DELETE class ngày02/11 →200 `Class deleted successfully.`; GET cùng ID →404.

BE cần chặn xóa nếu buổi đầu đã bắt đầu theo giờ trung tâm ngay cả khi class.status vẫn1. Không chỉ kiểm status2. Chốt lại các trường hợp Cancelled/Ended và trả lỗi nghiệp vụ rõ ràng theo quy tắc nhóm.

Đã dọn session bằng DELETE204; GET session404. Class detail404 và không trong list. Danh sách20lớp gốc cùng học phí được đọc lại giữ nguyên. Không tạo account/member/category/room/package/booking/invoice mới. Đây là xác minh không còn hiển thị qua API; audit hoặc bản ghi soft delete có thể vẫn được giữ theo thiết kế BE.

### 3. Forgot/reset vẫn500 — B63

- Forgot với email không tồn tại @example.invalid →500, trace `0HNPOHPODEBG2:00000002`.
- Reset cùng email/OTP sai →500, trace `...00000003`.
- Forgot thiếu email, sai định dạng và reset body rỗng →500, trace `...00000004`–`...00000006`.

BE cần kiểm implementation/configuration và validate payload trước nghiệp vụ. Email thiếu/sai định dạng và OTP sai phải có lỗi kiểm soát; forgot email không tồn tại có thể trả thông báo trung tính theo chính sách, không500. Sau đó BE kiểm gửi mail/OTP, hết hạn OTP, chống dùng lại và reset thành công trên tài khoản test dùng riêng. Lượt này không gửi mail tới người thật và không thay đổi mật khẩu.

### 4. Đối soát khoản8.000đ cũ — B66

Payment `8d0d7c03-1384-4457-8554-04f957796eeb`, reference `SWP8D0D7C0313844457855404F957796EEB`, người dùng báo chuyển30/10 lúc13:10:52, nội dung ngân hàng `CUSTOMER SWP8D0D7C0313844457855404F957796EEB - Ma giao dich/Trace 377757`. API hiện vẫnExpired5/paidAtnull; invoiceCancelled3/paymentDatenull. Cần tra giao dịch gốc và xử lý đối soát có chứng từ; không yêu cầu chuyển lại hoặc dùng confirm/webhook giả để ép Paid. Việc chuyển/nhận tiền là thông tin người dùng cung cấp, chưa có quyền truy cập ngân hàng/SePay kiểm chứng độc lập.

Để tối ưu thời gian>30giây của giao dịch mới, BE cần correlation theo đúng paymentId: bank timestamp→SePay event→webhook received→DB commitPaid→GET trảPaid. GET của đơn cũ không xác định được đoạn chậm của giao dịch mới. Các đơn mới người dùng nói đã thành công chưa có ID trong lượt này.

## Lỗi FE phát hiện và đã sửa

`src/pages/staff/resources.jsx` trước đây bỏ sessionId khi gửi training-result và suy lại buổi theo ngày, có thể chọn sai khi hai buổi cùng ngày. Đã ưu tiên ID BE trả về, chỉ suy legacy khi đúng một buổi khớp, không xóa ID khi tải lịch lỗi; request tạo/sửa gửi sessionId đã chọn hoặc null khi bỏ chọn.

`scripts/qa/training-result-session-regressions.mjs` kiểm cấu hình thật qua Vite SSR với API trong bộ nhớ, chặn fetch:9/9PASS. Build FE92modules thành công, chỉ còn cảnh báo chunk>500kB có từ trước. Không tạo attendance/training-result thật để kiểm form. Không sửa BE source; thay đổi FE chưa tự commit/push/deploy. Giữ nguyên ảnh/lớp demo và các thay đổi đang có của người dùng.

## Phạm vi, số liệu và bằng chứng

96HTTPrequest được lưu trong bốn lượt chốt dưới đây (có login/GET/setup/cleanup), không phải kiểm lại toàn bộ144operation trong Swagger. Swagger tăng143→144 do thêm GET/api/ai/options; không có operation cũ bị gỡ ngoài alias đã được gỡ từ trước snapshot30/10.

- AI: `ai/2026-11-02T03-09-21-358Z/report.json`,15checks13pass/2fail,22requests. `ai/AI_RESULTS.md` giải thích contract mới. Lượt timeout và lượt trước options giữ nguyên lịch sử.
- Auth/upload: `auth-upload/2026-11-02T03-07-10-901Z/report.json`,7checks2pass/5fail,9requests. Năm fail là các trường hợp auth cùng khu vực B63, không phải năm lỗi độc lập. Lượt Swagger timeout đầu giữ riêng.
- Business: `business/2026-11-02T03-11-05-021Z/report.json`,38checks35pass/3fail,59requests. Hai fail là cùng lỗi B58; một fail export Member là kỳ vọng ban đầu sai, đã kiểm lại đúng quyền bên dưới. Không coi403 đó là bug BE.
- Export follow-up: `export/2026-11-02T03-16-08-892Z/report.json`,3/3PASS,6requests. Receptionist canonical200, Member403 đúng luồng FE, alias cũ404. Script business đã sửa kỳ vọng cho lần chạy sau, không ghi đè report cũ.

Mỗi lượt đầu Swagger có thể timeout rồi truy cập lại200; chưa xác định cold start/service/network, không coi đó là lỗi nghiệp vụ AI/password. Các kết luận dựa vào phản hồi HTTP thực tế sau khi kết nối thành công.

Scripts mới: ai-readiness-recheck.mjs, auth-upload-recheck.mjs, be-pending-recheck.mjs. Script business mặc định chỉ đọc; --class-probe tạo đúng một class/session không học viên rồi dọn, --plan-guard thử reject non-enrolled plan và dọn nếu bất ngờ được chấp nhận. Không tái chạy suite bootstrap/cleanup cũ với ID đã xóa.

Nhóm xác nhận chỉ có bản deploy hiện tại. Vì vậy không tạo thêm đơn chờ/invoice/membership/check-in hay xóa/khôi phục hồ sơ demo để kiểm các nhánh để lại lịch sử không dọn được. Các mục chưa đủ bằng chứng vẫn ghi rõ ở bảng, không chuyển thành Đã sửa chỉ vì HTTP200 ở một nhánh khác.

## Cập nhật AI lúc18:09 ngày02/11 — Đợt28

Kết quảAI mới thay phần thiếukey trong báo cáo buổi sáng: options hiện configured=true/configurationIssues=[], nhưng chat và exercise vẫn503 quá tải/hạn mức hoặc timeout; một câu chat ngắn retry cũng timeout~25giây. AI chưa có phản hồi200. Xem `ai/2026-11-02T11-06-08-672Z/AI_RECHECK.md`; các mục khác của báo cáo này không được kiểm lại trong lượt chỉAI này.