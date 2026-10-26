import { useEffect, useRef, useState } from 'react';
import { api } from '../api/endpoints.js';
import { photoUrl } from '../lib/images.js';
import { Button } from './ui.jsx';

// What the API's photo store accepts (it also checks the file's first bytes) — see api.media
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;

/* ---------------------------------------------------------------------------
   ImageField — a photo chosen from the computer instead of a pasted link.
   The file is uploaded as soon as it is picked and the field's value becomes the
   link the API returns, so the form still saves a plain URL (avatar). onBusy(true)
   while uploading lets the form hold its Save button.
--------------------------------------------------------------------------- */
export default function ImageField({ label, name, value, onChange, onBusy, help, error, className = '' }) {
  const id = `f-${name}`;
  const input = useRef(null);
  const alive = useRef(true);
  const [local, setLocal] = useState(null); // preview of the file being uploaded
  const [problem, setProblem] = useState(null);
  const busy = !!local;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still counts as a change
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setProblem('Chỉ chọn được ảnh JPG, PNG, WebP hoặc GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setProblem(`Ảnh này nặng ${(file.size / 1048576).toFixed(1).replace('.', ',')} MB, tối đa là 5 MB.`);
      return;
    }
    setProblem(null);
    setLocal(URL.createObjectURL(file));
    onBusy?.(true);
    try {
      const { url } = await api.media.uploadImage(file);
      // The dialog may have been closed while the file was on its way
      if (alive.current) onChange?.(name, url);
    } catch (err) {
      if (alive.current) setProblem(err.message || 'Không tải được ảnh lên. Hãy thử lại.');
    } finally {
      if (alive.current) setLocal(null);
      onBusy?.(false);
    }
  };

  const message = problem || error;
  const shown = local ?? (value ? photoUrl(value, 192, 240) : null);
  return (
    <div className={`field image-field ${message ? 'field--error' : ''} ${className}`} role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="field__label">{label}</span>
      <div className="image-field__body">
        <div className={`image-field__preview ${busy ? 'is-busy' : ''}`}>
          {shown ? <img src={shown} alt={busy ? 'Ảnh đang tải lên' : 'Ảnh hiện tại'} /> : <span>Chưa có ảnh</span>}
        </div>
        <div className="image-field__actions">
          <input ref={input} id={id} name={name} type="file" accept={TYPES.join(',')} hidden onChange={pick} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => input.current?.click()}
            disabled={busy}
            aria-describedby={message ? `${id}-err` : `${id}-help`}
          >
            {busy ? 'Đang tải ảnh lên…' : value ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy'}
          </Button>
          {value && !busy && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange?.(name, '')}>
              Gỡ ảnh
            </Button>
          )}
        </div>
      </div>
      {!message && <p id={`${id}-help`} className="field__help">{help ?? 'JPG, PNG, WebP hoặc GIF, tối đa 5 MB.'}</p>}
      {message && <p id={`${id}-err`} className="field__error" role="alert">{message}</p>}
    </div>
  );
}
