import { useEffect, useState } from 'react';

/**
 * Step counter for an auto-advancing slideshow: grows by one every `interval` ms, so the photo on
 * screen is `step % count` and `step > 0` means the slideshow has moved at least once.
 * It never advances with fewer than two photos or for people who ask for reduced motion.
 */
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

/**
 * `value` as it was `delay` ms ago: it takes each new value only after the delay. The home hero
 * uses it to change its headline once the old photo has faded out.
 */
export function useTrailing(value, delay) {
  const [trailing, setTrailing] = useState(value);
  useEffect(() => {
    if (trailing === value) return undefined;
    const timer = setTimeout(() => setTrailing(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay, trailing]);
  return trailing;
}
