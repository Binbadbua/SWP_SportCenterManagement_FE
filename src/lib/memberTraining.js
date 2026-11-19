
export const UNKNOWN_CLASS = '__unknown_class__';
export const UNKNOWN_PLAN = '__unknown_plan__';
const dayOf = value => {
  const day = String(value ?? '').slice(0, 10);
  const time = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(day + 'T00:00:00Z') : NaN;
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? day : '';
};
const idOf = (row, key) => row?.id ?? row?.[key];
const shortId = id => String(id).slice(0, 8);
const fold = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');
const scoreOf = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10 ? Number(value) : null;

export function buildMemberTraining(plans = [], results = [], classes = [], sessions = []) {
  const classMap = new Map(classes.map(row => [idOf(row, 'classId'), row]));
  const sessionMap = new Map(sessions.map(row => [idOf(row, 'sessionId'), row]));
  const labelOf = (classId, fallback) => fallback || classMap.get(classId)?.className || (classId ? `Lớp chưa có tên · ${shortId(classId)}` : 'Chưa xác định lớp');
  const planRows = plans.map((row, index) => {
    const id = idOf(row, 'trainingPlanId') ?? `plan-row-${index}`;
    const cls = classMap.get(row.classId);
    const result = {
      ...row, id, kind: 'plan', planKey: id, classKey: row.classId || UNKNOWN_CLASS,
      classLabel: labelOf(row.classId, row.className), title: row.title || 'Kế hoạch chưa có tiêu đề',
      coachLabel: row.coachName || cls?.coachName || '', day: dayOf(row.createdDate),
    };
    result.search = fold([result.title, result.classLabel, result.coachLabel, row.contentDescription].join(' '));
    return result;
  });
  const planMap = new Map(planRows.map(row => [row.id, row]));
  const resultRows = results.map((row, index) => {
    const plan = planMap.get(row.planId ?? row.trainingPlanId);
    const explicit = row.sessionId ? sessionMap.get(row.sessionId) : null;
    const classId = row.classId || plan?.classId || explicit?.classId;
    const sameClass = session => !!session && (!classId || session.classId === classId);
    let session = sameClass(explicit) ? explicit : null;
    let sessionIssue = row.sessionId && explicit && !sameClass(explicit) ? 'Buổi học chưa khớp với lớp của kế hoạch.' : '';

    if (!row.sessionId && classId && dayOf(row.evaluationDate)) {
      const candidates = sessions.filter(item => item.classId === classId && dayOf(item.date) === dayOf(row.evaluationDate));
      if (candidates.length === 1) session = candidates[0];
      else if (candidates.length > 1) sessionIssue = 'Có nhiều buổi cùng ngày; chưa xác định được buổi của kết quả này.';
    }
    const cls = classMap.get(classId);
    const result = {
      ...row, id: idOf(row, 'trainingResultId') ?? `result-row-${index}`, kind: 'result',
      planKey: row.planId || row.trainingPlanId || UNKNOWN_PLAN,
      classKey: classId || UNKNOWN_CLASS, classLabel: labelOf(classId, row.className || plan?.className),
      title: row.planTitle || plan?.title || (row.planId || row.trainingPlanId ? 'Kế hoạch không còn trong danh sách' : 'Kết quả chưa gắn kế hoạch'),
      coachLabel: row.coachName || plan?.coachLabel || cls?.coachName || '',
      day: dayOf(row.evaluationDate), score: scoreOf(row.performanceScore), session, sessionIssue,
      knownPlan: !!plan,
    };
    result.search = fold([result.title, result.classLabel, result.coachLabel, row.coachComment].join(' '));
    return result;
  });
  const latestFirst = (a, b) => b.day.localeCompare(a.day) || String(a.id).localeCompare(String(b.id));
  planRows.sort(latestFirst);
  resultRows.sort(latestFirst);
  const classOptions = [...new Map([...planRows, ...resultRows].map(row => [row.classKey, { value: row.classKey, label: row.classLabel }])).values()]
    .sort((a, b) => a.value === UNKNOWN_CLASS ? 1 : b.value === UNKNOWN_CLASS ? -1 : a.label.localeCompare(b.label, 'vi'));
  return { plans: planRows, results: resultRows, classOptions };
}

export function trainingPlanOptions(view, classId = '') {
  return [...new Map([...view.plans, ...view.results]
    .filter(row => !classId || row.classKey === classId)
    .map(row => [row.planKey, { value: row.planKey, label: row.title }])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

export function filterMemberTraining(rows, { classId = '', planId = '', from = '', to = '', query = '' } = {}) {
  if (from && to && from > to) return [];
  const needle = fold(query.trim());
  return rows.filter(row =>
    (!classId || row.classKey === classId) &&
    (!planId || row.planKey === planId) &&
    (!from || (!!row.day && row.day >= from)) &&
    (!to || (!!row.day && row.day <= to)) &&
    (!needle || row.search.includes(needle)),
  );
}

export function trainingPage(rows, page = 1, size = 6) {
  const count = rows.length;
  const pageCount = Math.max(1, Math.ceil(count / size));
  const current = Math.max(1, Math.min(pageCount, Number(page) || 1));
  const offset = (current - 1) * size;
  return { rows: rows.slice(offset, offset + size), page: current, pageCount, count, from: count ? offset + 1 : 0, to: Math.min(count, offset + size) };
}
