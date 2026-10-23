// Audit log. The API stores entries (GET/POST /api/audit-logs) but writes none itself, and only a
// center manager may add one (CHANGELOG_AND_BE_ISSUES.md, Part B, B33). So the staff pages log the
// changes a manager makes; add a role to WRITERS once the API accepts entries from it.
import { api } from '../api/endpoints.js';

const WRITERS = ['CenterManager'];

// actionType = VERB_ENTITY (CREATE_CLASS, LOCK_ACCOUNT, SEND_NOTIFICATION…), at most 100 characters.
// description = a one-line summary, then one line per changed field.
export function audit(user, actionType, description) {
  if (!user?.accountId || !WRITERS.includes(user.role)) return;
  api.auditLogs
    .log({ accountId: user.accountId, actionType: actionType.slice(0, 100), description })
    .catch(() => {
      // A lost log line must never undo or block the change the user just made
    });
}

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

// "UPDATE_TRAINING_PLAN" -> { verb: 'UPDATE', entity: 'training plan', label: 'Update training plan', tone: 'info' };
// entries written another way (e.g. by hand through Swagger) are shown as they are.
export function describeAction(actionType = '') {
  const [verb, ...rest] = String(actionType).split('_');
  const known = VERBS[verb];
  if (!known || !rest.length) return { verb: 'OTHER', entity: '', label: actionType || '—', tone: 'neutral' };
  const entity = rest.join(' ').toLowerCase();
  return { verb, entity, label: `${known.label} ${entity}`, tone: known.tone };
}
