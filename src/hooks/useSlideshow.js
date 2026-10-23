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
