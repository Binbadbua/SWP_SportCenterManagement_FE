# Kiểm lại AI sau BE báo fix — Đợt32,03/11/2026

**Kết luận: AI thật vẫn chưa trả lời thành công.** Kiểm bản deploy hiện tại khoảng09:50–09:51 giờ Việt Nam. Đã dừng sau hai inference chạy tuần tự; không retry khi BE báo hạn mức ngày.

BaseURL: https://sportcenter-deploy-latest-1.onrender.com . Evidence cùng thư mục: `report.json`; timestamp thư mục là UTC. Script hiện có: `scripts/qa/ai-timeout-recheck.mjs`.

## Kết quả mới

| Phép thử | HTTP | Thời gian | Nội dung/trace |
|---|---|---:|---|
|GET /api/ai/options bằng Member|200|789ms|Gemini, enabled=true, configured=true, configurationIssues=[], providerVerified=false.|
|POST /api/ai/chat bằng Member, câu ngắn/history=[]|503|25.078ms|AI phản hồi quá lâu; trace `0HNPPAL68VSIM:00000003`.|
|POST /api/ai/exercise-suggestions bằng Coach, học viên lấy từ roster của chính Coach|503|801ms|Gemini đã chạm hạn mức ngày của project; trace `0HNPPAL68VSIM:00000006`.|

Chat gửi `{"message":"Xin chào! Bạn hỗ trợ gì tại SportCenter?","history":[]}`. Exercise dùng member hợp lệ trong roster, goal tăng sức bền cho người mới, durationMinutes20, equipment bodyweight, level beginner. Không phải payload rỗng, sai role hoặc tự tạo học viên chưa ghi danh.

Tổng6HTTPcalls:2login,options,roster và2inference.3checks:1pass cho options,2fail cho nội dung trả lời. Không có reply/suggestions thành công. Script hoàn tất chẩn đoán; exit1 phản ánh hai endpoint không đạt, không phải script bị lỗi. Không tạo account/booking/invoice/QA hoặc ghi dữ liệu tài chính; không stress test và không sửa source BE.

So với Đợt30 lúc01:46, chat nay trả lỗi khoảng25giây thay37giây; exercise trả lỗi nhanh kèm thông báo hạn mức ngày cụ thể. Đây chưa phải bằng chứng AI đã hoạt động hoặc độ trễ trả lời đã cải thiện, vì cả hai đều503. FE chờ35giây; chat thất bại ở25giây là lỗi BE đã trả về trước deadline FE.

## Việc cần gửi đội BE

1. Tra `0HNPPAL68VSIM:00000003` và `0HNPPAL68VSIM:00000006` trong log deploy; cung cấp HTTP status/body gốc Gemini và thời gian context/queue/provider/retry. Chat timeout và exercise báo quota là hai quan sát khác nhau; chưa chứng minh cùng một nguyên nhân.
2. Kiểm project/model đang được BE sử dụng và quota thực tế trong Google AI Studio, nhất là requests-per-day. BE đã báo rõ quota ngày nhưng phiên này không có quyền xem dashboard/provider logs để xác minh giới hạn còn lại hoặc tính đúng của nhánh ánh xạ lỗi.
3. Hạn mức Gemini áp dụng theo project, không theo từng API key; đổi key trong cùng project không tự tăng quota. Đối chiếu [tài liệu rate limits chính thức](https://ai.google.dev/gemini-api/docs/rate-limits) và [trang quota AI Studio](https://aistudio.google.com/rate-limit). Không yêu cầu gửi key cho FE hoặc đưa key vào VITE_.
4. Khi xác định hết hạn mức ngày, xử lý theo quota được cấp và thời điểm khôi phục thực tế; không lặp retry liên tục. Theo [hướng dẫn lỗi Google](https://ai.google.dev/gemini-api/docs/troubleshooting), retry cần có giới hạn và dành cho lỗi có khả năng phục hồi; không dùng tăng timeout FE làm bằng chứng đã fix.
5. Chỉ báo hoàn tất sau khi cả chat và exercise có200 kèm reply/suggestions thật từ bản deploy. Sau đó mới kiểm tiếp hội thoại, catalogue/giá, dữ liệu riêng và quyền Coach theo memberId.

Có thể gửi nhanh cho BE:

> Lúc09:50–09:51 ngày03/11 Việt Nam, chat vẫn503 timeout25,078giây; exercise503 sau0,801giây báo Gemini chạm hạn mức ngày của project. Options200 configured=true nhưng chưa có reply thành công. Nhờ đối chiếu project/model/quota và provider logs theo trace ...00000003/...00000006; sau xử lý gửi kết quả200 thật của cả hai endpoint.

## Sửa thông báo FE đi kèm

`src/lib/ai.js` nay nhận diện hạn mức ngày cho503/429 trước nhánh quota/quá tải chung. Hiển thị: “Trợ lý AI đã hết hạn mức sử dụng trong ngày. Vui lòng liên hệ trung tâm hoặc quay lại sau khi hạn mức được khôi phục.” Không hứa thử lại sau vài phút hoặc một giờ reset chưa được xác minh. Lỗi quota không rõ loại/quá tải vẫn dùng nhánh tạm thời; không tự retry hay khóa vĩnh viễn nút gửi.

Đã nạp helper FE thật và replay hai body lỗi vừa nhận: chat vẫn thông báo timeout, exercise hiển thị đúng hạn mức ngày. Bộ hồi quy hiện có19/19PASS (controlled fetch, không gọi provider) tại `../../web-review-2026-11-02/regressions/2026-11-03T02-54-51-503Z/report.json`; build96modulesPASS. Không tính các kết quả local này là AI thật thành công.

## Giới hạn còn lại

Chưa kiểm được history, dữ liệu giá/catalogue, lịch riêng, phạm vi hoặc chất lượng phản hồi vì provider chưa trả nội dung. Không gửi thêm inference để tránh lặp gọi khi quota bị báo hết. Không có kiểm thử tải/số người đồng thời trong lượt này. Các thay đổi FE/tài liệu là cục bộ, chưa commit/push/deploy. Giữ nguyên toàn bộ evidence và ghi chú cũ.
