import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { daysUntil } from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import { ClassCard } from '../../components/cards.jsx';
import { Button, EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';

const SORTS = {
  soonest: { label: 'Starting soonest', fn: (a, b) => (daysUntil(a.startDate) ?? 0) - (daysUntil(b.startDate) ?? 0) },
  name: { label: 'Name: A–Z', fn: (a, b) => a.className.localeCompare(b.className) },
  capacity: { label: 'Largest classes', fn: (a, b) => b.maxCapacity - a.maxCapacity },
};

const STATUS_FILTERS = [
  { value: '1', label: 'Open for booking' },
  { value: '2', label: 'In progress' },
  { value: '3', label: 'Finished' },
];

// Multi-value URL params: ?sport=a,b
const readList = (params, key) => (params.get(key) ? params.get(key).split(',') : []);

export default function Classes() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(() => window.innerWidth > 960);
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const categories = useApi(() => api.categories.list(), [], { sample: mock.categories });

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
  const title = q ? `Results for “${q}”` : activeSport ? `${activeSport.categoryName} classes` : 'All classes';

  return (
    <div className="plp container">
      <div className="plp__head">
        <h1 className="plp__title">
          {title} <span className="muted num">({visible.length})</span>
        </h1>
        <div className="plp__tools">
          <button type="button" className="plain-btn" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            {showFilters ? 'Hide filters' : 'Show filters'} <Icon name="filter" size={20} />
          </button>
          <label className="sort-select">
            <span>Sort by</span>
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
          <aside className="filters" aria-label="Filters">
            {q && (
              <div className="filters__group">
                <button type="button" className="chip" onClick={() => setParam('q', '')}>
                  “{q}” <Icon name="close" size={14} />
                </button>
              </div>
            )}
            <fieldset className="filters__group">
              <legend>Sport</legend>
              {(categories.data ?? []).map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={sports.includes(c.id)} onChange={() => toggle('sport', c.id, sports)} />
                  <span>{c.categoryName}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="filters__group">
              <legend>Availability</legend>
              {STATUS_FILTERS.map((s) => (
                <label key={s.value} className="check">
                  <input type="checkbox" checked={statuses.includes(s.value)} onChange={() => toggle('status', s.value, statuses)} />
                  <span>{s.label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="filters__group">
              <legend>Coach</legend>
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
              {visible.map((c) => <ClassCard key={c.id} item={c} />)}
            </div>
          ) : (
            <EmptyState
              title="No classes match these filters"
              action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>}
            >
              Try another sport or include finished classes.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
