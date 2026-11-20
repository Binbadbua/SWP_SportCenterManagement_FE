import { formatDate, formatTimeRange, formatWeekday } from './format.js';

export const UNASSIGNED_SESSION = '__unassigned_session__';
const UNKNOWN_CLASS = '__unknown_class__';
const dayOf = value => String(value ?? '').slice(0, 10);
const sessionIdOf = row => row?.id ?? row?.sessionId;
const planOf = (row, lookups) => (lookups.plans ?? []).find(plan => plan.id === row.planId);
const classOf = (row, lookups) => row.classId || planOf(row, lookups)?.classId
  || (lookups.sessions ?? []).find(session => sessionIdOf(session) === row.sessionId)?.classId || '';

export function trainingSessionOf(sessions = [], plan, result) {
  const classId = plan?.classId || result.classId;
  if (result.sessionId) {
    const session = sessions.find(row => sessionIdOf(row) === result.sessionId);
    return session && (!classId || session.classId === classId) ? session : undefined;
  }
  const day = dayOf(result.evaluationDate);
  if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const matches = sessions.filter(row => row.classId === classId && dayOf(row.date) === day);
  return matches.length === 1 ? matches[0] : undefined;
}

function sessionsFor(row, kind, lookups) {
  const sessions = lookups.sessions ?? [];
  if (kind === 'results') {
    const session = trainingSessionOf(sessions, planOf(row, lookups), row);
    return session ? [sessionIdOf(session)] : [];
  }
  return [...new Set((lookups.results ?? [])
    .filter(result => result.planId === row.id)
    .map(result => trainingSessionOf(sessions, row, result))
    .filter(Boolean)
    .map(sessionIdOf))];
}

export function coachTrainingFilters(kind) {
  return [
    {
      key: 'classId', label: 'Lọc theo lớp', all: 'Tất cả lớp',
      resets: ['sessionId'],
      options: (rows, lookups) => {
        const options = new Map((lookups.classes ?? []).map(row => [
          row.classId || row.id,
          { value: row.classId || row.id, label: row.className || row.name || 'Lớp chưa có tên' },
        ]).filter(([id]) => id));
        for (const row of rows) {
          const id = classOf(row, lookups);
          if (!options.has(id || UNKNOWN_CLASS)) options.set(id || UNKNOWN_CLASS, {
            value: id || UNKNOWN_CLASS,
            label: row.className && row.className !== '—' ? row.className
              : id ? 'Lớp · ' + String(id).slice(0, 8) : 'Chưa xác định lớp',
          });
        }
        return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi'));
      },
      match: (row, value, lookups) => (classOf(row, lookups) || UNKNOWN_CLASS) === value,
    },
    {
      key: 'sessionId', label: 'Lọc theo buổi học', all: 'Tất cả buổi học',
      requiresLookups: true,
      disabled: filters => !filters.classId || filters.classId === UNKNOWN_CLASS,
      options: (_rows, lookups, filters) => {
        if (!filters.classId || filters.classId === UNKNOWN_CLASS) return [];
        const sessions = (lookups.sessions ?? [])
          .filter(row => row.classId === filters.classId)
          .sort((a, b) => (dayOf(b.date) + b.startTime).localeCompare(dayOf(a.date) + a.startTime));
        const options = new Map(sessions.map(row => [sessionIdOf(row), {
          value: sessionIdOf(row),
          label: formatWeekday(row.date) + ' ' + formatDate(row.date) + ' · ' + formatTimeRange(row.startTime, row.endTime),
        }]).filter(([id]) => id));
        return [...options.values(), { value: UNASSIGNED_SESSION, label: 'Chưa gắn buổi học' }];
      },
      match: (row, value, lookups) => {
        const ids = sessionsFor(row, kind, lookups);
        return value === UNASSIGNED_SESSION ? ids.length === 0 : ids.includes(value);
      },
    },
  ];
}
