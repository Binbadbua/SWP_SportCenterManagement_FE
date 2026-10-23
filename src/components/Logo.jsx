import { Link } from 'react-router-dom';

// Wordmark: a slanted "lane" block + condensed name.
export default function Logo({ to = '/', inverse = false, compact = false }) {
  return (
    <Link to={to} className={`logo ${inverse ? 'logo--inverse' : ''}`} aria-label="Trang chủ SportCenter">
      <svg className="logo__mark" viewBox="0 0 30 22" aria-hidden="true">
        <path d="M0 22 L9 0 H30 L21 22 Z" />
      </svg>
      {!compact && <span className="logo__word">SportCenter</span>}
    </Link>
  );
}
