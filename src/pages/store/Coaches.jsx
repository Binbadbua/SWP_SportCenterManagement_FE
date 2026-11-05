import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { CoachCard } from '../../components/cards.jsx';
import { classesOf } from '../../components/CoachFacts.jsx';
import Icon from '../../components/Icon.jsx';
import { EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';
import '../../styles/catalog-redesign.css';

export default function Coaches() {
  const coaches = useApi(() => api.coaches.list(), [], { sample: mock.coaches });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('experience');
  const sorted = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi');
    return [...(coaches.data ?? [])]
      .filter(coach => !needle || `${coach.fullName ?? ''} ${coach.specialization ?? ''}`.toLocaleLowerCase('vi').includes(needle))
      .sort((a, b) => sort === 'name' ? (a.fullName ?? '').localeCompare(b.fullName ?? '', 'vi') : (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
  }, [coaches.data, query, sort]);
  const relatedClassesKnown = !classes.loading && !!classes.data && (!classes.usingSample || coaches.usingSample);

  return (
    <div className="container page catalog-page catalog-coaches">
      <header className="catalog-intro">
        <div className="catalog-intro__copy"><p className="catalog-eyebrow"><span />Người đồng hành của bạn</p><h1 className="page-title">Tập đúng cách.<br /><span>Tiến bộ mỗi ngày.</span></h1><p>Gặp đội ngũ huấn luyện viên, tìm hiểu chuyên môn và chọn người đồng hành phù hợp với mục tiêu tập luyện của bạn.</p><div className="catalog-intro__facts"><span><Icon name="user" size={16} />Hồ sơ chuyên môn</span><span><Icon name="calendar" size={16} />Lớp và lịch giảng dạy</span></div></div>
        <Link to="/classes" className="catalog-intro__link"><span className="catalog-intro__icon"><Icon name="heart" size={28} /></span><span>Một mục tiêu mới. <br /><strong>Một người đồng hành.</strong></span><Icon name="arrowRight" size={21} /></Link>
      </header>

      <div className="catalog-toolbar catalog-coaches__toolbar"><label className="catalog-search"><Icon name="search" size={20} /><span className="visually-hidden">Tìm huấn luyện viên theo tên hoặc chuyên môn</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo tên hoặc chuyên môn…" /></label><label className="sort-select"><span className="visually-hidden">Sắp xếp huấn luyện viên</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="experience">Kinh nghiệm: cao đến thấp</option><option value="name">Tên: A–Z</option></select></label></div>
      {(coaches.usingSample || classes.usingSample) && <div className="section-notice"><SampleDataNotice onRetry={() => { coaches.reload(); classes.reload(); }} /></div>}
      <ErrorNotice error={!coaches.usingSample ? coaches.error : null} onRetry={coaches.reload} />
      {classes.error && !classes.usingSample && <div className="catalog-data-note"><Icon name="calendar" size={19} /><div><p>Hồ sơ vẫn hiển thị; thông tin bộ môn từ các lớp đang tạm thời chưa tải được.</p><button type="button" onClick={classes.reload}>Tải lại thông tin lớp</button></div></div>}

      <section aria-label="Danh sách huấn luyện viên" aria-live="polite" aria-busy={coaches.loading}>
        <div className="catalog-result-head"><p>{coaches.loading ? 'Đang tải đội ngũ huấn luyện viên…' : coaches.error && !coaches.usingSample ? 'Hồ sơ chưa sẵn sàng' : <><strong>{sorted.length}</strong> huấn luyện viên{query && ' phù hợp'}</>}</p>{query && <button type="button" onClick={() => setQuery('')}>Xóa tìm kiếm<Icon name="close" size={14} /></button>}</div>
        {coaches.loading ? <Loading label="Đang tải huấn luyện viên" /> : sorted.length ? <div className="product-grid product-grid--4">{sorted.map(coach => <CoachCard key={coach.id} coach={coach} classes={relatedClassesKnown ? classesOf(classes.data, coach.id) : undefined} />)}</div> : !coaches.error || coaches.usingSample ? <EmptyState title={query ? 'Chưa tìm thấy người phù hợp' : 'Đội ngũ sẽ sớm được cập nhật'} action={query && <button type="button" className="catalog-reset" onClick={() => setQuery('')}>Xem toàn bộ đội ngũ</button>}>{query ? 'Thử tìm một tên hoặc chuyên môn khác.' : 'Bạn có thể quay lại sau để tìm người đồng hành cùng mình.'}</EmptyState> : null}
      </section>
      <div className="catalog-coach-help"><span><Icon name="heart" size={23} /></span><div><h2>Chưa biết nên bắt đầu với ai?</h2><p>Xem môn học và lịch giảng dạy trong hồ sơ, hoặc liên hệ trung tâm để được hướng dẫn.</p></div><a href="#find-us">Liên hệ trung tâm<Icon name="arrowRight" size={17} /></a></div>
    </div>
  );
}
