import { useCallback, useEffect, useRef, useState } from 'react';

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

  const reload = useCallback(async () => {
    if (skip) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      setState({ data, loading: false, error: null, usingSample: false });
    } catch (error) {
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
