import { useCallback, useEffect, useRef, useState } from 'react';

let isHandlingUnauthorized = false;
/**
 * Loads data with loading / error state.
 * If the back-end is unreachable and `sample` is given, the sample data is shown
 * instead and `usingSample` is true (pages show a notice).
 *
 *   const { data, loading, error, usingSample, reload } = useApi(() => api.rooms.list(), [], { sample: mock.rooms });
 */
export function useApi(loader, deps = [], { sample, skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null, usingSample: false });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  // Only the latest load may set the state: when the deps change quickly (picking one member, then
  // another) an earlier, slower answer would otherwise overwrite the newer one
  const lastCall = useRef(0);

  const reload = useCallback(async () => {
    if (skip) return;
    const call = ++lastCall.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (call !== lastCall.current) return;
      setState({ data, loading: false, error: null, usingSample: false });
    } catch (error) {
      if (call !== lastCall.current) return;
      // 401 with a saved token = the session expired. Without a token the visitor is simply
      // not signed in, so the page shows the error instead of being sent to the sign-in page.
      const hasToken = !!localStorage.getItem('sportcenter.token');
      if (error?.status === 401 && hasToken) {
        if (!isHandlingUnauthorized) {
          isHandlingUnauthorized = true;
          localStorage.removeItem('sportcenter.token');
          localStorage.removeItem('sportcenter.session');
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
        setState({ data: fallback, loading: false, error, usingSample: true });
      } else {
        setState({ data: null, loading: false, error, usingSample: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
