// New notifications use the API sender fields. Older messages can retain the first-line sender signature.
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
