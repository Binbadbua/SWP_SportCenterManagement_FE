import { useCallback, useEffect, useRef, useState } from 'react';
import { expireSession, getSessionToken } from '../lib/session.js';

const emptyState = (loading = false) => ({ data: null, loading, error: null, usingSample: false });
const readToken = getSessionToken;

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

    setState((previous) => ({
      ...(previous.scope === reload ? previous : emptyState()),
      scope: reload, loading: true, error: null,
    }));
    try {
      const data = await loaderRef.current();
      if (call !== lastCall.current || requestToken !== readToken()) return;
      setState({ data, loading: false, error: null, usingSample: false, scope: reload });
    } catch (error) {
      if (call !== lastCall.current) return;
      if (error?.status === 401 && requestToken) expireSession(requestToken);
      if (requestToken !== readToken()) return;
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

    return () => { lastCall.current += 1; };
  }, [reload]);

  const visible = state.scope === reload ? state : emptyState(!skip);
  return { data: visible.data, loading: visible.loading, error: visible.error, usingSample: visible.usingSample, reload };
}