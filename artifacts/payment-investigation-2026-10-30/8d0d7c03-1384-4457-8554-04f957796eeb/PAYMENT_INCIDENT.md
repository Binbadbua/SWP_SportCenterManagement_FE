# Đối soát thanh toán thật chưa được ghi nhận — 30/10/2026

## Thông tin chuyển khoản do người dùng cung cấp

- Đơn/paymentId: `8d0d7c03-1384-4457-8554-04f957796eeb`.
- Mã thanh toán: `SWP8D0D7C0313844457855404F957796EEB`.
- Lớp: Zumba Sôi Động Cuối Tuần.
- Số tiền: **8.000 VND**, người dùng xác nhận ngân hàng đã trừ và bên nhận đã nhận.
- Thời gian chuyển: **30/10/2026 13:10:52 giờ Việt Nam**, theo người dùng.
- Nội dung nguyên văn người dùng đọc trong lịch sử ngân hàng:

```text
CUSTOMER SWP8D0D7C0313844457855404F957796EEB - Ma giao dich/Trace 377757
```

Trace377757 là số người dùng cung cấp từ ngân hàng, chưa xác minh đó là SePay transaction id/referenceCode. Chưa truy cập lịch sử ngân hàng hay nhật ký SePay để kiểm chứng độc lập.

## Đã đọc trực tiếp từ API deploy

API: https://sportcenter-deploy-latest-1.onrender.com

| Thời điểm Việt Nam | GET payment | GET invoice |
|---|---|---|
| 13:20:59 | HTTP200, providerSePay, amount8000, status1 Pending, paidAtnull, paymentReference khớp nguyên mã | HTTP200, status1, paymentDatenull, amount8000 |
| 13:30:00 | HTTP200, status5 Expired, paidAtnull, amount8000 | Request timeout/không nhận HTTP (status0 trong script), không kết luận trạng thái invoice lần này |

expiresAt=`2026-10-30T06:25:20.529858+00:00` = **13:25:20 giờ Việt Nam**. Thời gian chuyển do người dùng báo nằm trong hạn. Nội dung vẫn giữ nguyên toàn bộ mã SWP, dù có tiền tố CUSTOMER và hậu tố trace; không quy kết người dùng nhập sai mã. QR của API dùng bankBin970403 và tài khoản kết thúc8731; chi tiết gốc ở các snapshot.

FE gọi GET để đọc trạng thái; nút Kiểm tra lại không gọi ngân hàng và không tự xác nhận đã nhận tiền. API chưa Paid nên giao diện chưa thể hiển thị thành công. Nguyên nhân gốc chưa thể xác định khi không có log giao dịch/webhook; các khả năng cần kiểm tra gồm đồng bộ ngân hàng→SePay, webhook chưa được gửi/đúng bộ lọc, URL/xác thực lỗi, hoặc xử lý đối soát không nhận ra mã.

## Thông tin gửi đội BE để xử lý

1. Tìm giao dịch8.000đ lúc13:10:52 trên đúng tài khoản SePay, đối chiếu nguyên nội dung/trace và lấy transaction id thực tế. Kiểm tra liên kết ngân hàng và bộ lọc webhook nếu SePay chưa có giao dịch.
2. Kiểm tra nhật ký POST tới `https://sportcenter-deploy-latest-1.onrender.com/api/sepay/webhook`: đã gửi chưa, thời gian, HTTP status, response body và payload đã nhận. Đối chiếu phương thức xác thực đang cấu hình; không chia sẻ secret trong report.
3. Với payload đúng, kiểm tra transferType=in, transferAmount=8000, accountNumber đúng; kiểm tra code/content. code có thể null hoặc trích không đúng nếu cấu hình mẫu mã không khớp SWP+32ký tựhex; BE cần tìm mã hợp lệ trong content, không so cả chuỗi CUSTOMER...Trace... với paymentReference và không chỉ chấp nhận mã ở đầu chuỗi.
4. Đối chiếu transactionDate giờ Việt Nam với expiresAt UTC. Khoản chuyển được báo trước hạn nhưng đơn đã tự hết hạn: cần quy trình đối soát có nhật ký để gắn đúng giao dịch thật/giải quyết đơn hoặc hoàn tiền phù hợp, tránh ghi nhận trùng. Không dùng nút confirm cũ của SePay để bỏ qua chứng từ/ngân hàng.

Theo [tài liệu webhook SePay](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook), content là nội dung gốc và code có thể null; webhook cần được nhận và xử lý đúng. Xem thêm [cấu hình mã thanh toán](https://developer.sepay.vn/vi/sepay-webhooks/cau-hinh-ma-thanh-toan) và [hướng dẫn theo dõi log](https://docs.sepay.vn/tich-hop-webhooks.html). Đây là căn cứ kiểm tra tích hợp, không phải bằng chứng rằng webhook của đơn này đã tới BE.

## Phần FE đã sửa

- Bấm Kiểm tra lại có “Đang kiểm tra…” và khóa nút trong lúc đọc.
- BE còn Pending thì thông báo rõ chưa nhận được xác nhận và không chuyển lại.
- Các trạng thái hủy/hết hạn vẫn có nút kiểm tra lại để theo dõi đối soát muộn.
- Polling và thao tác thủ công dùng chung request đang chạy, không xếp chồng request chậm.
- Chỉ hiển thị Paid từ kết quả API, không từ lời xác nhận hay thông số trên URL.

Build thành công. `../ui-feedback.json` đạt17/17 với phản hồi GET **mô phỏng** cho một UUID QA cố định; gồm Pending, Paid, Expired, HTTP500 có chủ đích. Không cập nhật đơn thật, không gọi confirm/cancel/refund/webhook, không chuyển/hoàn tiền. Lượt đầu local5173 không chạy được lưu riêng `ui-feedback-no-local-server.json`; lượt đạt chạy trên preview5174.

Bằng chứng API đọc thật: snapshot-initial.json, snapshot-<UTC timestamp>.json và snapshot.json (bản mới nhất). Không xóa snapshot ban đầu khi đọc lại.
