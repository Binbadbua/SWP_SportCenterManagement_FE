import { useEffect, useState } from 'react';

export function useSlideshow(count, interval) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (count < 2) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setStep((s) => s + 1), interval);
    return () => clearInterval(timer);
  }, [count, interval]);
  return step;
}

export function useTrailing(value, delay) {
  const [trailing, setTrailing] = useState(value);
  useEffect(() => {
    if (trailing === value) return undefined;
    const timer = setTimeout(() => setTrailing(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay, trailing]);
  return trailing;
}
