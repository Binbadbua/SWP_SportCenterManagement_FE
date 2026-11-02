# AI thật và khả năng chịu tải — 03/11/2026 (Đợt30)

**AI thật vẫn chưa hoạt động trong lượt kiểm này. Chưa có phép đo số người đồng thời mà web chịu được.** Các kiểm tra UI trước đó không chứng minh hai điều này. Lượt mới kiểm trên BE đang deploy, khoảng01:46–01:47 giờ Việt Nam; không sửa BE hoặc tạo tải đồng thời.

## Kết quả API thật

Base: https://sportcenter-deploy-latest-1.onrender.com . Evidence: `2026-11-02T18-46-05-269Z/report.json` (UTC, tương ứng03/11 Việt Nam).

| Phép thử | HTTP | Thời gian | Kết quả |
|---|---|---:|---|
|GET /api/ai/options, Member|200|86ms|Gemini, enabled=true, configured=true, configurationIssues=[], providerVerified=false.|
|POST /api/ai/chat, Member, câu ngắn/history=[]|503|37.102ms|Không có reply; báo AI phản hồi quá lâu. Trace `0HNPP22KCMNPC:0000000B`.|
|POST /api/ai/exercise-suggestions, Coach, học viên từ roster của chính Coach|503|37.213ms|Không có reply/suggestions; cùng thông báo timeout. Trace `0HNPP22KCMNPC:0000000E`.|

Payload chat: `{"message":"Xin chào! Bạn hỗ trợ gì tại SportCenter?","history":[]}`. Hai inference được gửi tuần tự, không retry; tổng6HTTPcalls gồm2login/options/roster và2inference. Không có bài test tải, tài khoản mới, ghi danh hoặc đơn tài chính. Script: `scripts/qa/ai-timeout-recheck.mjs`.

Body lỗi BE có title/detail/message: “AI phản hồi quá lâu. Vui lòng thử lại sau, không gửi nhiều yêu cầu cùng lúc.” Đây là lỗi trả về từ BE; chưa có response gốc Gemini để chốt lỗi ở model/quota/network/retry/queue. Việc script chỉ gửi tuần tự không có nghĩa không có người khác đang dùng server.

## Vì sao chatbox không trả lời?

Chatbox FE giới hạn chờ35giây, sau đó cho người dùng thử lại. Phép thử API trực tiếp chờ tối đa55giây cho thấy BE vẫn kết thúc bằng503 sau khoảng37giây. Vì vậy trong lượt này không có câu trả lời thành công để FE hiển thị. Tăng timeout FE đơn thuần sẽ vẫn gặp503 ở các request đã đo; không có bằng chứng cách đó sửa được AI.

43/43 ở Đợt29 kiểm widget bằng API mô phỏng: gửi/history/thử lại/hủy/đổi phiên/mobile/lỗi. Nó xác nhận giao diện và xử lý tình huống, không xác nhận Gemini đã chạy. Các lượt AI thật trước và hiện tại được lưu riêng, đều chưa có200 trả nội dung. configured=true chỉ là kiểm tra cấu hình của BE, không phải thành công của inference.

Đội BE cần:

