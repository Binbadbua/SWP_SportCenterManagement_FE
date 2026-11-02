import { Link } from 'react-router-dom';

// Shared SportCenter mark, also used without a link inside the chat launcher.
export function LogoMark({ className = 'logo__mark' }) {
  return (
    <svg className={className} viewBox="0 0 30 22" aria-hidden="true">
      <path d="M0 22 L9 0 H30 L21 22 Z" />
    </svg>
  );
}

// Wordmark: a slanted "lane" block + condensed name.
export default function Logo({ to = '/', inverse = false, compact = false }) {
  return (
    <Link to={to} className={`logo ${inverse ? 'logo--inverse' : ''}`} aria-label="Trang chủ SportCenter">
      <LogoMark />
      {!compact && <span className="logo__word">SportCenter</span>}
    </Link>
  );
}
