import { Link } from 'react-router-dom';
import { POLICIES, POLICY_UPDATED } from '../../components/Policies.jsx';

// /terms and /privacy: the policies linked from the agree boxes on Register and Checkout
export default function Policy({ kind }) {
  const policy = POLICIES[kind];
  const other = POLICIES[kind === 'terms' ? 'privacy' : 'terms'];
  return (
    <div className="container page narrow policy-page">
      <header className="page-head">
        <h1 className="page-title display">{policy.title}</h1>
        <p className="page-lead">{policy.lead}</p>
        <p className="muted small">Cập nhật lần cuối: {POLICY_UPDATED}</p>
      </header>
      <ol className="policy-list">
        {policy.items.map(([name, text]) => (
          <li key={name}>
            <h2 className="policy-list__title">{name}</h2>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <p className="policy-page__more">
        Xem thêm <Link className="text-link" to={other.path}>{other.title}</Link>. Còn thắc mắc? Gửi câu hỏi ở{' '}
        <Link className="text-link" to="/account?tab=support">Tài khoản của tôi → Hỗ trợ</Link> hoặc gọi lễ tân 0900 000 000.
      </p>
    </div>
  );
}
