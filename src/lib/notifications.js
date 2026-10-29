// Who sent a notification. The API keeps no sender yet (CHANGELOG Part B, B57 asks for senderName / senderRole), so
// what staff send from the website starts with a line "Người gửi: <name> · <role>" that the inbox shows apart.
// Notifications the API writes itself (card expiry, payments) carry neither and come from the center.
import { AccountRole } from './enums.js';

const SIGNATURE = 'Người gửi: ';
const roleLabel = (role) =>
  typeof role === 'number' ? AccountRole.label(role) : AccountRole.options.find((o) => o.name === role)?.label ?? role;

// The message as `user` (the signed-in staff member) sends it
export const signed = (message, user) =>
  `${SIGNATURE}${user?.fullName || user?.username || 'SportCenter'} · ${roleLabel(user?.role) ?? 'Nhân viên'}\n${message}`;

// → { sender, message }: the API's sender once it has one, else the website's first line, else the center
export function readNotification(n) {
  const text = String(n?.message ?? '');
  if (n?.senderName) {
    return { sender: [n.senderName, roleLabel(n.senderRole)].filter(Boolean).join(' · '), message: text };
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
