
import { roleOption, roleText } from './roles.js';

const SIGNATURE = 'Người gửi: ';
const roleLabel = role => roleText(role) || undefined;

export const signed = (message, user) =>
  `${SIGNATURE}${user?.fullName || user?.username || 'SportCenter'} · ${roleLabel(user?.role) ?? 'Nhân viên'}\n${message}`;

export function readNotification(n) {
  const text = String(n?.message ?? '');
  if (n?.senderName) {
    return { sender: [n.senderName, roleLabel(n.senderRole)].filter(Boolean).join(' · '), message: text.startsWith(SIGNATURE) ? text.slice(text.indexOf('\n') < 0 ? text.length : text.indexOf('\n') + 1) : text };
  }
  if (text.startsWith(SIGNATURE)) {
    const cut = text.indexOf('\n');
    return {
      sender: (cut < 0 ? text : text.slice(0, cut)).slice(SIGNATURE.length).trim(),
      message: cut < 0 ? '' : text.slice(cut + 1),
    };
  }
  return { sender: 'Trung tâm SportCenter', message: text };
}

export function readNotificationSender(n) {
  const text = String(n?.message ?? '');
  let legacyName, legacyRole;
  if (text.startsWith(SIGNATURE)) {
    const cut = text.indexOf('\n');
    const signature = (cut < 0 ? text : text.slice(0, cut)).slice(SIGNATURE.length).trim();
    const separator = signature.lastIndexOf(' · ');
    const candidate = separator < 0 ? undefined : signature.slice(separator + 3).trim();
    if (roleOption(candidate)) {
      legacyName = signature.slice(0, separator).trim();
      legacyRole = candidate;
    } else legacyName = signature;
  }
  const name = typeof n?.senderName === 'string' ? n.senderName.trim() : '';
  if (name) {
    const role = typeof n.senderRole === 'number' || (typeof n.senderRole === 'string' && n.senderRole.trim())
      ? n.senderRole : name === legacyName ? legacyRole : undefined;
    return { name, role };
  }
  return { name: legacyName || 'Trung tâm SportCenter', role: legacyName ? legacyRole : undefined };
}
