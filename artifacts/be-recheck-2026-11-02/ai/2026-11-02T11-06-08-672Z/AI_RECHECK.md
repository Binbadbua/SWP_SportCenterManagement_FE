# Kiểm tra lại AI sau BE bổ sung cấu hình — 02/11/2026,18:06–18:09

**Cấu hình đã thay đổi, nhưng AI vẫn chưa trả lời thành công.** Không còn thông báo thiếu Ai__ApiKey như lượt10:09. API hiện qua kiểm tra cấu hình, sau đó trả lỗi quá tải/hạn mức hoặc timeout khi inference. Chưa có log Gemini/Render để xác định chính xác nguyên nhân gốc.

BaseURL: https://sportcenter-deploy-latest-1.onrender.com . Timestamps trong JSON là UTC; cộng7giờ để ra giờ Việt Nam.

## Phản hồi thực tế

GET /api/ai/options200:

```json
{"provider":"Gemini","enabled":true,"configured":true,"configurationIssues":[],"chatAccess":"Authenticated","exerciseAccess":"Coach","providerVerified":false}
```

configured=true chỉ cho biết kiểm tra cấu hình của BE đã đạt. Chưa thể suy ra key hợp lệ với provider, quota còn hay model thực sự trả lời; providerVerified vẫnfalse và mọi lượt inference dưới đây đều503.

| Phép thử | Phản hồi | Thời gian | TraceId |
|---|---|---:|---|
| Member chat, message hợp lệ |503 “Gemini đang quá tải hoặc hết hạn mức. Vui lòng thử lại sau.”|5271ms|0HNPOQ0CE830U:0000000E|
| Coach exercise, memberId từ roster của chính Coach |503 “AI phản hồi quá lâu. Vui lòng thử lại.”|25206ms|0HNPOQ0CE830U:00000016|
| Retry đúng một câu chat ngắn, history=[] |503 “AI phản hồi quá lâu. Vui lòng thử lại.”|25277ms|0HNPOQ0CE830U:00000019|

Chat của Coach/Receptionist/Manager cũng503 timeout, trace ...0000000F/...00000010/...00000011; policy chatAccess=Authenticated cho phép họ gọi. Tổng6request inference qua lượt chính+retry, không có200. Không tiếp tục gửi thêm inference sau khi lỗi lặp lại.

Request chat chính:

```json
{"message":"Trung tâm có những môn thể thao nào? Kể tên một vài môn hiện có trong hệ thống, không đưa ví dụ giả định."}
```

Request retry:

```json
{"message":"Xin chào! Bạn hỗ trợ gì tại SportCenter?","history":[]}
```

Exercise dùng memberId30636352-c38d-4a2b-b332-06aa330a24d2 đã lấy từ roster của Coach, goal hợp lệ, durationMinutes20, equipment=bodyweight, level=beginner. Không phải fixture thiếu ghi danh hoặc sai role.

## Việc BE cần kiểm tra

1. Dùng các traceId trên tìm HTTP status/body gốc Gemini trong Render logs: phân biệt lỗi quota/rate limit, service unavailable, key/model/endpoint hoặc timeout/network. Response503 trả cho FE là thông báo do BE ánh xạ; không dùng nó để kết luận chắc chắn Gemini đã trả429 hay quota đã hết.
2. Xem project/model đang dùng trong Google AI Studio: quota, RPM/TPM/RPD, quyền sử dụng và trạng thái billing nếu model/project yêu cầu. Theo tài liệu Google, hạn mức áp dụng theo project chứ không chỉ từng key; đổi key trong cùng project không tự tạo quota mới. Không thể kiểm tra dashboard này từ phiên làm việc hiện tại.
3. Thử một prompt tối giản từ chính môi trường Render với cùng model/key/URL; giữ response gốc trong log được bảo vệ, không in key vào FE/báo cáo. Đo thời gian từng request và tổng retry để tìm vì sao nhiều lượt chạm khoảng25giây.
4. Với lỗi tạm thời, dùng retry có giới hạn và exponential backoff/jitter; không retry vô hạn hoặc gọi chồng. Phân biệt lỗi không thể xử lý bằng retry và quota ngày đã hết dựa trên lỗi gốc, theo hướng dẫn provider.
5. Sau sửa, chứng minh POST chat và exercise trả200 có reply/suggestions thực chất. Sau đó mới kiểm hội thoại history, dữ liệu gói/giá hiện tại, phạm vi trả lời, quyền Coach theo memberId và hành vi khi provider lỗi. configured=true/HTTP200 ởoptions không thay thế inference thành công.

Nguồn chính thức: [Gemini troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## Các nhánh đã đạt và giới hạn

Anonymous options/chat/exercise401; Member exercise403; chat rỗng/whitespace/>2000 và durationMinutes5 đều400. Chat cho tài khoản đăng nhập phù hợp contract mới. Không coi staff503 là lỗi phân quyền.

Chưa kiểm được chất lượng câu trả lời, history, lịch riêng, giá và từ chối ngoài phạm vi vì provider chưa có câu trả lời. Privacy của payload gửi provider và coach-to-member ownership chưa được xác minh trong lượt này; không ghi Đạt các mục đó.

FE trong workspace vẫn chưa có chatbox/Copilot/api.ai. Lần này kiểm API trực tiếp; không triển khai giao diện AI. Mẫu Flow5 trong file demo chỉ là nội dung chuẩn bị, chưa phải tính năng đã chạy thành công.

## Bằng chứng

- Lượt chính: report.json + swagger.json trong thư mục này;22requests,15checks13pass/2fail. Hai fail là readiness của hai endpoint inference, không phải lỗi thiếu key cũ.
- Một retry ngắn: ../2026-11-02T11-09-25-527Z/report.json;3requests gồm login/options/chat,1checkFAIL. Tổng25HTTPrequest được lưu cho hai lượt, gồm6inferencecalls.
- Script chính: scripts/qa/ai-readiness-recheck.mjs. Không bootstrap QA/account/class/booking/payment; không đổi tiền, mật khẩu, BE source hoặc FE application source. API credentials không lưu trong report.

Các báo cáo10:09/Đợt26 và ghi chú thiếukey trong bản mẫu demo trước là lịch sử. Kết luận mới thay thế phần nguyên nhân cấu hình: cấu hình hiện đầy đủ theo BE, nhưng inference vẫn503; B48 chưa thể đóng.