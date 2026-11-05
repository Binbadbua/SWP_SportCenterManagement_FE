import { Suspense, useEffect } from 'react';
import { Loading } from '../components/ui.jsx';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import '../styles/storefront-refresh.css';
import '../styles/catalog-redesign.css';

export default function StoreLayout() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers make scrollTo() return a Promise, and an effect must not return one
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="store">
      <a href="#main" className="skip-link">Bỏ qua, tới nội dung chính</a>
      <Header />
      <main id="main">
        <Suspense fallback={<Loading label="Đang mở trang" />}><Outlet /></Suspense>
      </main>
      <Footer />
    </div>
  );
}
