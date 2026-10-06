import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header, { PromoStrip } from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';

export default function StoreLayout() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers make scrollTo() return a Promise, and an effect must not return one
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="store">
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <PromoStrip />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
