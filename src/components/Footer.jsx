import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="site-footer" id="find-us">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo inverse />
          <p>Lớp học, sân tập và huấn luyện viên dưới một mái nhà.</p>
        </div>
        <div>
          <h2 className="site-footer__title">Tập luyện</h2>
          <ul>
            <li><Link to="/classes">Tất cả lớp học</Link></li>
            <li><Link to="/schedule">Lịch học trong tuần</Link></li>
            <li><Link to="/coaches">Huấn luyện viên</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer__title">Thành viên</h2>
          <ul>
            <li><Link to="/memberships">Gói tập &amp; bảng giá</Link></li>
            <li><Link to="/register">Đăng ký</Link></li>
            <li><Link to="/account">Tài khoản của tôi</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer__title">Liên hệ</h2>
          <address>
            SportCenter<br />
            Mở cửa hằng ngày 05:30–22:30<br />
            Lễ tân: 0900 000 000
          </address>
        </div>
      </div>
      <div className="container site-footer__base">
        <span>© {new Date().getFullYear()} SportCenter · Dự án SWP</span>
        <span>
          <Link to="/terms">Điều khoản</Link>
          <Link to="/privacy">Bảo mật</Link>
          <Link to="/help">Trợ giúp</Link>
          <Link to="/staff">Nhân viên đăng nhập</Link>
        </span>
      </div>
    </footer>
  );
}
