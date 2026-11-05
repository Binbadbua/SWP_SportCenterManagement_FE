# Xác minh công nghệ Frontend SportCenter — 03/11/2026

> **Cập nhật04/11/2026 — Đợt35:** Home/Login đã được thiết kế lại bằng React hiện có; PromoStrip được gỡ theo yêu cầu và font đổi sang Be Vietnam Pro. Vite được vá lên8.3.3. Các đoạn code/line number/banner và ảnh bằng chứng phía dưới phản ánh lần xác minh03/11, được giữ làm lịch sử. Xem [bản cập nhật UI](HOME_LOGIN_UI_UPDATE.md) cho trạng thái mới.

**Kết luận:** Frontend trong dự án này dùng React và Vite. Không tìm thấy bằng chứng dự án tích hợp hoặc vận hành FE bằng WordPress. Người dùng xác nhận buổi demo mở bản local. Dòng “Lớp mới mở mỗi tuần / Tìm lớp học” là nội dung của component React `PromoStrip`, không phải dấu hiệu nhận diện WordPress.

## Công nghệ đã xác minh

| Thành phần | Phiên bản cài đặt | Vai trò |
|---|---|---|
|React và ReactDOM|19.3.0|Xây dựng và render giao diện bằng component JSX.|
|React Router|7.18.4|Điều hướng các trang lớp học, tài khoản, staff và thanh toán.|
|Vite|8.3.0|Máy chủ phát triển và công cụ build FE.|
|Plugin React cho Vite|6.1.1|Biên dịch/tích hợp React trong quá trình phát triển và build.|

Đã đối chiếu `package.json`, `package-lock.json` và chạy `npm.cmd ls --depth=0`. Đây là các phiên bản thực tế được cài trong workspace, không chỉ là tên công nghệ ghi trong README.

## Bằng chứng trực tiếp trong mã nguồn

