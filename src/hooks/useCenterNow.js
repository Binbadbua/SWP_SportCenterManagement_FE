import { useEffect, useState } from 'react';

export function useCenterNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer;
    const refresh = () => {
      setNow(new Date());
      clearTimeout(timer);
      timer = setTimeout(refresh, 60000 - Date.now() % 60000 + 10);
    };
    const visible = () => { if (!document.hidden) refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return now;
}
