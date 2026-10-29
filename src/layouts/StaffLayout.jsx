import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { isStaff, useAuth } from "../context/AuthContext.jsx";
import { AccountRole } from "../lib/enums.js";
import Icon from "../components/Icon.jsx";
import Logo from "../components/Logo.jsx";
import { Button, EmptyState } from "../components/ui.jsx";

// Sidebar navigation by role. `preview: true` = UI only, no back-end API yet.
export const STAFF_NAV = [
  {
    group: "Hôm nay",
    items: [
      {
        to: "/staff",
        label: "Tổng quan",
        roles: ["CenterManager", "Receptionist", "Coach"],
        end: true,
      },
      {
        to: "/staff/notifications",
        label: "Thông báo",
        roles: ["CenterManager", "Receptionist", "Coach"],
      },
    ],
  },
  {
    group: "Quầy lễ tân",
    items: [
      {
        to: "/staff/check-ins",
        label: "Vào cửa",
        roles: ["Receptionist", "CenterManager"],
      },
      {
        to: "/staff/bookings",
        label: "Đặt lớp",
        roles: ["Receptionist"],
      },
      {
        to: "/staff/attendance",
        label: "Điểm danh",
        roles: ["Coach"],
      },
      {
        to: "/staff/members",
        label: "Học viên",
        roles: ["CenterManager", "Receptionist"],
      },
      {
        to: "/staff/memberships",
        label: "Thẻ thành viên",
        roles: ["CenterManager", "Receptionist"],
      },
      {
        to: "/staff/invoices",
        label: "Hóa đơn",
        roles: ["CenterManager", "Receptionist"],
      },
      {
        to: "/staff/support-requests",
        label: "Yêu cầu hỗ trợ",
        roles: ["CenterManager", "Receptionist"],
      },
    ],
  },
  {
    group: "Huấn luyện",
    items: [
      { to: "/staff/my-classes", label: "Lớp của tôi", roles: ["Coach"] },
      { to: "/staff/my-members", label: "Học viên của tôi", roles: ["Coach"] },
      {
        to: "/staff/training-plans",
        label: "Kế hoạch tập luyện",
        roles: ["Coach"],
      },
      {
        to: "/staff/training-results",
        label: "Kết quả tập luyện",
        roles: ["Coach"],
      },
    ],
  },
  {
    group: "Chương trình",
    items: [
      {
        to: "/staff/classes",
        label: "Lớp học",
        roles: ["CenterManager", "Receptionist"],
      },
      {
        to: "/staff/schedule",
        label: "Lịch học",
        roles: ["CenterManager", "Receptionist", "Coach"],
      },
      { to: "/staff/rooms", label: "Phòng tập", roles: ["CenterManager"] },
      { to: "/staff/sports", label: "Môn thể thao", roles: ["CenterManager"] },
      { to: "/staff/packages", label: "Gói tập", roles: ["CenterManager"] },
    ],
  },
  {
    group: "Nhân sự",
    items: [
      { to: "/staff/coaches", label: "Huấn luyện viên", roles: ["CenterManager"] },
      {
        to: "/staff/receptionists",
        label: "Lễ tân",
        roles: ["CenterManager"],
      },
      { to: "/staff/managers", label: "Quản lý", roles: ["CenterManager"] },
      { to: "/staff/accounts", label: "Tài khoản", roles: ["CenterManager"] },
      { to: "/staff/audit-log", label: "Nhật ký hoạt động", roles: ["CenterManager"] },
    ],
  },
];

// The token carries the C# enum name ("CenterManager"); show its label ("Quản lý trung tâm")
const roleLabel = (role) => AccountRole.options.find((o) => o.name === role)?.label ?? role;

export default function StaffLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (!isStaff(user)) {
    return (
      <div className="staff-gate">
        <Logo />
        <EmptyState
          title="Cần đăng nhập tài khoản nhân viên"
          action={<Button to="/login?next=/staff">Đăng nhập nhân viên</Button>}
        >
          Đăng nhập bằng tài khoản quản lý, lễ tân hoặc huấn luyện viên để vào khu vực nhân viên.
        </EmptyState>
        <Link className="text-link" to="/">
          Về trang web
        </Link>
      </div>
    );
  }

  const groups = STAFF_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(user.role)),
  })).filter((g) => g.items.length);

  return (
    <div className="staff">
      <header className="staff-top">
        <button
          type="button"
          className="icon-btn staff-top__menu"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <Icon name="menu" />
        </button>
        <Logo to="/staff" inverse />
        <span className="staff-top__tag label">Nhân viên</span>
        <div className="staff-top__right">
          <Link to="/" className="staff-top__link">
            Xem trang web
          </Link>
          <span className="staff-top__user">
            <span className="staff-top__name">
              {user?.username || "NHÂN VIÊN"}
            </span>
            <span className="staff-top__role">
              {roleLabel(user?.role || user?.Role)}
            </span>
          </span>
          <button
            type="button"
            className="icon-btn staff-top__icon"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={() => {
              signOut();
              navigate("/");
            }}
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <div className="staff__body">
        <nav
          className={`staff-nav ${navOpen ? "is-open" : ""}`}
          aria-label="Menu nhân viên"
        >
          {groups.map((g) => (
            <div key={g.group} className="staff-nav__group">
              <p className="staff-nav__heading label">{g.group}</p>
              {g.items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.end}
                  className="staff-nav__link"
                >
                  <span>{i.label}</span>
                  {i.preview && (
                    <span
                      className="staff-nav__preview"
                      title="Bản xem trước — chưa có API"
                    >
                      Xem trước
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main className="staff__main" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
