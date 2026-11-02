# Vì sao dữ liệu QA chưa xóa hết — kiểm tra 30/10/2026

Đã đọc lại API bằng Manager, không thực hiện DELETE hay thay đổi giao dịch trong lượt này.

| Loại | Bản ghi liên quan QA đang hiển thị |
|---|---:|
| Môn thể thao |3|
| Phòng tập |2 (đều status2/Tạm ngưng)|
| Lớp học |0|
| HLV |0|
| Gói tập |0|
| Hóa đơn liên quan tên lớp/gói/member QA |25|

## Các môn/phòng còn lại

| Loại | Tên | ID |
|---|---|---|
| Môn | QA261029163854 Sport |88a8990c-0afe-4f96-9384-48ce49884531|
| Môn | QA_RECHECK_261030060103 sport |79e90d3f-da62-4f11-97aa-45382d072fbb|
| Môn | QA_RECHECK_261030060850 sport |5ecaed96-37cd-4fcb-9671-69f7fd719673|
| Phòng | QA261029163854 Room |575edba3-e48e-43d1-a4ef-3beee1252a5f|
| Phòng | QA_RECHECK_261030060850 room |c2a863ed-05fc-4caa-bbe5-6d38821d087f|

## Lý do xóa bị chặn

Các report cleanup đã ghi phản hồi BE:
- DELETE session có điểm danh →400 “Không thể xóa buổi học này vì đã có dữ liệu điểm danh.”
- DELETE room →400 “Không thể xóa phòng này vì đã có lịch buổi học được xếp trong phòng.”
- DELETE category →400 “Không thể xóa bộ môn này vì đang có lớp học thuộc bộ môn này.”
- DELETE coach trước đó →400 do có lớp phụ trách; tài khoản đã được xóa ở một số lượt nên việc dọn sau đó khó hơn. Hiện danh sách HLV không còn QA hiển thị.
- API hiện không có DELETE attendance/check-in/audit để xóa chuỗi lịch sử theo cách thông thường.
- FE chỉ mở thao tác xóa invoice ở trạng thái Pending và không chờ refund; Manager chỉ xem hóa đơn, Receptionist có quyền ghi. Các invoice liên quan QA hiện ở Paid/Cancelled/Refunded, nên có thể bị khóa ở FE hoặc bị BE từ chối theo policy đã quan sát.

Lớp không hiện trong list không chứng minh tất cả dữ liệu liên quan đã bị xóa vật lý. Có thể còn lớp/session/history hoặc quan hệ với bản ghi soft delete. Cần BE đối chiếu DB và điều kiện kiểm tra liên kết; lượt này chỉ đọc API, không xác minh internals DB.

## Phần dọn chưa hoàn tất

Các bài test trước tạo chuỗi member→booking→session→attendance/training và membership→invoice/refund. Cleanup đã dọn được nhiều bản ghi nhưng chưa xử lý hết chuỗi phụ thuộc; không nên mô tả là đã xóa sạch. Một số tài khoản được xóa khi profile/lịch sử vẫn còn ràng buộc.

Nhờ đội BE rà đúng dataset các run QA261029163854, QA_RECHECK_261030060103 và QA_RECHECK_261030060850 để dọn dữ liệu thử theo ID và thứ tự phụ thuộc, hoặc đưa lịch sử QA ra khỏi dữ liệu demo đang sử dụng. Rà cả soft delete và thống kê doanh thu; không sửa số liệu bằng cách ẩn hàng trên FE.

**Có25invoice liên quan tên QA, không được suy ra cả25 đều có thể tự động xóa.** Invoice d39dc5c8-111e-4a69-94ae-dde816bbabe2 dùng package QA nhưng member không có tiền tố QA; phải kiểm tra người tạo/giao dịch trước khi đưa vào danh sách dọn. Giữ dữ liệu demo người dùng nhập,20giá lớp và giao dịch thật8.000đ của B66 cùng chứng từ đối soát.

Bằng chứng cũ: ../api-audit-2026-10-29/cleanup.json, ../api-audit-2026-10-29/cleanup-tail.json và ../be-recheck-2026-10-30-060850/report.json (trường cleanup).
