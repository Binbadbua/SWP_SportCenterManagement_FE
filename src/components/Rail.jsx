import { Children, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Horizontal scroller with a heading and round prev/next buttons.
//
// autoScroll: the track drifts slowly (`speed` px per second) and loops forever — the items move
// to the left by default, to the right with direction="right". The items are rendered a second
// time after the originals, so when the drift reaches one end of the first copy the position jumps
// by exactly one copy and the loop has no visible seam.
// It pauses while the pointer is over the track or it has keyboard focus, waits a moment after
// any manual scroll (swipe, wheel, arrow buttons), and stays still for people who ask for
// reduced motion.
export default function Rail({ title, action, children, label, autoScroll = false, speed = 35, direction = 'left' }) {
  const ref = useRef(null);
  const copyRef = useRef(null);
  const paused = useRef(false);
  const resumeAt = useRef(0);
  const [looping, setLooping] = useState(false);
  const count = Children.count(children);

  const hold = (ms) => {
    resumeAt.current = performance.now() + ms;
  };
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = ref.current;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!autoScroll || !el || reduceMotion) {
      setLooping(false);
      return undefined;
    }

    // Width of one full set of items = where the copy starts. Only loop when the set is wider
    // than the track; otherwise every item is already visible and the copy would show duplicates.
    let setWidth = 0;
    const measure = () => {
      const originals = [...el.children].filter((c) => c !== copyRef.current);
      const first = originals[0];
      const lastItem = originals[originals.length - 1];
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setWidth = first ? lastItem.offsetLeft + lastItem.offsetWidth + gap - first.offsetLeft : 0;
      setLooping(setWidth > el.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    let frame;
    let last = performance.now();
    let pos = el.scrollLeft; // kept as a float: scrollLeft may round to whole pixels
    let lastSet = pos;
    // Items moving right = the scroll position going down, wrapping from the start to one copy in
    const step = direction === 'right' ? -1 : 1;
    const tick = (now) => {
      const dt = Math.min(now - last, 100); // a background tab resumes without a jump
      last = now;
      const current = el.scrollLeft;
      if (Math.abs(current - lastSet) > 1.5) hold(1500); // someone else moved the track
      if (setWidth > el.clientWidth && !paused.current && now >= resumeAt.current) {
        pos += (step * speed * dt) / 1000;
        if (pos >= setWidth) pos -= setWidth;
        if (step < 0 && pos <= 0) pos += setWidth;
        el.scrollLeft = pos;
        lastSet = el.scrollLeft;
      } else {
        pos = current; // follow manual scrolling while paused
        lastSet = current;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [autoScroll, speed, direction, count]);

  const pauseHandlers = autoScroll
    ? {
        onMouseEnter: () => { paused.current = true; },
        onMouseLeave: () => { paused.current = false; hold(600); },
        onFocus: () => { paused.current = true; },
        onBlur: () => { paused.current = false; },
      }
    : {};

  return (
    <section className="rail" aria-label={label ?? title}>
      <div className="rail__head container">
        <h2 className="section-title">{title}</h2>
        <div className="rail__controls">
          {action}
          <button type="button" className="round-btn" onClick={() => scroll(-1)} aria-label="Cuộn sang trái">
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="round-btn" onClick={() => scroll(1)} aria-label="Cuộn sang phải">
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div className={`rail__track ${autoScroll ? 'rail__track--auto' : ''}`} ref={ref} {...pauseHandlers}>
        {children}
        {autoScroll && (
          // The copy only exists for the seamless loop: hidden from screen readers and the keyboard
          <div className="rail__copy" ref={copyRef} aria-hidden="true" inert hidden={!looping}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
