import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';
import { LogoMark } from './Logo.jsx';
import { AI_DEFAULT_DISCLAIMER, AI_MESSAGE_LIMIT, AI_VISIBLE_TURNS, aiErrorMessage, aiHistory, aiReply } from '../lib/ai.js';
import '../styles/ai-chat.css';

const PROMPTS = [
  'Thẻ thành viên khác đăng ký lớp có huấn luyện viên thế nào?',
  'Tôi xem hóa đơn và lịch tập ở đâu?',
  'Trung tâm hiện có những môn thể thao nào?',
];

// A different signed-in session gets a fresh, in-memory conversation.
export default function AiChatWidget() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  if (pathname.startsWith('/print/')) return null;
  const identity = user
    ? [user.accountId ?? user.userId ?? user.username, user.role ?? user.Role, user.access_token ?? ''].join(':')
    : 'guest';
  return <ChatSession key={identity} user={user} returnTo={pathname + search} />;
}

function ChatSession({ user, returnTo }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [draftError, setDraftError] = useState('');
  const [options, setOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState(null);
  const [readinessAttempt, setReadinessAttempt] = useState(0);
  const launcher = useRef(null);
  const panel = useRef(null);
  const input = useRef(null);
  const log = useRef(null);
  const active = useRef(null);
  const nextId = useRef(0);
  const composing = useRef(false);
  const followBottom = useRef(true);
  const loginTo = '/login?next=' + encodeURIComponent(returnTo);

  useEffect(() => () => {
    const request = active.current;
    active.current = null;
    request?.controller.abort();
  }, []);

  useEffect(() => {
    if (!open || !user) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(null);
    api.ai.options({ signal: controller.signal, timeoutMs: 15000 })
      .then((answer) => { if (!cancelled) setOptions(answer); })
      .catch((error) => { if (!cancelled && !controller.signal.aborted) setOptionsError(error); })
      .finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [open, user?.accountId, readinessAttempt]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      (input.current ?? panel.current?.querySelector('a, button'))?.focus();
    });
    const escape = (event) => {
      if (event.key !== 'Escape' || !panel.current?.contains(document.activeElement)) return;
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => launcher.current?.focus());
    };
    window.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', escape); };
  }, [open]);

  useEffect(() => {
    if (open && followBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, turns, busy]);

  useEffect(() => {
    if (!busy) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  };

  const stop = () => {
    const request = active.current;
    if (!request) return;
    active.current = null;
    request.controller.abort();
    setBusy(false);
    setTurns((previous) => previous.map((turn) => turn.id === request.id
      ? { ...turn, state: 'cancelled', error: null } : turn));
    setDraft((value) => value || request.question);
    requestAnimationFrame(() => input.current?.focus());
  };

  const newConversation = () => {
    const request = active.current;
    active.current = null;
    request?.controller.abort();
    setBusy(false);
    setElapsed(0);
    setTurns([]);
    setDraft('');
    setDraftError('');
    setReadinessAttempt((attempt) => attempt + 1);
    followBottom.current = true;
    requestAnimationFrame(() => input.current?.focus());
  };

  const send = async (value = draft, retryId) => {
    if (active.current || !user) return;
    const question = value.trim();
    if (!question) { setDraftError('Bạn hãy nhập câu hỏi trước khi gửi.'); return; }
    if (question.length > AI_MESSAGE_LIMIT) { setDraftError('Câu hỏi tối đa 2.000 ký tự.'); return; }
    const last = turns.at(-1);
    const retry = turns.find((turn) => turn.id === retryId && turn.state !== 'done')
      ?? (last?.question === question && ['failed', 'cancelled'].includes(last.state) ? last : null);
    const id = retry?.id ?? ++nextId.current;
    const request = { id, question, controller: new AbortController() };
    active.current = request;
    setBusy(true);
    setElapsed(0);
    setDraftError('');
    followBottom.current = true;
    setDraft((previous) => previous.trim() === question ? '' : previous);
    setTurns((previous) => [...previous.filter((turn) => turn.id !== id), { id, question, state: 'pending' }].slice(-AI_VISIBLE_TURNS));
    try {
      const response = await api.ai.chat({ message: question, history: aiHistory(turns) }, {
        signal: request.controller.signal, timeoutMs: 35000,
      });
      if (active.current !== request) return;
      const answer = aiReply(response);
      setTurns((previous) => previous.map((turn) => turn.id === id
        ? { ...turn, state: 'done', answer: answer.text, disclaimer: answer.disclaimer } : turn));
    } catch (error) {
      if (active.current !== request) return;
      setTurns((previous) => previous.map((turn) => turn.id === id
        ? { ...turn, state: 'failed', error } : turn));
      setDraft((previous) => previous || question);
    } finally {
      if (active.current === request) {
        active.current = null;
        setBusy(false);
        requestAnimationFrame(() => input.current?.focus());
      }
    }
  };

  const unavailable = options?.enabled === false || options?.configured === false;
  const hasAnswer = turns.some((turn) => turn.state === 'done');
  const disclaimer = [...turns].reverse().find((turn) => turn.disclaimer)?.disclaimer ?? AI_DEFAULT_DISCLAIMER;
  const expired = optionsError?.status === 401 || turns.at(-1)?.error?.status === 401;

  return (
    <div className="ai-chat no-print">
      {open && (
        <section ref={panel} id="sportcenter-ai-panel" className="ai-chat__panel" role="dialog" aria-modal="false" aria-labelledby="sportcenter-ai-title">
          <header className="ai-chat__head">
            <span className="ai-chat__badge" aria-hidden="true"><LogoMark className="ai-chat__brand-mark" /></span>
            <div className="ai-chat__heading">
              <h2 id="sportcenter-ai-title">Trợ lý SportCenter</h2>
              <p>Gói tập, lớp học và cách dùng website</p>
            </div>
            <button type="button" className="ai-chat__icon" onClick={close} aria-label="Đóng trợ lý AI"><Icon name="close" size={20} /></button>
          </header>
          {!user ? (
            <div className="ai-chat__guest">
              <h3>Đăng nhập để trò chuyện</h3>
              <p>Bạn có thể hỏi về các gói tập, lớp học và cách sử dụng SportCenter.</p>
              <Link className="btn btn--primary" to={loginTo} onClick={close}>Đăng nhập</Link>
              <Link className="text-link" to="/help" onClick={close}>Xem hướng dẫn sử dụng</Link>
            </div>
          ) : (
            <>
              <div className="ai-chat__toolbar">
                <span>{optionsLoading ? 'Đang kiểm tra dịch vụ…' : 'Cuộc trò chuyện trong phiên này'}</span>
                <button type="button" onClick={newConversation} disabled={!turns.length && !draft && !busy} aria-label="Bắt đầu cuộc trò chuyện mới">Cuộc trò chuyện mới</button>
              </div>
              {(optionsError || unavailable) && !hasAnswer && (
                <div className="ai-chat__service" role="status">
                  <p>{optionsError ? aiErrorMessage(optionsError) : 'Trợ lý AI đang được chuẩn bị. Bạn có thể thử gửi câu hỏi hoặc kiểm tra lại sau.'}</p>
                  {optionsError?.status === 401
                    ? <Link to={loginTo} onClick={close}>Đăng nhập lại</Link>
                    : <button type="button" disabled={optionsLoading} onClick={() => setReadinessAttempt((attempt) => attempt + 1)}>Kiểm tra lại</button>}
                </div>
              )}
              <div ref={log} className="ai-chat__log" role="log" aria-label="Nội dung trò chuyện AI" aria-live="polite" aria-relevant="additions text" aria-busy={busy}
                onScroll={() => { const el = log.current; if (el) followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; }}>
                {!turns.length && (
                  <div className="ai-chat__welcome">
                    <h3>Bạn muốn tìm hiểu gì?</h3>
                    <p>Chọn một gợi ý hoặc nhập câu hỏi của bạn.</p>
                    <div className="ai-chat__prompts">
                      {PROMPTS.map((prompt) => <button type="button" key={prompt} onClick={() => { setDraft(prompt); setDraftError(''); input.current?.focus(); }}>{prompt}<Icon name="arrowRight" size={16} /></button>)}
                    </div>
                  </div>
                )}
                {turns.map((turn) => (
                  <div key={turn.id} className="ai-chat__turn">
                    <div className="ai-chat__message ai-chat__message--user"><span className="visually-hidden">Bạn: </span><p>{turn.question}</p></div>
                    {turn.state === 'done' && <div className="ai-chat__message ai-chat__message--assistant"><span className="ai-chat__speaker">Trợ lý AI</span><p>{turn.answer}</p></div>}
                    {turn.state === 'pending' && <div className="ai-chat__pending" role="status"><span className="ai-chat__dots" aria-hidden="true"><i /><i /><i /></span><span>{elapsed >= 8 ? 'AI đang xử lý, bạn có thể dừng chờ.' : 'Đang chờ phản hồi…'}</span></div>}
                    {['failed', 'cancelled'].includes(turn.state) && (
                      <div className="ai-chat__failure">
                        <p role={turn.state === 'failed' ? 'alert' : 'status'}>{turn.state === 'cancelled' ? 'Đã dừng chờ phản hồi. Câu hỏi được giữ lại để bạn gửi sau.' : aiErrorMessage(turn.error)}</p>
                        {turn.error?.status === 401
                          ? <Link to={loginTo} onClick={close}>Đăng nhập lại</Link>
                          : <button type="button" disabled={busy} onClick={() => send(turn.question, turn.id)} aria-label="Thử lại câu hỏi">Thử lại</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form className="ai-chat__form" onSubmit={(event) => { event.preventDefault(); send(); }}>
                <label className="visually-hidden" htmlFor="sportcenter-ai-message">Câu hỏi cho trợ lý AI</label>
                <textarea ref={input} id="sportcenter-ai-message" className="ai-chat__input" rows={2} value={draft} maxLength={AI_MESSAGE_LIMIT} disabled={busy || expired}
                  placeholder="Nhập câu hỏi về SportCenter…" aria-invalid={!!draftError} aria-describedby={draftError ? 'sportcenter-ai-error' : 'sportcenter-ai-help'}
                  onChange={(event) => { setDraft(event.target.value); setDraftError(''); }}
                  onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent?.isComposing && event.keyCode !== 229) {
                      event.preventDefault(); send();
                    }
                  }} />
                {draftError && <p id="sportcenter-ai-error" className="ai-chat__validation" role="alert">{draftError}</p>}
                <div className="ai-chat__compose-actions">
                  <p id="sportcenter-ai-help"><span className="num">{draft.length}/{AI_MESSAGE_LIMIT}</span><span className="ai-chat__keyboard"> · Shift + Enter xuống dòng</span></p>
                  {busy
                    ? <button type="button" className="ai-chat__send ai-chat__send--stop" onClick={stop}>Dừng chờ</button>
                    : <button type="submit" className="ai-chat__send" disabled={!draft.trim() || expired} aria-label="Gửi câu hỏi">Gửi<Icon name="arrowRight" size={16} /></button>}
                </div>
                <p className="ai-chat__disclaimer">{disclaimer}</p>
              </form>
            </>
          )}
        </section>
      )}
      <button ref={launcher} type="button" className={`ai-chat__launcher ${open ? 'is-open' : ''}`} onClick={() => open ? close() : setOpen(true)}
        aria-label={open ? 'Thu gọn trợ lý AI' : 'Mở trợ lý AI'} aria-expanded={open} aria-controls={open ? 'sportcenter-ai-panel' : undefined}>
        <span className="ai-chat__launcher-icon" aria-hidden="true"><LogoMark className="ai-chat__brand-mark" /></span>
      </button>
    </div>
  );
}