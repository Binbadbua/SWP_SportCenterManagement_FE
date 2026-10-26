import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSlideshow } from '../../hooks/useSlideshow.js';
import { LOGIN_SLIDES, LOGIN_TIMING } from '../../lib/images.js';
import Logo from '../../components/Logo.jsx';
import Icon from '../../components/Icon.jsx';
import { Button, Field, ErrorNotice, Notice, SlowHint } from '../../components/ui.jsx';

const PERKS = [
  'Đặt lớp chỉ với vài thao tác',
  'Theo dõi điểm danh, kế hoạch tập và nhận xét của huấn luyện viên',
  'Quản lý thẻ thành viên và hóa đơn ở một nơi',
];

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Chỉ cần quản lý Username (Email) và Password
  const [values, setValues] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Trạng thái chờ xử lý (loading) và hiển thị lỗi
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const next = params.get('next') || params.get('from');
  const step = useSlideshow(LOGIN_SLIDES.length, LOGIN_TIMING.interval);
  const active = step % LOGIN_SLIDES.length;
  // The photo fading out keeps panning; photos load one step ahead instead of all at once
  const leaving = step > 0 ? (step - 1) % LOGIN_SLIDES.length : -1;
  const requested = Math.min(LOGIN_SLIDES.length, step + 2);

  const submit = async (e) => {
    e.preventDefault();
    if (!values.username || !values.password) {
      setErrorMsg('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await signIn(values.username, values.password);

    setIsSubmitting(false);

    if (result.success) {
      const staffRoles = [2, 3, 4, 'Coach', 'Receptionist', 'CenterManager'];
      const isStaffUser = staffRoles.includes(result.role);
      if (next && !(next.startsWith('/staff') && !isStaffUser)) {
        navigate(next);
      }
      else if (isStaffUser) {
        navigate('/staff');
      }
      else {
        navigate('/');
      }
    } else {
      setErrorMsg(result.error);
    }
  };

  const set = (n, v) => setValues((s) => ({ ...s, [n]: v }));

  return (
    <div className="login">
      {/* Photo side: the same bold, condensed voice as the home hero, over a panning slideshow */}
      <section
        className="login__media"
        aria-hidden="true"
        style={{
          '--login-fade': `${LOGIN_TIMING.fade}ms`,
          '--login-pan': `${LOGIN_TIMING.interval + LOGIN_TIMING.fade}ms`,
        }}
      >
        {LOGIN_SLIDES.map((s, i) => (
          <img
            key={`${i}-${s.src}`}
            className={`login__slide ${i === active ? 'is-active' : i === leaving ? 'is-leaving' : ''}`}
            src={i < requested ? s.src : undefined}
            alt=""
            style={s.position ? { objectPosition: s.position } : undefined}
            decoding="async"
          />
        ))}
        <div className="login__shade" />
        <div className="login__pitch">
          <p className="label">Thành viên SportCenter</p>
          <p className="login__headline display">
            Trở lại<br />sân tập.
          </p>
          <ul className="login__perks">
            {PERKS.map((p) => (
              <li key={p}>
                <Icon name="check" size={18} strokeWidth={2.2} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={submit} noValidate>
          <Logo compact />
          <div>
            <p className="login__eyebrow label">Đăng nhập</p>
            <h1 className="login__title">Chào mừng bạn trở lại</h1>
            <p className="muted">
              {next ? 'Đăng nhập để tiếp tục từ chỗ bạn đang dừng.' : 'Dùng email hoặc tên đăng nhập bạn đã đăng ký.'}
            </p>
          </div>

          {params.get('registered') && (
            <Notice tone="success" title="Tài khoản đã sẵn sàng">
              Đăng nhập bằng email và mật khẩu bạn vừa tạo.
            </Notice>
          )}
          {/* Hiển thị lỗi nếu sai tài khoản/mật khẩu */}
          {errorMsg && <ErrorNotice error={{ message: errorMsg }} />}

          <Field
            label="Email hoặc tên đăng nhập"
            name="username"
            type="text"
            required
            value={values.username}
            onChange={set}
            autoComplete="username"
            autoFocus
          />

          <div className="login__password">
            <Field
              label="Mật khẩu"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={values.password}
              onChange={set}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="login__reveal"
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              aria-controls="f-password"
            >
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>

          <Button type="submit" size="lg" block disabled={isSubmitting} iconAfter={isSubmitting ? undefined : 'arrowRight'}>
            {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
          <SlowHint active={isSubmitting} />

          <div className="login__divider"><span>Lần đầu đến SportCenter?</span></div>
          <Button to="/register" variant="secondary" size="lg" block>
            Tạo tài khoản
          </Button>
          <p className="login__foot muted small">
            Huấn luyện viên, lễ tân và quản lý cũng đăng nhập ở đây và được chuyển thẳng vào khu vực nhân viên.
          </p>
        </form>
      </section>
    </div>
  );
}
