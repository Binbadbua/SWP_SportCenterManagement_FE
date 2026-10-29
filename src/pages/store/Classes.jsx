import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { daysUntil } from '../../lib/format.js';
import { classStarted } from '../../lib/classes.js';
import Icon from '../../components/Icon.jsx';
import { ClassCard } from '../../components/cards.jsx';
import { Button, EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';

const SORTS = {
  soonest: { label: 'Khai giảng sớm nhất', fn: (a, b) => (daysUntil(a.startDate) ?? 0) - (daysUntil(b.startDate) ?? 0) },
  name: { label: 'Tên: A–Z', fn: (a, b) => a.className.localeCompare(b.className) },
  capacity: { label: 'Lớp đông nhất', fn: (a, b) => b.maxCapacity - a.maxCapacity },
};

const STATUS_FILTERS = [
  { value: '1', label: 'Sắp khai giảng' },
  { value: '2', label: 'Đang diễn ra' },
  { value: '3', label: 'Đã kết thúc' },
];

// Multi-value URL params: ?sport=a,b
const readList = (params, key) => (params.get(key) ? params.get(key).split(',') : []);

export default function Classes() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(() => window.innerWidth > 960);
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const categories = useApi(() => api.categories.list(), [], { sample: mock.categories });
  // A class whose first session has begun takes no more bookings (lib/classes.js)
  const sessions = useApi(() => api.schedules.list(), [], { sample: mock.sessions });

  const sports = readList(params, 'sport');
  const statuses = readList(params, 'status').length ? readList(params, 'status') : ['1', '2'];
  const coachIds = readList(params, 'coach');
  const q = params.get('q') ?? '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'soonest';

  const toggle = (key, value, current) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const p = new URLSearchParams(params);
    if (next.length) p.set(key, next.join(','));
    else p.delete(key);
    setParams(p, { replace: true });
  };
  const setParam = (key, value) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p, { replace: true });
  };

  const list = classes.data ?? [];
  const coaches = useMemo(() => {
    const map = new Map(list.map((c) => [c.coachId, c.coachName]));
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [list]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list
      .filter((c) => !sports.length || sports.includes(c.categoryId))
      .filter((c) => statuses.includes(String(c.status)))
      .filter((c) => !coachIds.length || coachIds.includes(c.coachId))
      .filter((c) => !needle || `${c.className} ${c.categoryName} ${c.coachName}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [list, sports, statuses, coachIds, q, sort]);

  const activeSport = sports.length === 1 ? (categories.data ?? []).find((c) => c.id === sports[0]) : null;
  const title = q ? `Kết quả cho “${q}”` : activeSport ? `Các lớp ${activeSport.categoryName}` : 'Tất cả lớp học';

  return (
    <div className="plp container">
      <div className="plp__head">
        <h1 className="plp__title">
          {title} <span className="muted num">({visible.length})</span>
        </h1>
        <div className="plp__tools">
          <button type="button" className="plain-btn" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'} <Icon name="filter" size={20} />
          </button>
          <label className="sort-select">
            <span>Sắp xếp</span>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {(classes.usingSample || categories.usingSample) && (
        <div className="section-notice"><SampleDataNotice onRetry={() => { classes.reload(); categories.reload(); }} /></div>
      )}
      <ErrorNotice error={!classes.usingSample ? classes.error : null} onRetry={classes.reload} />

      <div className={`plp__body ${showFilters ? '' : 'plp__body--full'}`}>
        {showFilters && (
          <aside className="filters" aria-label="Bộ lọc">
            {q && (
              <div className="filters__group">
                <button type="button" className="chip" onClick={() => setParam('q', '')}>
                  “{q}” <Icon name="close" size={14} />
                </button>
              </div>
            )}
            <fieldset className="filters__group">
              <legend>Môn thể thao</legend>
              {(categories.data ?? []).map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={sports.includes(c.id)} onChange={() => toggle('sport', c.id, sports)} />
                  <span>{c.categoryName}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="filters__group">
              <legend>Tình trạng</legend>
              {STATUS_FILTERS.map((s) => (
                <label key={s.value} className="check">
                  <input type="checkbox" checked={statuses.includes(s.value)} onChange={() => toggle('status', s.value, statuses)} />
                  <span>{s.label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="filters__group">
              <legend>Huấn luyện viên</legend>
              {coaches.map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={coachIds.includes(c.id)} onChange={() => toggle('coach', c.id, coachIds)} />
                  <span>{c.name}</span>
                </label>
              ))}
            </fieldset>
          </aside>
        )}

        <section aria-live="polite">
          {classes.loading ? (
            <Loading />
          ) : visible.length ? (
            <div className={`product-grid ${showFilters ? 'product-grid--3' : 'product-grid--4'}`}>
              {visible.map((c) => (
                <ClassCard key={c.id} item={c} started={sessions.data ? classStarted(c, sessions.data) : undefined} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Không có lớp nào khớp bộ lọc"
              action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Xóa bộ lọc</Button>}
            >
              Thử môn khác hoặc chọn thêm các lớp đã kết thúc.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
