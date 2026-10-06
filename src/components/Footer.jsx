import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="site-footer" id="find-us">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo inverse />
          <p>Classes, courts and coaches under one roof.</p>
        </div>
        <div>
          <h2 className="site-footer__title">Train</h2>
          <ul>
            <li><Link to="/classes">All classes</Link></li>
            <li><Link to="/schedule">Weekly schedule</Link></li>
            <li><Link to="/coaches">Coaches</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer__title">Membership</h2>
          <ul>
            <li><Link to="/memberships">Plans &amp; prices</Link></li>
            <li><Link to="/register">Join us</Link></li>
            <li><Link to="/account">My account</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer__title">Find us</h2>
          <address>
            SportCenter<br />
            Open daily 05:30–22:30<br />
            Reception: 0900 000 000
          </address>
        </div>
      </div>
      <div className="container site-footer__base">
        <span>© {new Date().getFullYear()} SportCenter · SWP project</span>
        <span>
          <Link to="/help">Help</Link>
          <Link to="/staff">Staff sign-in</Link>
        </span>
      </div>
    </footer>
  );
}