1. Tra hai traceId mới, lấy HTTP status/body gốc từ Gemini và thời gian từng giai đoạn: chờ hàng đợi, đọc DB/context, gọi provider, retry. Không đưa key hoặc dữ liệu riêng vào log công khai.
2. Gọi prompt tối giản từ chính môi trường deploy bằng cùng model/key/project; kiểm endpoint/model, quyền, quota và mạng. Lỗi503 do BE ánh xạ không đủ để kết luận chắc chắn hết quota. Hạn mức Gemini được tính theo project; xem [tài liệu Google](https://ai.google.dev/gemini-api/docs/rate-limits).
3. Chốt tổng ngân sách thời gian và retry có giới hạn, phù hợp deadline FE; kiểm propagation của cancellation và số request AI đang xử lý. Dừng chờ ở FE chưa chứng minh provider đã dừng.
4. Gửi bằng chứng cả chat và exercise trả200 có reply thật trước khi đánh dấu đã fix. Sau đó mới kiểm history, giá/catalogue, dữ liệu riêng và chất lượng câu trả lời. Hướng dẫn lỗi provider: [Gemini troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting).

## Nhiều người vào cùng lúc

Chưa chạy load/stress test, chưa có quyền đọc cấu hình/metrics hosting và DB của bản deploy. Source BE trong workspace là bản cũ nên không dùng để kết luận bản deploy đã có hoặc chưa có rate limiting, cache, pool, scale. Không bảo đảm web không sập hoặc tuyên bố chịu được50/100/1.000người từ các kiểm tra điều hướng trước đó.

| FE hiện có | Giới hạn |
|---|---|
|Lazy routes, chia bundle; cache/gộp payment options trong tab|Giảm tải một phần, không tăng tài nguyên server hoặc cache dùng chung.|
|Chat chỉ một request mỗi widget, không tự retry, timeout và bỏ phản hồi cũ|Mỗi người/tab vẫn tạo request riêng; cần hạn mức và giới hạn AI đồng thời ở BE.|
|Payment Pending SePay polling2giây, bỏ tab ẩn, gộp GET đang chạy và dừng ở trạng thái cuối|100người cùng mở màn hình Pending có thể tạo khoảng50GET/giây;1.000người khoảng500GET/giây chỉ riêng polling, giả sử phản hồi nhanh hơn2giây. Đây là phép tính lưu lượng, không phải kết quả đo khả năng server.|
|Timer/listener có cleanup; useApi không commit kết quả cũ|Generic loader chưa hủy mọi request mạng cũ, reload nhiều vẫn có thể tăng request. Có list dùng pageSize500; cần phân trang phía server khi dữ liệu lớn.|

Không suy lỗi AI hiện tại là do quá nhiều người truy cập: lượt này không có số liệu traffic/CPU/DB/provider để chứng minh.

## Kế hoạch xác minh chịu tải cần phối hợp BE

Đây là đề xuất, chưa được chạy. Cần chốt mức sử dụng dự kiến và môi trường/cửa sổ có giám sát; hiện nhóm chỉ có DB deploy dùng chung. Không tự bắn stress vào đó hoặc tạo hàng loạt booking/thanh toán thật.

- Bắt đầu đọc catalogue bằng5người dùng ảo, tăng10→25→50 theo mức đã chốt; có thời gian nghỉ mô phỏng người thật. Số virtual users không đồng nghĩa số HTTPrequest đang xử lý cùng lúc. Đo FE static hosting riêng với BE/DB.
- Đo RPS thực, p95/p99, timeout/5xx/429, CPU/RAM/restart, DB connections/query và khả năng hồi phục sau giảm tải. Đặt ngưỡng và dừng sớm khi lỗi/tài nguyên tăng; ngưỡng ví dụ p95<2giây và5xx/timeout<1% cho API đọc cần được nhóm thống nhất, chưa phải SLO hiện có. [k6 thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) hỗ trợ tiêu chí latency/error rate.
- AI kiểm riêng sau khi một request đã thành công, theo quota được cấp; không trộn hàng trăm inference vào test đọc. Cần rate limit theo người dùng và giới hạn tổng số AI request đồng thời, hàng đợi có giới hạn, trả lỗi rõ khi hết sức chứa. Tham khảo [ASP.NET Core rate limiting](https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-8.0).
- BE/hosting xác nhận cache và phân trang, pool/index truy vấn, capacity và phương án tăng tài nguyên. Giữ chỗ phải atomic để không vượt sĩ số, payment/webhook cần idempotency; hiệu năng tốt không thay thế tính đúng khi tranh chấp. Chỉ kiểm phần ghi bằng fixture/môi trường có đường dọn dữ liệu rõ.
- Đánh giá cách giảm polling khi nhiều người dùng (backoff phù hợp hoặc đẩy sự kiện theo contract BE). Giữ polling2giây hiện tại vì trước đó người dùng yêu cầu phản hồi nhanh; chưa tự đổi hành vi FE trong lượt hỏi này.

Không sửa application source, không cần build lại. Chỉ thêm script chẩn đoán và tài liệu. Không commit/push/deploy.
