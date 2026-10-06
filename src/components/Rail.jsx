import { useRef } from 'react';
import Icon from './Icon.jsx';

// Horizontal scroller with a heading and round prev/next buttons.
export default function Rail({ title, action, children, label }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <section className="rail" aria-label={label ?? title}>
      <div className="rail__head container">
        <h2 className="section-title">{title}</h2>
        <div className="rail__controls">
          {action}
          <button type="button" className="round-btn" onClick={() => scroll(-1)} aria-label="Scroll left">
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="round-btn" onClick={() => scroll(1)} aria-label="Scroll right">
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div className="rail__track" ref={ref}>
        {children}
      </div>
    </section>
  );
}
