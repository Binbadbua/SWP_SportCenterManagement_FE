import { memo, useEffect, useMemo, useState } from 'react';
import { useSlideshow } from '../hooks/useSlideshow.js';
import { IMAGES, sportImage } from '../lib/images.js';

// Decorative only: all current sports supply a photo, without links, labels or controls.
function SportPhotoSlideshow({ categories }) {
  const photos = useMemo(() => categories?.length
    ? categories.map((category, index) => ({ key: category.id ?? index, src: sportImage(category.categoryName) }))
    : [{ key: 'facility', src: IMAGES.facility }], [categories]);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return undefined;
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const step = useSlideshow(reducedMotion ? 1 : photos.length, 7000);
  const active = step % photos.length;
  const requested = Math.min(photos.length, step + (reducedMotion ? 1 : 2));

  return (
    <div className="catalog-sport-slides" aria-hidden="true" data-reduced-motion={reducedMotion}>
      {photos.map((photo, index) => <img key={photo.key} className={index === active ? 'is-active' : undefined} src={index < requested ? photo.src : undefined} alt="" decoding="async" draggable="false" />)}
    </div>
  );
}

export default memo(SportPhotoSlideshow);
