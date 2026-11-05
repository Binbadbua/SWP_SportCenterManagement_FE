import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSlideshow } from '../../hooks/useSlideshow.js';
import { LOGIN_SLIDES, LOGIN_TIMING } from '../../lib/images.js';
import Logo from '../../components/Logo.jsx';
import Icon from '../../components/Icon.jsx';
import { Button, Field, ErrorNotice, Notice, SlowHint } from '../../components/ui.jsx';
import '../../styles/login-redesign.css';

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
  // Photos load one step ahead and cross-fade without moving the form.
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
      <section
        className="login__media"
        aria-hidden="true"
        style={{ '--login-fade': `${LOGIN_TIMING.fade}ms` }}
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
        <div className="login__media-tag"><span />Cùng bạn tiến bộ mỗi ngày</div>
        <div className="login__pitch">
          <p className="login__media-eyebrow">Một nơi cho nhịp sống năng động</p>
          <p className="login__headline">Một chút vận động.<br />Một ngày tốt hơn.</p>
          <p className="login__media-lead">Trở lại với lịch tập của bạn và những mục tiêu đang chờ phía trước.</p>
          <ul className="login__perks">
            {PERKS.map((perk) => (
              <li key={perk}>
                <span className="login__perk-icon"><Icon name="check" size={16} strokeWidth={2.2} /></span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
          <div className="login__slide-dots">
            {LOGIN_SLIDES.map((photo, index) => <span key={photo.src} className={index === active ? 'is-active' : ''} />)}
          </div>
        </div>
      </section>

      <section className="login__panel" aria-labelledby="login-title">
        <form className="login__form" onSubmit={submit} noValidate>
          <div className="login__brand"><Logo /></div>
          <div className="login__intro">
            <p className="login__eyebrow">Tài khoản của bạn</p>
            <h1 id="login-title" className="login__title">Chào mừng bạn trở lại</h1>
            <p className="login__description">
              {next ? 'Đăng nhập để tiếp tục từ chỗ bạn đang dừng.' : 'Đăng nhập để tiếp tục hành trình tập luyện cùng SportCenter.'}
            </p>
          </div>

          {params.get('registered') && (
            <Notice tone="success" title="Tài khoản đã sẵn sàng">
              Đăng nhập bằng email và mật khẩu bạn vừa tạo.
            </Notice>
          )}
          {errorMsg && <ErrorNotice error={{ message: errorMsg }} />}

          <Field
            label="Email hoặc tên đăng nhập"
            name="username"
            type="text"
            required
            value={values.username}
            onChange={set}
            autoComplete="username"
            placeholder="Nhập email hoặc tên đăng nhập"
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
              placeholder="Nhập mật khẩu của bạn"
            />
            <button
              type="button"
              className="login__reveal"
              onClick={() => setShowPassword((current) => !current)}
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

          <div className="login__divider"><span>Bạn mới đến SportCenter?</span></div>
          <Button to="/register" variant="secondary" size="lg" block>Tạo tài khoản</Button>
          <div className="login__staff-note">
            <Icon name="user" size={20} />
            <p className="login__foot">Huấn luyện viên, lễ tân và quản lý cũng đăng nhập tại đây để vào khu vực nhân viên.</p>
          </div>
        </form>
      </section>
    </div>
  );
}
