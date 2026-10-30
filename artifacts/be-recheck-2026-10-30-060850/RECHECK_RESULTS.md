# Kiểm tra nhanh BE sau thông báo đã fix — 30/10/2026

API: https://sportcenter-deploy-latest-1.onrender.com

Dữ liệu QA riêng: QA_RECHECK_261030060850. Báo cáo chính: report.json; Swagger của lượt này: swagger.json.

| Mục | Kết quả xác minh |
|---|---|
| B60 — confirm thủ công SePay | Đã sửa: Receptionist POST confirm nhận409; GET lại payment vẫn Pending1. |
| B61 — đọc training của coach khác | Đã sửa: coach sở hữu đọc plan/result200; coach khác đọc cùng ID404. |
| B62 — plan cho member ngoài lớp | Đã sửa: POST trả400 “Học viên chưa có lượt ghi danh hợp lệ trong lớp này.”. |
| B64 — upload lớn | Đã sửa trong phép thử6MiB: trả413 JSON “Ảnh không được vượt quá5MiB.”. |
| B65 — xóa invoice chờ | Đã sửa: DELETE200, GET detail404 và bản ghi không còn trong list. |
| B58 — xóa lớp đã bắt đầu nhưng status1 | Chưa sửa: DELETE200, GET lại404 trên lớp QA có buổi đầu ở quá khứ. |
| B63 — forgot/reset password | Chưa sửa: cả hai POST vẫn500 với email QA không tồn tại. |
| B48 — hai API AI | Còn503 vì chưa cấu hình Ai__Enabled/Ai__ApiKey/Ai__Model. |
| Quyền Manager ghi check-in | Cần chốt nghiệp vụ: nhận400 “chưa có thẻ” thay vì403, cho thấy request vẫn qua policy vào xử lý nghiệp vụ. Chưa thử ghi thành công bằng Manager trong lượt này. |
| B59 — hết hạn15phút | Chưa kiểm tra lại vì đây là lượt nhanh; không dùng hủy đơn làm bằng chứng đã sửa hết hạn. |

BE bổ sung quy tắc training: ghi kết quả khi chưa điểm danh Có mặt trả400. Sau khi coach điểm danh Present, tạo result thành công và kiểm tra quyền đọc đúng. Lượt đầu ở ../be-recheck-2026-10-30-060103/ dừng vì fixture thiếu attendance; đây là tiền điều kiện mới, không kết luận thành lỗi BE.

Lượt chính24 kiểm tra:17 đạt,7 không đạt;7 gồm các quan sát trùng của cùng lỗi và1 kỳ vọng policy check-in cần nhóm chốt, không phải7 lỗi độc lập.84 HTTP requests gồm setup/test/cleanup. Lượt đầu48 requests được giữ riêng làm lịch sử.

Không sửa source BE hoặc source ứng dụng FE. Đã đối chiếu20 giá lớp mẫu không đổi. Cleanup gọi23 thao tác và tuân thủ4 ràng buộc giữ lịch sử; session có attendance, room/category/coach liên quan và một số lịch sử tài chính/audit QA có thể còn. Xem cleanup trong report.json để lấy ID và phản hồi; không coi đây là dữ liệu kinh doanh thật.

Chưa chạy lại toàn bộ143API hoặc toàn bộ UI; không chuyển tiền thật, không kiểm webhook SePay hợp lệ hoặc luồng email/OTP thực tế.
