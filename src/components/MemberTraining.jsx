import { useMemo, useState } from 'react';
import { api } from '../api/endpoints.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, formatTimeRange } from '../lib/format.js';
import { buildMemberTraining, filterMemberTraining, trainingPage, trainingPlanOptions } from '../lib/memberTraining.js';
import Icon from './Icon.jsx';
import { Button, EmptyState, ErrorNotice, Loading, Notice } from './ui.jsx';
import '../styles/member-training.css';

const EMPTY_FILTERS = { classId: '', planId: '', from: '', to: '', query: '' };
const scoreFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

export default function MemberTraining() {
  const { user } = useAuth();
  const scope = [user?.accountId, user?.access_token];
  const plans = useApi(() => api.trainingPlans.mine(), scope);
  const results = useApi(() => api.trainingResults.mine(), scope);
  const classes = useApi(() => api.classes.list(), []);
  const sessions = useApi(() => api.schedules.list(), []);
  const [tab, setTab] = useState('plans');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const view = useMemo(() => buildMemberTraining(plans.data ?? [], results.data ?? [], classes.data ?? [], sessions.data ?? []), [plans.data, results.data, classes.data, sessions.data]);
  const options = useMemo(() => trainingPlanOptions(view, filters.classId), [view, filters.classId]);
  const visiblePlans = useMemo(() => filterMemberTraining(view.plans, filters), [view.plans, filters]);
  const visibleResults = useMemo(() => filterMemberTraining(view.results, filters), [view.results, filters]);
  const filtered = tab === 'plans' ? visiblePlans : visibleResults;
  const current = trainingPage(filtered, page);
  const state = tab === 'plans' ? plans : results;
  const invalidDates = !!filters.from && !!filters.to && filters.from > filters.to;
  const hasFilters = Object.values(filters).some(Boolean);
  const setFilter = (name, value) => {
    setFilters(previous => ({ ...previous, [name]: value, ...(name === 'classId' ? { planId: '' } : {}) }));
    setPage(1);
  };
  const selectTab = value => { setTab(value); setPage(1); };
  const clear = () => { setFilters(EMPTY_FILTERS); setPage(1); };
  const openPlanResults = plan => {
    setFilters({ ...EMPTY_FILTERS, classId: plan.classKey, planId: plan.planKey });
    selectTab('results');
  };
  const openPlan = result => {
    setFilters({ ...EMPTY_FILTERS, classId: result.classKey, planId: result.planKey });
    selectTab('plans');
  };
  const loadedAnything = view.plans.length > 0 || view.results.length > 0;

  return (
    <section className="member-training" aria-labelledby="member-training-title">
      <header className="member-training__head">
        <div><h2 id="member-training-title" className="panel-title">Tập luyện của bạn</h2><p>Chọn lớp và kế hoạch để xem đúng nội dung tập, buổi học và nhận xét của huấn luyện viên.</p></div>
        <span className="member-training__total">{plans.loading ? '…' : plans.error ? '—' : view.plans.length} kế hoạch · {results.loading ? '…' : results.error ? '—' : view.results.length} kết quả</span>
      </header>

      <div className="member-training__filters" aria-label="Lọc kế hoạch và kết quả">
        <label>Lớp học<select value={filters.classId} onChange={event => setFilter('classId', event.target.value)}><option value="">Tất cả lớp của tôi</option>{view.classOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Kế hoạch<select value={filters.planId} onChange={event => setFilter('planId', event.target.value)}><option value="">Tất cả kế hoạch</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <details className="member-training__more-filters"><summary>Tìm nội dung và khoảng ngày{[filters.query, filters.from, filters.to].filter(Boolean).length > 0 && <span>{[filters.query, filters.from, filters.to].filter(Boolean).length} bộ lọc</span>}<Icon name="chevronDown" size={17} /></summary><div className="member-training__advanced">
          <label className="member-training__search">Tìm nội dung<input type="search" name="training-query" maxLength={200} value={filters.query} onChange={event => setFilter('query', event.target.value)} placeholder="Tên kế hoạch, lớp, nhận xét…" /></label>
          <label>Từ ngày<input type="date" name="training-from" value={filters.from} max={filters.to || undefined} onChange={event => setFilter('from', event.target.value)} /></label>
          <label>Đến ngày<input type="date" name="training-to" value={filters.to} min={filters.from || undefined} onChange={event => setFilter('to', event.target.value)} /></label>
        </div></details>
        <Button size="sm" variant="secondary" onClick={clear} disabled={!hasFilters}>Xóa bộ lọc</Button>
        <p className="member-training__filter-note">{tab === 'plans' ? 'Khoảng ngày lọc theo ngày tạo kế hoạch.' : 'Khoảng ngày lọc theo ngày chấm kết quả.'}</p>
      </div>
      {invalidDates && <p className="field__error" role="alert">Ngày bắt đầu không được sau ngày kết thúc.</p>}
      {loadedAnything && classes.error && <Notice tone="warning" title="Chưa tải được tên lớp" action={<Button size="sm" variant="secondary" onClick={classes.reload}>Tải lại tên lớp</Button>}>Kế hoạch và kết quả vẫn được giữ; tên chưa có sẽ được ghi rõ, không thay bằng dữ liệu mẫu.</Notice>}
      {loadedAnything && sessions.error && <Notice tone="warning" title="Chưa tải được lịch buổi học" action={<Button size="sm" variant="secondary" onClick={sessions.reload}>Tải lại lịch</Button>}>Bạn vẫn xem được ngày chấm và nhận xét; buổi học chưa đối chiếu được sẽ được ghi rõ.</Notice>}
      {tab === 'results' && plans.error && <Notice tone="warning" title="Chưa đối chiếu đủ kế hoạch" action={<Button size="sm" variant="secondary" onClick={plans.reload}>Tải lại kế hoạch</Button>}>Kết quả vẫn được hiển thị theo dữ liệu hiện có. Những kế hoạch hoặc lớp chưa xác định không bị gán sang lớp khác.</Notice>}

      <div className="member-training__switch" role="group" aria-label="Loại thông tin tập luyện">
        <button type="button" aria-pressed={tab === 'plans'} onClick={() => selectTab('plans')}>Kế hoạch <span>{visiblePlans.length}</span></button>
        <button type="button" aria-pressed={tab === 'results'} onClick={() => selectTab('results')}>Kết quả <span>{visibleResults.length}</span></button>
      </div>
      <ErrorNotice error={state.error} onRetry={state.reload} />
      {state.loading ? <Loading label={tab === 'plans' ? 'Đang tải kế hoạch' : 'Đang tải kết quả'} /> : !state.error && (
        <>
          <p className="member-training__count" role="status">{filtered.length ? `Hiển thị ${current.from}–${current.to} / ${current.count} ${tab === 'plans' ? 'kế hoạch' : 'kết quả'}` : 'Không có mục phù hợp'}</p>
          {current.rows.length ? (
            <div className="member-training__list">
              {current.rows.map(item => tab === 'plans' ? (
                <details className="member-training__item" key={item.id}>
                  <summary><div><span className="member-training__class">{item.classLabel}</span><h3>{item.title}</h3><p>Ngày tạo {formatDate(item.createdDate)}{item.coachLabel ? ` · ${item.coachLabel}` : ''}</p></div><Icon name="chevronDown" size={20} /></summary>
                  <div className="member-training__detail"><p className="member-training__content">{item.contentDescription?.trim() || 'Huấn luyện viên chưa ghi nội dung chi tiết.'}</p><Button size="sm" variant="secondary" onClick={() => openPlanResults(item)}>Xem kết quả kế hoạch này ({view.results.filter(result => result.planKey === item.planKey).length})</Button></div>
                </details>
              ) : (
                <details className="member-training__item member-training__item--result" key={item.id}>
                  <summary><div className="member-training__score">{item.score === null ? <span>Chưa có điểm</span> : <><strong>{scoreFormat.format(item.score)}</strong><span>/10</span></>}</div><div><span className="member-training__class">{item.classLabel}</span><h3>{item.title}</h3><p>Ngày chấm {formatDate(item.evaluationDate)}{item.coachLabel ? ` · ${item.coachLabel}` : ''}</p>{item.session && <p>Buổi {formatDate(item.session.date)} · {formatTimeRange(item.session.startTime, item.session.endTime)}</p>}</div><Icon name="chevronDown" size={20} /></summary>
                  <div className="member-training__detail"><p className="member-training__content">{item.coachComment?.trim() || 'Chưa có nhận xét.'}</p>{!item.session && <p className="member-training__missing">{item.sessionIssue || 'Chưa xác định được buổi học; ngày trên là ngày chấm kết quả.'}</p>}{item.knownPlan && <Button size="sm" variant="secondary" onClick={() => openPlan(item)}>Xem kế hoạch</Button>}</div>
                </details>
              ))}
            </div>
          ) : <EmptyState title={hasFilters ? 'Chưa tìm thấy nội dung phù hợp' : tab === 'plans' ? 'Chưa có kế hoạch tập luyện' : 'Chưa có kết quả tập luyện'} action={hasFilters ? <Button size="sm" variant="secondary" onClick={clear}>Xóa bộ lọc</Button> : undefined}>{hasFilters ? 'Thử lớp, kế hoạch hoặc khoảng ngày khác.' : tab === 'plans' ? 'Khi huấn luyện viên lập kế hoạch cho bạn, nội dung sẽ xuất hiện tại đây.' : 'Kết quả và nhận xét sẽ xuất hiện sau khi huấn luyện viên ghi nhận buổi tập.'}</EmptyState>}
          {current.pageCount > 1 && <nav className="member-training__pages" aria-label="Phân trang tập luyện"><Button size="sm" variant="secondary" disabled={current.page === 1} onClick={() => setPage(current.page - 1)}>Trước</Button><span>Trang {current.page} / {current.pageCount}</span><Button size="sm" variant="secondary" disabled={current.page === current.pageCount} onClick={() => setPage(current.page + 1)}>Sau</Button></nav>}
        </>
      )}
    </section>
  );
}
