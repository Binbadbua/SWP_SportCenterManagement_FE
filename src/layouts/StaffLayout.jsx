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
    group: "Today",
    items: [
      {
        to: "/staff",
        label: "Overview",
        roles: ["CenterManager", "Receptionist", "Coach"],
        end: true,
      },
    ],
  },
  {
    group: "Front desk",
    items: [
      {
        to: "/staff/bookings",
        label: "Bookings",
        roles: ["Receptionist"],
      },
      {
        to: "/staff/attendance",
        label: "Attendance",
        roles: ["Coach"],
      },
      {
        to: "/staff/members",
        label: "Members",
        roles: ["Receptionist"],
        preview: true,
      },
      {
        to: "/staff/memberships",
        label: "Memberships",
        roles: ["Receptionist"],
        preview: true,
      },
      {
        to: "/staff/invoices",
        label: "Invoices",
        roles: ["Receptionist"],
      },
    ],
  },
  {
    group: "Coaching",
    items: [
      { to: "/staff/my-classes", label: "My classes", roles: ["Coach"] },
      { to: "/staff/my-members", label: "My members", roles: ["Coach"] },
      {
        to: "/staff/training-plans",
        label: "Training plans",
        roles: ["Coach"],
        preview: true,
      },
      {
        to: "/staff/training-results",
        label: "Training results",
        roles: ["Coach"],
        preview: true,
      },
    ],
  },
  {
    group: "Programme",
    items: [
      {
        to: "/staff/classes",
        label: "Classes",
        roles: ["CenterManager", "Receptionist"],
      },
      {
        to: "/staff/schedule",
        label: "Schedule",
        roles: ["CenterManager", "Receptionist", "Coach"],
      },
      { to: "/staff/rooms", label: "Rooms", roles: ["CenterManager"] },
      { to: "/staff/sports", label: "Sports", roles: ["CenterManager"] },
      { to: "/staff/packages", label: "Packages", roles: ["CenterManager"] },
    ],
  },
  {
    group: "Team",
    items: [
      { to: "/staff/coaches", label: "Coaches", roles: ["CenterManager"] },
      {
        to: "/staff/receptionists",
        label: "Receptionists",
        roles: ["CenterManager"],
      },
      { to: "/staff/managers", label: "Managers", roles: ["CenterManager"] },
      { to: "/staff/accounts", label: "Accounts", roles: ["CenterManager"] },
      { to: "/staff/audit-log", label: "Audit log", roles: ["CenterManager"] },
    ],
  },
];

const roleLabel = (role) =>
  AccountRole.options.find((o) => o.key === role)?.label ?? role;

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
          title="Staff sign-in required"
          action={<Button to="/login?next=/staff">Sign in as staff</Button>}
        >
          Sign in as a manager, receptionist or coach to open the staff area.
        </EmptyState>
        <Link className="text-link" to="/">
          Back to the website
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
        <span className="staff-top__tag label">Staff</span>
        <div className="staff-top__right">
          <Link to="/" className="staff-top__link">
            View website
          </Link>
          <span className="staff-top__user">
            <span className="staff-top__name">
              {user?.FullName || user?.fullName || "STAFF"}
            </span>
            <span className="staff-top__role">
              {roleLabel(user?.role || user?.Role)}
            </span>
          </span>
          <button
            type="button"
            className="icon-btn staff-top__icon"
            aria-label="Sign out"
            title="Sign out"
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
          aria-label="Staff"
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
                      title="UI preview — no API yet"
                    >
                      Preview
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
