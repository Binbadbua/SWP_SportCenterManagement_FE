import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatMoney } from '../lib/format.js';

const SERIES = [
  { key: 'gross', label: 'Tổng đã thu', color: '#285c59' },
  { key: 'refunds', label: 'Đã hoàn', color: '#929b9c' },
  { key: 'net', label: 'Thu sau hoàn', color: '#c63b13' },
];
const shortMoney = value => {
  const absolute = Math.abs(value);
  const [unit, divisor] = absolute >= 1e9 ? [' tỷ', 1e9] : absolute >= 1e6 ? [' triệu', 1e6] : absolute >= 1000 ? [' nghìn', 1000] : ['', 1];
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / divisor) + unit;
};
const shortLabel = (row, filters) => {
  if (filters.dimension === 'time' && filters.grain === 'week') return row.label.replaceAll('/' + row.key.slice(0, 4), '');
  return row.label.length > 13 ? row.label.slice(0, 12) + '…' : row.label;
};

export default function RevenueChart({ rows, filters, page, pageCount }) {
  const titleId = useId();
  const descriptionId = useId();
  const scroll = useRef(null);
  const [availableWidth, setAvailableWidth] = useState(700);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return undefined;
    const measure = () => setAvailableWidth(Math.max(280, element.clientWidth));
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [rows.length > 0]);
  const ordered = useMemo(() => filters.dimension === 'time' ? [...rows].sort((a, b) => a.key.localeCompare(b.key)) : rows, [rows, filters.dimension]);
  const minimumSlot = filters.dimension === 'time' && filters.grain === 'day' ? 44 : 90;
  const width = Math.max(availableWidth, ordered.length * minimumSlot + 104);
  const groupIdentity = ordered.map(row => row.key).join('|');
  useEffect(() => {
    const element = scroll.current;
    if (element) element.scrollLeft = filters.dimension === 'time' ? element.scrollWidth : 0;
  }, [availableWidth, groupIdentity, filters.dimension]);
  const height = 345, left = 84, right = 20, top = 25, bottom = 90;
  const values = ordered.flatMap(row => SERIES.map(series => row[series.key]));
  const maximum = Math.max(0, ...values);
  const minimum = Math.min(0, ...values);
  const upper = maximum > 0 ? maximum * 1.1 : minimum < 0 ? 0 : 1;
  const lower = minimum < 0 ? minimum * 1.1 : 0;
  const y = value => top + (upper - value) / (upper - lower) * (height - top - bottom);
  const baseline = y(0);
  const plotWidth = width - left - right;
  const slot = plotWidth / Math.max(ordered.length, 1);
  const barWidth = Math.min(18, (slot - 18) / 3);
  const ticks = Array.from({ length: 5 }, (_, index) => lower + (upper - lower) * index / 4);
  const range = filters.dimension === 'time' ? filters.grain === 'day' ? 'ngày' : filters.grain === 'week' ? 'tuần' : 'tháng' : filters.dimension === 'sport' ? 'môn / nội dung' : 'lớp / nội dung';
  return (
    <section className="revenue-chart" aria-labelledby={titleId}>
      <div className="revenue-chart__heading">
        <div>
          <h3 id={titleId}>Biểu đồ thu tiền và hoàn tiền</h3>
          <p>Cùng bộ lọc và số liệu với bảng bên dưới · theo {range} · đơn vị đồng (₫).</p>
        </div>
        <ul className="revenue-chart__legend" aria-label="Chú giải biểu đồ">
          {SERIES.map(series => <li key={series.key}><span style={{ backgroundColor: series.color }} aria-hidden="true" />{series.label}</li>)}
        </ul>
      </div>
      <p id={descriptionId} className="revenue-chart__caption">{pageCount > 1 ? 'Hiển thị các nhóm của trang ' + page + '/' + pageCount + '. Đổi trang ở cuối bảng để xem các nhóm tiếp theo. ' : ''}Di chuột lên cột để xem số tiền; bảng bên dưới có đầy đủ giá trị.{minimum < 0 ? ' Khoản thu sau hoàn âm được vẽ dưới mốc 0.' : ''}</p>
      {ordered.length ? <div ref={scroll} className="revenue-chart__scroll" tabIndex={0} role="region" aria-label="Biểu đồ doanh thu, có thể cuộn ngang" aria-describedby={descriptionId}>
        <svg width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
          <title>Biểu đồ {range}: tổng đã thu, đã hoàn và thu sau hoàn</title>
          {ticks.map((tick, index) => <g key={index} className="revenue-chart__tick"><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text x={left - 10} y={y(tick) + 4} textAnchor="end">{shortMoney(tick)}</text></g>)}
          <line className="revenue-chart__zero" x1={left} x2={width - right} y1={baseline} y2={baseline} />
          {ordered.map((row, index) => {
            const center = left + slot * (index + .5);
            return <g className="revenue-chart__group" key={row.key} data-key={row.key} data-label={row.label} data-gross={row.gross} data-refunds={row.refunds} data-net={row.net}>
              <title>{row.label + ': tổng đã thu ' + formatMoney(row.gross) + ', đã hoàn ' + formatMoney(row.refunds) + ', thu sau hoàn ' + formatMoney(row.net)}</title>
              {SERIES.map((series, seriesIndex) => {
                const value = row[series.key];
                return <rect key={series.key} data-series={series.key} data-value={value} x={center + (seriesIndex - 1.5) * (barWidth + 3) + 1.5} y={Math.min(y(value), baseline)} width={barWidth} height={Math.abs(y(value) - baseline)} rx={3} fill={value < 0 ? '#b42318' : series.color}>
                  <title>{row.label + ' · ' + series.label + ': ' + formatMoney(value)}</title>
                </rect>;
              })}
              <text className="revenue-chart__label" x={center} y={height - bottom + 18} transform={'rotate(-40 ' + center + ' ' + (height - bottom + 18) + ')'} textAnchor="end">{shortLabel(row, filters)}</text>
            </g>;
          })}
        </svg>
      </div> : <p className="revenue-chart__empty">Không có giao dịch thuộc bộ lọc này để vẽ biểu đồ.</p>}
    </section>
  );
}
