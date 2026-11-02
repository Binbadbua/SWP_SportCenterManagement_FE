import { useCallback, useEffect, useRef, useState } from 'react';

let isHandlingUnauthorized = false;
const emptyState = (loading = false) => ({ data: null, loading, error: null, usingSample: false });
const readToken = () => {
  try { return localStorage.getItem('sportcenter.token'); } catch { return null; }
};

/** Loads data for the current dependencies; samples are only an explicit offline fallback. */
export function useApi(loader, deps = [], { sample, skip = false } = {}) {
  const [state, setState] = useState(() => ({ ...emptyState(!skip), scope: null }));
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  const lastCall = useRef(0);

  const reload = useCallback(async () => {
    const call = ++lastCall.current;
    if (skip) {
      setState({ ...emptyState(), scope: reload });
      return;
    }
    const requestToken = readToken();
    // Keep current data during a manual refresh, never across changed dependencies.
    setState((previous) => ({
      ...(previous.scope === reload ? previous : emptyState()),
      scope: reload, loading: true, error: null,
    }));
    try {
      const data = await loaderRef.current();
      if (call !== lastCall.current) return;
      setState({ data, loading: false, error: null, usingSample: false, scope: reload });
    } catch (error) {
      if (call !== lastCall.current) return;
      // A response from an older session must not sign out a newly issued token.
      if (error?.status === 401 && requestToken && requestToken === readToken()) {
        setState({ ...emptyState(), error, scope: reload });
        if (!isHandlingUnauthorized) {
          isHandlingUnauthorized = true;
          try {
            localStorage.removeItem('sportcenter.token');
            localStorage.removeItem('sportcenter.session');
          } catch { /* Storage can be unavailable; keep the sign-in recovery usable. */ }
          const currentPath = window.location.pathname + window.location.search;
          alert('Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.');
          if (!currentPath.includes('/login')) {
            window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
          } else {
            isHandlingUnauthorized = false;
          }
        }
        return;
      }
      const fallback = typeof sampleRef.current === 'function' ? sampleRef.current() : sampleRef.current;
      if (error?.offline && fallback !== undefined) {
        setState({ data: fallback, loading: false, error, usingSample: true, scope: reload });
      } else {
        setState({ ...emptyState(), error, scope: reload });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  useEffect(() => {
    reload();
    // Invalidate responses and 401 handling when skipped, replaced or unmounted.
    return () => { lastCall.current += 1; };
  }, [reload]);

  // Effects run after paint: also hide the previous scope on the first new render.
  const visible = state.scope === reload ? state : emptyState(!skip);
  return { data: visible.data, loading: visible.loading, error: visible.error, usingSample: visible.usingSample, reload };
}