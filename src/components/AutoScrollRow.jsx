import { Children, cloneElement, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import '../styles/auto-scroll-row.css';

// Cards stay inside this scrollport. Copies remain clickable but are excluded from keyboard/SR navigation.
// A custom card child must forward tabIndex to its root link.
export default function AutoScrollRow({ children, label, direction = 'left', speed = 20, className = '' }) {
  const items = Children.toArray(children);
  const track = useRef(null);
  const copy = useRef(null);
  const hovering = useRef(false);
  const focused = useRef(false);
  const resumeAt = useRef(0);
  const [paused, setPaused] = useState(false);
  const [looping, setLooping] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return undefined;
    const sync = () => setReduced(preference.matches);
    preference.addEventListener('change', sync);
    sync();
    return () => preference.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    let setWidth = 0;
    const measure = () => {
      const originals = [...el.children].filter(node => node !== copy.current);
      const first = originals[0], last = originals.at(-1);
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setWidth = first && last ? last.offsetLeft + last.offsetWidth + gap - first.offsetLeft : 0;
      setLooping(items.length > 1 && setWidth > el.clientWidth + 1 && !reduced);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    let frame, previous = performance.now(), position = el.scrollLeft, lastSet = position;
    const tick = now => {
      const elapsed = Math.min(now - previous, 80);
      previous = now;
      const current = el.scrollLeft;
      if (Math.abs(current - lastSet) > 1.5) resumeAt.current = now + 1800;
      if (!paused && !reduced && !hovering.current && !focused.current && !document.hidden && now >= resumeAt.current && items.length > 1 && setWidth > el.clientWidth + 1) {
        position += (direction === 'right' ? -1 : 1) * speed * elapsed / 1000;
        if (position >= setWidth) position -= setWidth;
        if (position < 0) position += setWidth;
        el.scrollLeft = position;
        lastSet = el.scrollLeft;
      } else {
        position = current;
        lastSet = current;
      }
      frame = requestAnimationFrame(tick);
    };
    if (!reduced) frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [items.length, direction, speed, paused, reduced]);

  const scroll = delta => {
    resumeAt.current = performance.now() + 2500;
    track.current?.scrollBy({ left: delta * track.current.clientWidth * .75, behavior: reduced ? 'instant' : 'smooth' });
  };

  return (
    <div className={`auto-row ${className}`} data-direction={direction} data-paused={paused || reduced} style={{ '--row-columns': Math.min(4, Math.max(1, items.length)) }}>
      <div className="auto-row__controls" role="group" aria-label={`Điều khiển ${label}`}>
        <button type="button" onClick={() => scroll(-1)} aria-label={`Xem trước trong ${label}`}><Icon name="chevronLeft" size={17} /></button>
        {!reduced && items.length > 1 && <button className="auto-row__pause" type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? `Tiếp tục chuyển ${label}` : `Tạm dừng chuyển ${label}`}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{paused ? <path d="M5 3.2 13 8l-8 4.8Z" /> : <><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></>}</svg><span>{paused ? 'Tiếp tục' : 'Tạm dừng'}</span></button>}
        <button type="button" onClick={() => scroll(1)} aria-label={`Xem tiếp trong ${label}`}><Icon name="chevronRight" size={17} /></button>
      </div>
      <div ref={track} className="auto-row__track" role="group" aria-label={label}
        onPointerEnter={event => { if (event.pointerType !== 'touch') hovering.current = true; }}
        onPointerLeave={() => { hovering.current = false; resumeAt.current = performance.now() + 600; }}
        onPointerDown={() => { resumeAt.current = performance.now() + 2500; }}
        onWheel={() => { resumeAt.current = performance.now() + 2000; }}
        onFocus={() => { focused.current = true; }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) focused.current = false; }}>
        {items}
        <div ref={copy} className="auto-row__copy" aria-hidden="true" hidden={!looping} onMouseDown={event => event.preventDefault()}>{items.map(item => cloneElement(item, { tabIndex: -1 }))}</div>
      </div>
    </div>
  );
}
