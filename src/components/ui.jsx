import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

/* ---------------------------------------------------------------------------
   SlowHint — shows once an action has waited a few seconds. Sign-in, sign-up and password
   changes take 10–30 s on the hosted API (CHANGELOG Part B, B41), long enough to look frozen.
--------------------------------------------------------------------------- */
export function SlowHint({ active, after = 3000, children = 'Máy chủ đang xử lý, có thể mất vài chục giây. Bạn chờ một chút nhé.' }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return undefined;
    }
    const timer = setTimeout(() => setShown(true), after);
    return () => clearTimeout(timer);
  }, [active, after]);
  return shown ? <p className="slow-hint muted small" role="status">{children}</p> : null;
}

/* ---------------------------------------------------------------------------
   Button
   variant: primary (black pill) | secondary (outlined pill) | inverse (white pill)
            | offset (square, offset outline — hero CTA) | ghost | danger
   Pass `to` for a router link, `href` for an external link, otherwise a <button>.
--------------------------------------------------------------------------- */
export function Button({ variant = 'primary', size, to, href, icon, iconAfter, block, className = '', children, ...rest }) {
  const cls = ['btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', className].filter(Boolean).join(' ');
  const content = (
    <>
      {icon && <Icon name={icon} size={18} />}
      {children && <span>{children}</span>}
      {iconAfter && <Icon name={iconAfter} size={18} />}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{content}</a>;
  return <button type="button" className={cls} {...rest}>{content}</button>;
}

export function IconButton({ icon, label, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

/* Status tag coloured by tone (see lib/enums.js) */
export function StatusTag({ tone = 'neutral', children }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

/* "12/20" with a short bar: places taken in a class */
export function FillBar({ value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className="fill">
      <span className="fill__bar"><span style={{ width: `${pct}%` }} /></span>
      <span className="num">{value}/{max}</span>
    </span>
  );
}

/* "Preview" marker for UI that has no API behind it yet */
export function PreviewTag({ children = 'Bản xem trước' }) {
  return (
    <span className="preview-tag" title="Chỉ có giao diện — chức năng này chưa có API">
      {children}
    </span>
  );
}

/* Inline notices ---------------------------------------------------------- */
export function Notice({ tone = 'info', title, children, action }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div>
        {title && <strong className="notice__title">{title}</strong>}
        {children && <div className="notice__body">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function SampleDataNotice({ onRetry }) {
  return (
    <Notice
      tone="info"
      title="Đang hiện dữ liệu mẫu"
      action={onRetry && <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Thử lại</Button>}
    >
      Không kết nối được máy chủ nên trang đang hiện dữ liệu ví dụ. Hãy bật máy chủ (xem README.md) để xem dữ liệu thật.
    </Notice>
  );
}

export function PreviewNotice({ feature, children }) {
  return (
    <Notice tone="preview" title="Bản xem trước giao diện">
      {children ?? `${feature} chưa có API. Thay đổi ở đây chỉ được giữ trên trình duyệt đến khi tải lại trang.`}
    </Notice>
  );
}

export function ErrorNotice({ error, onRetry }) {
  if (!error) return null;
  const errorMessage = typeof error === 'string' ? error : (error.message || 'Đã xảy ra lỗi hệ thống.');
  const isOffline = typeof error === 'object' && error.offline;
  return (
    <Notice
      tone="danger"
      title={isOffline ? 'Không kết nối được máy chủ' : 'Đã xảy ra lỗi'}
      action={onRetry && <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Thử lại</Button>}
    >
      {errorMessage}
    </Notice>
  );
}

/* Loading & empty ---------------------------------------------------------- */
export function Loading({ label = 'Đang tải' }) {
  return (
    <div className="loading" role="status">
      <span className="loading__bar" />
      <span className="visually-hidden">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body muted">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

/* Form field ----------------------------------------------------------------
   type: text | email | number | date | time | password | tel | url | textarea | select */
// options = [{ value, label, disabled? }]; for a select, placeholder is the text of its empty choice
export function Field({ label, name, type = 'text', value, onChange, options = [], error, help, required, className = '', placeholder, ...rest }) {
  const id = `f-${name}`;
  const describedBy = [help && `${id}-help`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  const common = {
    id, name, required, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy,
    value: value ?? '', onChange: (e) => onChange?.(name, e.target.value), ...rest,
  };
  let control;
  if (type === 'textarea') control = <textarea className="input input--area" rows={4} placeholder={placeholder} {...common} />;
  else if (type === 'select') {
    control = (
      <div className="select-wrap">
        <select className="input" {...common}>
          <option value="">{placeholder ?? 'Chọn…'}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} className="select-wrap__icon" />
      </div>
    );
  }
  else if (type === 'file') {
    control = (
      <div className="flex items-center gap-3 p-2 border border-gray-200 rounded-xl bg-white">
        {/* Nút bấm gọi hộp thoại chọn file độc lập */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            // Tạo input file trực tiếp bằng JS ngoài cây DOM của Modal
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';

            fileInput.onchange = (event) => {
              const file = event.target.files?.[0];
              if (file) {
                onChange?.(name, file);
              }
            };

            fileInput.click();
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 cursor-pointer"
        >
          📁 Chọn ảnh...
        </button>

        {/* Hiển thị tên file đã chọn */}
        <span className="text-xs text-gray-500 truncate max-w-[220px]">
          {value instanceof File ? value.name : (value ? String(value) : "Chưa có file nào được chọn")}
        </span>
      </div>
    );
  }
  else control = <input className="input" type={type} placeholder={placeholder} {...common} />;

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {help && !error && <p id={`${id}-help`} className="field__help">{help}</p>}
      {error && <p id={`${id}-err`} className="field__error">{error}</p>}
    </div>
  );
}
