import { useMemo } from 'react';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { CoachCard } from '../../components/cards.jsx';
import { classesOf } from '../../components/CoachFacts.jsx';
import { EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';

// Every coach, most experienced first; a card opens the coach's page (CoachDetail.jsx)
export default function Coaches() {
  const coaches = useApi(() => api.coaches.list(), [], { sample: mock.coaches });
  const classes = useApi(() => api.classes.list(), [], { sample: mock.classes });
  const sorted = useMemo(
    () => [...(coaches.data ?? [])].sort((a, b) => b.experienceYears - a.experienceYears),
    [coaches.data],
  );

  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title display">Huấn luyện viên</h1>
        <p className="page-lead">
          Mỗi lớp đều do một huấn luyện viên có chuyên môn phụ trách. Bấm vào từng người để xem đầy đủ thông tin,
          môn đang dạy và lịch dạy.
        </p>
      </header>

      {coaches.usingSample && <div className="section-notice"><SampleDataNotice onRetry={coaches.reload} /></div>}
      <ErrorNotice error={!coaches.usingSample ? coaches.error : null} onRetry={coaches.reload} />

      {coaches.loading ? (
        <Loading />
      ) : sorted.length ? (
        <>
          <p className="muted coach-count">{sorted.length} huấn luyện viên · xếp theo số năm kinh nghiệm</p>
          <div className="product-grid product-grid--4">
            {sorted.map((c) => <CoachCard key={c.id} coach={c} classes={classesOf(classes.data, c.id)} />)}
          </div>
        </>
      ) : (
        <EmptyState title="Chưa có huấn luyện viên">Huấn luyện viên sẽ hiện ở đây khi quản lý thêm họ trong khu vực nhân viên.</EmptyState>
      )}
    </div>
  );
}
