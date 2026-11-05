import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { useMemberDiscount } from '../../hooks/useMemberDiscount.js';
import MemberDiscountNotice from '../../components/MemberDiscountNotice.jsx';
import { daysUntil } from '../../lib/format.js';
import { classStarted } from '../../lib/classes.js';
import Icon from '../../components/Icon.jsx';
import { ClassCard } from '../../components/cards.jsx';
import SportPhotoSlideshow from '../../components/SportPhotoSlideshow.jsx';
import { Button, EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';
import '../../styles/catalog-redesign.css';

const SORTS = {
  soonest: { label: 'Khai giảng sớm nhất', fn: (a, b) => (daysUntil(a.startDate) ?? 0) - (daysUntil(b.startDate) ?? 0) },
  name: { label: 'Tên: A–Z', fn: (a, b) => a.className.localeCompare(b.className) },
  capacity: { label: 'Sĩ số tối đa: cao đến thấp', fn: (a, b) => b.maxCapacity - a.maxCapacity },
};

const STATUS_FILTERS = [
  { value: '1', label: 'Sắp khai giảng' },
  { value: '2', label: 'Đang diễn ra' },
  { value: '3', label: 'Đã kết thúc' },
];

// Multi-value URL params stay shareable: ?sport=a,b&coach=c&status=1,2.
const readList = (params, key) => (params.get(key) ? params.get(key).split(',') : []);

export default function Classes() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(() => window.innerWidth > 960);
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const categories = useApi(() => api.categories.list(), [], { sample: mock.categories });
  const sessions = useApi(() => api.schedules.list(), [], { sample: mock.sessions });
  const pricing = useMemberDiscount({ enabled: !classes.usingSample });
  const sports = readList(params, 'sport');
  const statuses = readList(params, 'status').length ? readList(params, 'status') : ['1', '2'];
  const coachIds = readList(params, 'coach');
  const q = params.get('q') ?? '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'soonest';
  const hasFilters = ['sport', 'status', 'coach', 'q', 'sort'].some(key => params.has(key));

  const toggle = (key, value, current) => {
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
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
    const map = new Map(list.filter(c => c.coachId && c.coachName).map(c => [c.coachId, c.coachName]));
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [list]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list
      .filter(c => !sports.length || sports.includes(c.categoryId))
      .filter(c => statuses.includes(String(c.status)))
      .filter(c => !coachIds.length || coachIds.includes(c.coachId))
      .filter(c => !needle || `${c.className} ${c.categoryName} ${c.coachName}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [list, sports, statuses, coachIds, q, sort]);
  const activeSport = sports.length === 1 ? (categories.data ?? []).find(c => c.id === sports[0]) : null;
  const title = q ? `Kết quả cho “${q}”` : activeSport ? `Các lớp ${activeSport.categoryName}` : 'Tìm nhịp tập của bạn';
  const scheduleKnown = !sessions.loading && !!sessions.data && (!sessions.usingSample || classes.usingSample);
  const usingSample = classes.usingSample || categories.usingSample || sessions.usingSample;

  return (
    <div className="plp container catalog-page catalog-classes">
      <header className="catalog-intro">
        <div className="catalog-intro__copy">
          <p className="catalog-eyebrow"><span />Khám phá lớp học</p>
          <h1 className="plp__title">{title}</h1>
          <p>Từ buổi tập đầu tiên đến một thói quen mới. Chọn bộ môn, xem lịch và tìm lớp phù hợp với bạn.</p>
          <div className="catalog-intro__facts"><span><Icon name="calendar" size={16} />Lịch học rõ ràng</span><span><Icon name="user" size={16} />Có huấn luyện viên</span><span><Icon name="check" size={16} />Học phí theo khóa</span></div>
        </div>
        <SportPhotoSlideshow categories={categories.data} />
      </header>

      <MemberDiscountNotice pricing={pricing} />
      <div className="plp__head catalog-toolbar">
        <label className="catalog-search"><Icon name="search" size={20} /><span className="visually-hidden">Tìm lớp theo tên, môn hoặc huấn luyện viên</span><input type="search" value={q} onChange={e => setParam('q', e.target.value)} placeholder="Tìm lớp, bộ môn, huấn luyện viên…" /></label>
        <div className="plp__tools">
          <button type="button" className="catalog-filter-toggle" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters} aria-controls="class-filters"><Icon name="filter" size={18} />{showFilters ? 'Ẩn bộ lọc' : 'Bộ lọc'}</button>
          <label className="sort-select"><span className="visually-hidden">Sắp xếp lớp</span><select value={sort} onChange={e => setParam('sort', e.target.value)}>{Object.entries(SORTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
        </div>
      </div>

      {usingSample && <div className="section-notice"><SampleDataNotice onRetry={() => { classes.reload(); categories.reload(); sessions.reload(); }} /></div>}
      <ErrorNotice error={!classes.usingSample ? classes.error : null} onRetry={classes.reload} />
      {sessions.error && !sessions.usingSample && <div className="catalog-data-note"><Icon name="calendar" size={19} /><div><p>Chưa tải được lịch để xác nhận thời điểm nhận đăng ký.</p><button type="button" onClick={sessions.reload}>Tải lại lịch học</button></div></div>}

      <div className={`plp__body ${showFilters ? '' : 'plp__body--full'}`}>
        {showFilters && <aside id="class-filters" className="filters" aria-label="Bộ lọc lớp học">
          <div className="catalog-filter-head"><h2><Icon name="filter" size={17} />Tinh chỉnh lựa chọn</h2>{hasFilters && <button type="button" onClick={() => setParams({}, { replace: true })}>Đặt lại</button>}</div>
          <fieldset className="filters__group"><legend>Môn thể thao</legend>
            <ErrorNotice error={!categories.usingSample ? categories.error : null} onRetry={categories.reload} />
            {categories.loading ? <Loading label="Đang tải bộ môn" /> : (categories.data ?? []).map(category => <label key={category.id} className="check"><input type="checkbox" checked={sports.includes(category.id)} onChange={() => toggle('sport', category.id, sports)} /><span>{category.categoryName}</span></label>)}
            {!categories.loading && !categories.error && !(categories.data ?? []).length && <p className="catalog-filter-empty">Bộ môn sẽ được cập nhật.</p>}
          </fieldset>
          <fieldset className="filters__group"><legend>Tình trạng lớp</legend>{STATUS_FILTERS.map(status => <label key={status.value} className="check"><input type="checkbox" checked={statuses.includes(status.value)} onChange={() => toggle('status', status.value, statuses)} /><span>{status.label}</span></label>)}</fieldset>
          <fieldset className="filters__group"><legend>Huấn luyện viên</legend>{coaches.map(coach => <label key={coach.id} className="check"><input type="checkbox" checked={coachIds.includes(coach.id)} onChange={() => toggle('coach', coach.id, coachIds)} /><span>{coach.name}</span></label>)}{!classes.loading && !coaches.length && <p className="catalog-filter-empty">Thông tin sẽ có cùng danh sách lớp.</p>}</fieldset>
          <p className="catalog-filter-tip"><Icon name="clock" size={17} />Lớp chỉ nhận đăng ký trước buổi học đầu tiên.</p>
        </aside>}

        <section className="catalog-results" aria-label="Danh sách lớp học" aria-live="polite" aria-busy={classes.loading}>
          <div className="catalog-result-head"><p>{classes.loading ? 'Đang tìm lớp dành cho bạn…' : classes.error && !classes.usingSample ? 'Danh sách lớp chưa sẵn sàng' : <><strong>{visible.length}</strong> lớp phù hợp</>}</p>{hasFilters && <button type="button" onClick={() => setParams({}, { replace: true })}>Xóa bộ lọc<Icon name="close" size={14} /></button>}</div>
          {classes.loading ? <Loading label="Đang tải lớp học" /> : visible.length ? <div className={`product-grid ${showFilters ? 'product-grid--3' : 'product-grid--4'}`}>{visible.map(item => <ClassCard key={item.id} item={item} started={scheduleKnown ? classStarted(item, sessions.data) : undefined} scheduleKnown={scheduleKnown} pricing={pricing} />)}</div> : !classes.error || classes.usingSample ? <EmptyState title="Chưa tìm thấy lớp phù hợp" action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Xóa bộ lọc</Button>}>Thử một từ khóa khác hoặc chọn thêm bộ môn, huấn luyện viên và tình trạng lớp.</EmptyState> : null}
        </section>
      </div>
    </div>
  );
}
