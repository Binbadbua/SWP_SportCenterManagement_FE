

export const HOMEWORK_PREFIX = 'Bài tập về nhà: ';

export const isHomework = (n) => String(n?.title ?? '').startsWith(HOMEWORK_PREFIX);
export const withoutHomeworkPrefix = (title) =>
  String(title ?? '').startsWith(HOMEWORK_PREFIX) ? String(title).slice(HOMEWORK_PREFIX.length) : String(title ?? '');
