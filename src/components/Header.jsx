import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { isStaff, useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/classes', label: 'Classes' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/memberships', label: 'Memberships' },
  { to: '/coaches', label: 'Coaches' },
];

export default function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  // Hide the main bar when scrolling down, bring it back when scrolling up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 160 && y > lastY.current);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(query.trim() ? `/classes?q=${encodeURIComponent(query.trim())}` : '/classes');
  };

  return (
    <>
      <div className="utility-bar">
        <div className="utility-bar__inner">
          <a href="#find-us">Find us</a>
          <span aria-hidden="true">|</span>
          <Link to="/help">Help</Link>
          <span aria-hidden="true">|</span>
          {user ? (
            <>
              {isStaff(user) && (
                <>
                  <Link to="/staff">Staff area</Link>
                  <span aria-hidden="true">|</span>
                </>
              )}
              <Link to={isStaff(user) ? '/staff' : '/account'}>Hi, {user.fullName.split(' ').slice(-1)[0]}</Link>
              <span aria-hidden="true">|</span>
              <button type="button" className="link-btn" onClick={() => { signOut(); navigate('/'); }}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/register">Join us</Link>
              <span aria-hidden="true">|</span>
              <Link to="/login">Sign in</Link>
            </>
          )}
        </div>
      </div>

      <header className={`site-header ${hidden ? 'site-header--hidden' : ''}`}>
        <div className="site-header__inner">
          <Logo />

          <nav className="main-nav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="main-nav__link">
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-header__tools">
            <form className="search-pill" role="search" onSubmit={submitSearch}>
              <button type="submit" className="search-pill__btn" aria-label="Search classes">
                <Icon name="search" />
              </button>
              <input
                type="search"
                placeholder="Search classes"
                aria-label="Search classes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
            <Link className="icon-btn" to="/account?tab=bookings" aria-label="My bookings" title="My bookings">
              <Icon name="calendar" />
            </Link>
            <Link className="icon-btn" to={user ? (isStaff(user) ? '/staff' : '/account') : '/login'} aria-label="Account" title="Account">
              <Icon name="user" />
            </Link>
            <button type="button" className="icon-btn menu-toggle" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mobile-menu__head">
            <Logo />
            <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <nav className="mobile-menu__nav">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
                <Icon name="chevronRight" />
              </NavLink>
            ))}
          </nav>
          <p className="mobile-menu__lead">Book classes, track your sessions and manage your membership in one place.</p>
          <div className="mobile-menu__actions">
            {user ? (
              <button type="button" className="btn btn--secondary" onClick={() => { signOut(); navigate('/'); }}>Sign out</button>
            ) : (
              <>
                <Link className="btn btn--primary" to="/register">Join us</Link>
                <Link className="btn btn--secondary" to="/login">Sign in</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function PromoStrip() {
  const { user } = useAuth();
  return (
    <div className="promo-strip">
      <p>{user ? 'New classes open every week' : 'Your first class is on us'}</p>
      <p className="promo-strip__links">
        {!user && <Link to="/register">Join now</Link>}
        <Link to="/classes">Find a class</Link>
      </p>
    </div>
  );
}
