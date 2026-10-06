import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/endpoints.js';
import Logo from '../../components/Logo.jsx';
import { Button, Field, ErrorNotice } from '../../components/ui.jsx';

const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

function validate(v) {
  const e = {};
  if (!v.fullName.trim()) e.fullName = 'Enter your full name.';
  if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email, like name@example.com.';
  if (!/^0\d{9}$/.test(v.phone.replace(/\s/g, ''))) e.phone = 'Enter a 10-digit phone number starting with 0.';
  if (!v.dob) e.dob = 'Enter your date of birth.';
  if (v.password.length < 8) e.password = 'Use at least 8 characters.';
  if (!v.confirmPassword) {
    e.confirmPassword = 'Please confirm your password.';
  } else if (v.password !== v.confirmPassword) {
    e.confirmPassword = 'Passwords do not match.';
  }
  if (!v.terms) e.terms = 'Accept the terms to create an account.';
  return e;
}

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({ fullName: '', email: '', phone: '', dob: '', gender: '', trainingGoal: '', password: '', confirmPassword: '', terms: false });
  const [errors, setErrors] = useState({});
  
  // Thêm trạng thái Loading và Báo lỗi từ Server
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const set = (n, val) => setV((s) => ({ ...s, [n]: val }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      // 1. Gọi API Đăng ký gửi cho Backend
      await api.auth.register({
        fullName: v.fullName.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        dob: v.dob,
        gender: v.gender,
        trainingGoal: v.trainingGoal.trim(),
        password: v.password
      });

      // 2. Nếu đăng ký thành công, tự động gọi API Login để lấy Token luôn
      const loginResult = await signIn(v.email.trim(), v.password);
      
      if (loginResult.success) {
        navigate('/account?welcome=1'); // Đưa thẳng vào trang cá nhân của Member
      } else {
        // Nếu lỗi quá trình auto-login thì đẩy ra trang đăng nhập
        navigate('/login?registered=1'); 
      }
    } catch (err) {
      // Bắt lỗi từ Backend (VD: Trùng email, lỗi validation server...)
      setApiError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth">
      {/* noValidate đã được thêm sẵn từ trước để React tự bắt lỗi thay trình duyệt */}
      <form className="auth__card auth__card--wide" onSubmit={submit} noValidate>
        <Logo compact />
        <h1 className="auth__title">Now let’s make you a member.</h1>
        
        {/* Khung báo lỗi từ Backend (nếu có) */}
        {apiError && <ErrorNotice error={{ message: apiError }} />}

        <div className="form-grid">
          <Field className="field--full" label="Full name" name="fullName" required value={v.fullName} onChange={set} error={errors.fullName} autoComplete="name" />
          <Field label="Email" name="email" type="email" required value={v.email} onChange={set} error={errors.email} autoComplete="email" />
          <Field label="Phone" name="phone" type="tel" required value={v.phone} onChange={set} error={errors.phone} autoComplete="tel" />
          <Field label="Date of birth" name="dob" type="date" required value={v.dob} onChange={set} error={errors.dob} />
          <Field label="Gender" name="gender" type="select" options={GENDERS} value={v.gender} onChange={set} />
          <Field className="field--full" label="What do you want to work on?" name="trainingGoal" type="textarea" value={v.trainingGoal} onChange={set} help="Optional. Your coach sees this when they plan your training." />
          <Field label="Password" name="password" type="password" required value={v.password} onChange={set} error={errors.password} help="At least 8 characters." autoComplete="new-password" />
          <Field label="Confirm password" name="confirmPassword" type="password" required value={v.confirmPassword} onChange={set} error={errors.confirmPassword} autoComplete="new-password" />
        </div>

        <label className={`check check--terms ${errors.terms ? 'check--error' : ''}`}>
          <input type="checkbox" checked={v.terms} onChange={(e) => set('terms', e.target.checked)} />
          <span>I agree to the center’s membership terms and privacy policy.</span>
        </label>
        {errors.terms && <p className="field__error">{errors.terms}</p>}

        <Button type="submit" size="lg" block disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
        <p className="auth__foot muted">
          Already a member? <Link className="text-link" to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}