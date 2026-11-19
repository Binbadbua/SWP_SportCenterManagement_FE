import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { mutationGuard, mutationScope } from '../lib/mutationGuard.js';

export function useMutationCooldown(method, path) {
  const { user } = useAuth();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  let token = user?.access_token;
  try { token ||= localStorage.getItem('sportcenter.token'); } catch {   }
  return Math.ceil(mutationGuard.wait(method, path, mutationScope(token)) / 1000);
}
