import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Logo from '../../components/Logo.jsx';
import { Button, Field, ErrorNotice } from '../../components/ui.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  
  // Chỉ cần quản lý Username (Email) và Password
  const [values, setValues] = useState({ username: '', password: '' });
  
  // Trạng thái chờ xử lý (loading) và hiển thị lỗi
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!values.username || !values.password) {
      setErrorMsg('Please enter your full account details and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await signIn(values.username, values.password);
    
    setIsSubmitting(false);

    if (result.success) {
      const staffRoles = [2, 3, 4, 'Coach', 'Receptionist', 'CenterManager'];
      const isStaffUser = staffRoles.includes(result.role);
      const next = params.get('next');
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

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit} noValidate>
        <Logo compact />
        <h1 className="auth__title">Enter your email to join us or sign in.</h1>

        {/* Hiển thị lỗi nếu sai tài khoản/mật khẩu */}
        {errorMsg && <ErrorNotice error={{ message: errorMsg }} />}

        <Field 
          label="Email (Username)" 
          name="username" 
          type="text" // Hoặc type="email" nếu Backend bắt buộc dùng email
          required 
          value={values.username} 
          onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} 
          autoComplete="email" 
        />
        
        <Field 
          label="Password" 
          name="password" 
          type="password" 
          required
          value={values.password} 
          onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} 
          autoComplete="current-password" 
        />

        <Button 
          type="submit" 
          size="lg" 
          block 
          disabled={isSubmitting} // Khóa nút khi đang load API
        >
          {isSubmitting ? 'Signing in...' : 'Continue'}
        </Button>
        
        <p className="auth__foot muted">
          New here? <Link className="text-link" to="/register">Join us</Link>
        </p>
      </form>
    </div>
  );
}