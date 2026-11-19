import { AccountRole } from './enums.js';

const aliases = { manager: 4, 'center manager': 4, 'quản lý': 4, hlv: 2, reception: 3, 'thành viên': 1 };

export function roleOption(role) {
  if (typeof role !== 'string' && typeof role !== 'number') return undefined;
  const value = String(role).trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
  return AccountRole.options.find(item => [item.name, item.key, item.label, String(item.value)].some(text => text.toLocaleLowerCase('vi-VN') === value))
    ?? (Object.hasOwn(aliases, value) ? AccountRole.options.find(item => item.value === aliases[value]) : undefined);
}

export const roleText = role => roleOption(role)?.label ?? (typeof role === 'string' || typeof role === 'number' ? String(role) : '');
export const roleClassName = role => {
  const option = roleOption(role);
  return option && option.key !== 'member' ? 'role-label role-label--' + option.key : '';
};
