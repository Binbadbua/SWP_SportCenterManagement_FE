import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

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

/* "Preview" marker for UI that has no API behind it yet */
export function PreviewTag({ children = 'Preview' }) {
  return (
    <span className="preview-tag" title="UI only — this feature has no back-end API yet">
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
      title="Showing sample data"
      action={onRetry && <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Try again</Button>}
    >
      The API isn’t reachable, so this page shows example content. Start the back-end (see README.md) to see real data.
    </Notice>
  );
}

export function PreviewNotice({ feature, children }) {
  return (
    <Notice tone="preview" title="UI preview">
      {children ?? `${feature} has no back-end API yet. Changes here are kept in the browser until you reload.`}
    </Notice>
  );
}

export function ErrorNotice({ error, onRetry }) {
  if (!error) return null;
  return (
    <Notice
      tone="danger"
      title={error.offline ? 'Can’t reach the API' : 'Something went wrong'}
      action={onRetry && <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Try again</Button>}
    >
      {error.message}
    </Notice>
  );
}

/* Loading & empty ---------------------------------------------------------- */
export function Loading({ label = 'Loading' }) {
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
export function Field({ label, name, type = 'text', value, onChange, options = [], error, help, required, className = '', ...rest }) {
  const id = `f-${name}`;
  const describedBy = [help && `${id}-help`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  const common = {
    id, name, required, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy,
    value: value ?? '', onChange: (e) => onChange?.(name, e.target.value), ...rest,
  };
  let control;
  if (type === 'textarea') control = <textarea className="input input--area" rows={4} {...common} />;
  else if (type === 'select') {
    control = (
      <div className="select-wrap">
        <select className="input" {...common}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} className="select-wrap__icon" />
      </div>
    );
  } else control = <input className="input" type={type} {...common} />;

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