- [package.json](../package.json#L15) khai báo React/ReactDOM/React Router; scripts chạy Vite, không chạy WordPress.
- [src/main.jsx](../src/main.jsx#L13) gọi `ReactDOM.createRoot(...).render(...)`, bọc ứng dụng bằng `BrowserRouter` và `AuthProvider`.
- [vite.config.js](../vite.config.js#L9) sử dụng plugin React và proxy API tới BE.
- [Header.jsx](../src/components/Header.jsx#L144) định nghĩa `PromoStrip`; dòng148 chứa “Lớp mới mở mỗi tuần”, dòng151 là React Router Link đến `/classes`.
- [StoreLayout.jsx](../src/layouts/StoreLayout.jsx#L18) render `<PromoStrip />` dưới header.
- Style banner do `.promo-strip` trong [store.css](../src/styles/store.css) quy định: nền nhạt, chữ giữa, liên kết có gạch chân. Kiểu trình bày này có thể viết bằng nhiều công nghệ và không đủ xác định CMS.

Đoạn React đang tạo đúng phần trong ảnh:

```jsx
export function PromoStrip() {
  const { user } = useAuth();
  return (
    <div className="promo-strip">
      <p>{user ? 'Lớp mới mở mỗi tuần' : 'Buổi tập đầu tiên miễn phí'}</p>
      <p className="promo-strip__links">
        {!user && <Link to="/register">Đăng ký ngay</Link>}
        <Link to="/classes">Tìm lớp học</Link>
      </p>
    </div>
  );
}
```

Tìm trong nguồn FE và cấu hình, loại node_modules/dist/artifacts/.git, không thấy WordPress, wp-content, wp-includes, wp-json, wp-admin, Elementor, WooCommerce, PHP hoặc cấu hình WordPress. Không dùng riêng việc “không có PHP” để kết luận, vì ứng dụng React nói chung vẫn có thể kết nối một CMS khác; ở dự án này không tìm thấy tích hợp đó trong phạm vi kiểm tra.

## Đối chiếu bản local mới chạy

Mở tạm Vite ở localhost5182 từ đúng thư mục FE rồi đọc HTML, `/src/main.jsx`, `/src/components/Header.jsx`. Các request đều200; HTML nạp `/@vite/client`, entrypoint gọi createRoot và BrowserRouter; module Header được Vite biên dịch từ PromoStrip có nguyên văn câu trong ảnh. Đã giải mã UTF-8 đúng để đối chiếu tiếng Việt.

Bằng chứng máy đọc được: [verification.json](../artifacts/technology-verification-2026-11-03/2026-11-03T09-06-47-928Z/verification.json). Đây là bản local tái hiện tại thời điểm xác minh, không phải ghi hình hay lưu lượng mạng của chính buổi demo sáng. Không gọi API BE, đăng nhập, tạo dữ liệu hoặc thử thanh toán.

## Có cần đổi toàn bộ công nghệ không?

Điều kiện “nếu FE thực sự dùng WordPress thì chuyển công nghệ” không xảy ra với mã nguồn đã kiểm tra. Dự án đã dùng React/Vite; không có căn cứ thực hiện migration khỏi WordPress. Đổi tên framework không tự thay đổi phong cách trình bày hoặc chất lượng nghiệp vụ.

Tài liệu chính thức của [React hướng dẫn tạo ứng dụng bằng Vite và React Router](https://react.dev/learn/build-a-react-app-from-scratch); [Vite](https://vite.dev/guide/) là công cụ build cho ứng dụng web hiện đại. Vì vậy việc dùng React/Vite ở đây không phải bằng chứng đang sử dụng WordPress hay một nền tảng đã lỗi thời. [WordPress](https://wordpress.org/about/features/) có hệ thống theme/plugin riêng; một banner quảng bá không xác định được hệ thống đó.

Nhận xét “giao diện trông cũ/giống mẫu” là vấn đề đánh giá thiết kế, khác với kết luận về công nghệ. Không thể xác nhận toàn bộ ý định hoặc tiêu chí chấm của giảng viên chỉ từ lời thuật lại. Kết quả này cũng không chứng minh thiết kế có hoàn toàn nguyên bản hay đã đạt mọi tiêu chí môn học.

## Điểm UI nên cân nhắc khi cải tiến

Đây là nhận xét từ ảnh và component hiện tại, chưa áp dụng thay đổi:

- Banner dùng nội dung quảng bá cố định. “Lớp mới mở mỗi tuần” không được tính từ danh sách lớp; “Buổi tập đầu tiên miễn phí” cần phù hợp chính sách thật nếu tiếp tục sử dụng.
- Hero lớn, chữ khẩu hiệu và ảnh chiếm phần lớn màn hình đầu. Có thể đưa tìm lớp theo môn/ngày, học phí và lớp sắp khai giảng lên vị trí dễ thấy hơn để thể hiện nghiệp vụ quản lý trung tâm.
- Có thể chỉnh banner thành nội dung gắn với luồng thực tế, kiểm lại phân cấp chữ/khoảng cách và khả năng dùng trên mobile ngay trong React hiện có. Chưa có yêu cầu cụ thể để viết lại toàn bộ giao diện hoặc thay stack.

## Cách trình bày bằng chứng khi demo lại

1. Mở `package.json` và chạy `npm ls --depth=0` để cho thấy React/React Router/Vite.
2. Mở `src/main.jsx` để chỉ chỗ React khởi tạo giao diện.
3. Mở `Header.jsx` tại `PromoStrip`, đối chiếu nguyên văn banner trên web; có thể dùng React Developer Tools kiểm tra cây component khi trình bày.
4. Trình bày các luồng thật Member/Coach/Receptionist/Manager và request API từ Network, thay vì chỉ dừng ở trang giới thiệu.

Câu giải thích ngắn: “Frontend của nhóm dùng React19.3, React Router7 và Vite8. Dòng thầy chỉ là component PromoStrip do mã React trong dự án render. Nhóm xin trình bày mã nguồn và luồng API để làm rõ công nghệ, đồng thời tiếp thu góp ý về thiết kế giao diện.”

Lượt này chỉ xác minh và bổ sung tài liệu. Không sửa source FE/BE, không migration, không viết test hoặc chạy build vì không thay mã ứng dụng. Giữ nguyên thay đổi Home.jsx và file Word lock đang bị xóa của người dùng.
