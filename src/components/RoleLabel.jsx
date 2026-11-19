import { roleClassName, roleText } from '../lib/roles.js';
import '../styles/role-label.css';

export default function RoleLabel({ role, children }) {
  const text = children ?? roleText(role);
  const className = roleClassName(role);
  return className ? <span className={className}>{text}</span> : <>{text}</>;
}
