import { useMemo } from 'react';
import { api } from '../../api/endpoints.js';
import * as mock from '../../api/mockData.js';
import { useApi } from '../../hooks/useApi.js';
import { CoachCard } from '../../components/cards.jsx';
import { EmptyState, ErrorNotice, Loading, SampleDataNotice } from '../../components/ui.jsx';

export default function Coaches() {
  const coaches = useApi(() => api.coaches.list(), [], { sample: mock.coaches });
  const sorted = useMemo(
    () => [...(coaches.data ?? [])].sort((a, b) => b.experienceYears - a.experienceYears),
    [coaches.data],
  );

  return (
    <div className="container page">
      <header className="page-head">
        <h1 className="page-title display">Coaches</h1>
        <p className="page-lead">Every class is led by a qualified coach. Most years on the floor first.</p>
      </header>

      {coaches.usingSample && <div className="section-notice"><SampleDataNotice onRetry={coaches.reload} /></div>}
      <ErrorNotice error={!coaches.usingSample ? coaches.error : null} onRetry={coaches.reload} />

      {coaches.loading ? (
        <Loading />
      ) : sorted.length ? (
        <div className="product-grid product-grid--4">
          {sorted.map((c) => <CoachCard key={c.id} coach={c} />)}
        </div>
      ) : (
        <EmptyState title="No coaches yet">Coaches appear here once a manager adds them in the staff area.</EmptyState>
      )}
    </div>
  );
}
