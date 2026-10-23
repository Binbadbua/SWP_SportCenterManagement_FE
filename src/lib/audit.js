// Audit log. Since the 23/10/2026 deploy the API writes an entry itself for every change a staff
// member saves (ServerAuditInterceptor): actionType "Added:Room" / "Modified:Member" / "Deleted:…",
// description {"entityId","changedFields","source":"server"}. The FE no longer posts its own copies,
// which would show every change twice. Entries the FE wrote before that ("CREATE_ROOM" + a text
// summary, sometimes prefixed "[client]") are still read.

const VERBS = {
  CREATE: { label: 'Create', tone: 'success' },
  UPDATE: { label: 'Update', tone: 'info' },
  DELETE: { label: 'Delete', tone: 'danger' },
  RENEW: { label: 'Renew', tone: 'info' },
  CANCEL: { label: 'Cancel', tone: 'warning' },
  LOCK: { label: 'Lock', tone: 'warning' },
  UNLOCK: { label: 'Unlock', tone: 'success' },
  SEND: { label: 'Send', tone: 'neutral' },
};

export const AUDIT_VERBS = Object.entries(VERBS).map(([value, v]) => ({ value, label: v.label }));

const SERVER_VERBS = { Added: 'CREATE', Modified: 'UPDATE', Deleted: 'DELETE' };
// Entity class names that read better under another word
const ENTITIES = {
  ClassBooking: 'booking', ClassSession: 'session', CenterManager: 'manager',
  MembershipPackage: 'package', SportCategory: 'sport',
};
// Bookkeeping columns every save touches
const QUIET_FIELDS = ['UpdatedAt', 'CreatedAt', 'IsDeleted'];

const words = (pascal) => pascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
const json = (text) => {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};

// One entry, whichever way it was written ->
// { verb, entity, type, label, tone, entityId, fields, summary, lines, source }
export function readEntry(row) {
  const [state, type] = String(row.actionType ?? '').split(':');
  if (SERVER_VERBS[state] && type) {
    const d = json(row.description) ?? {};
    const changed = d.changedFields ?? [];
    // A soft delete is saved as a change of IsDeleted
    const verb = state === 'Modified' && changed.includes('IsDeleted') ? 'DELETE' : SERVER_VERBS[state];
    const entity = ENTITIES[type] ?? words(type);
    return {
      verb, entity, type, label: `${VERBS[verb].label} ${entity}`, tone: VERBS[verb].tone,
      entityId: d.entityId, fields: changed.filter((f) => !QUIET_FIELDS.includes(f)).map(words),
      summary: '', lines: [], source: 'server',
    };
  }
  const [verb, ...rest] = String(row.actionType ?? '').split('_');
  const [summary, ...lines] = String(row.description ?? '').replace(/^\[client\]\s*/, '').split('\n');
  const known = VERBS[verb];
  const entity = known && rest.length ? rest.join(' ').toLowerCase() : '';
  return {
    verb: entity ? verb : 'OTHER', entity, type: '', label: entity ? `${known.label} ${entity}` : row.actionType || '—',
    tone: entity ? known.tone : 'neutral', entityId: null, fields: [], summary, lines, source: 'client',
  };
}

// One save can write many entries of the same kind (a notification to 20 members = 20 rows);
// they are shown as one line with every record they touched.
export function groupEntries(rows) {
  const groups = new Map();
  for (const row of rows) {
    const entry = readEntry(row);
    const key = entry.source === 'server'
      ? `${row.accountId}|${row.actionType}|${String(row.timestamp).slice(0, 19)}`
      : row.id;
    const group = groups.get(key);
    if (group) {
      group.entityIds.push(entry.entityId);
      for (const f of entry.fields) if (!group.entry.fields.includes(f)) group.entry.fields.push(f);
    } else {
      groups.set(key, { ...row, entry, entityIds: entry.entityId ? [entry.entityId] : [] });
    }
  }
  return [...groups.values()];
}
