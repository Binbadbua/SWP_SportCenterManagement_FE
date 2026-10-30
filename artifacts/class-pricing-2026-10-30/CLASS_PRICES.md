# Học phí lớp mẫu — 30/10/2026

Giá VNĐ cho **cả khóa**, trước giảm theo thẻ thành viên. Đây là dữ liệu mẫu được người dùng yêu cầu, không phải khảo sát giá thị trường.

Manager có thể sửa tại **Khu vực nhân viên → Lớp học → Sửa → Học phí cả khóa (VND) → Lưu thay đổi**.

| Lớp | Giá cũ | Giá mẫu/cả khóa |
|---|---:|---:|
| Boxing Đốt Mỡ Cấp Tốc | 0 đ | 1.500.000 đ |
| Yoga Chào Mặt Trời | 0 đ | 900.000 đ |
| Bơi Lội Trẻ Em K2 | 0 đ | 1.200.000 đ |
| Pilates Trị Liệu Cột Sống | 0 đ | 1.800.000 đ |
| Zumba Sôi Động Cuối Tuần | 0 đ | 800.000 đ |
| Kickboxing Căn Bản Nữ | 0 đ | 1.600.000 đ |
| Cầu Lông Sinh Viên | 0 đ | 600.000 đ |
| Bóng Rổ Thiếu Niên U15 | 0 đ | 1.000.000 đ |
| Gym Kỹ Thuật Nâng Cao | 0 đ | 2.000.000 đ |
| Đạp Xe Cardio Giảm Cân | 0 đ | 900.000 đ |
| Tennis Cơ Bản Cho Người Mới | 0 đ | 2.400.000 đ |
| Bóng Bàn Phản Xạ Nhanh | 0 đ | 1.000.000 đ |
| Futsal Phong Trào Tối Thứ 3-5 | 0 đ | 750.000 đ |
| Chạy Bộ 10K Buổi Sáng | 0 đ | 600.000 đ |
| HIIT Đốt Mỡ 45 Phút | 0 đ | 1.200.000 đ |
| Bóng Chuyền Hơi Nam Nữ | 0 đ | 650.000 đ |
| Taekwondo Thiếu Niên | 0 đ | 1.500.000 đ |
| Muay Thai Kỹ Thuật Đối Kháng | 0 đ | 1.800.000 đ |
| Pickleball Nhập Môn | 0 đ | 1.600.000 đ |
| Leo Núi Trong Nhà Cơ Bản | 0 đ | 2.200.000 đ |

Đã xác minh GET từng lớp và danh sách công khai sau cập nhật. Chỉ gửi PUT các lớp trong before.json; giữ nguyên tên, môn, HLV, sĩ số, ngày, trạng thái và lịch học. Giá booking/hóa đơn cũ được đọc lại để xác minh không bị tính lại.

Bằng chứng: before.json, prepare.json, apply.json, after.json và ui.json.
