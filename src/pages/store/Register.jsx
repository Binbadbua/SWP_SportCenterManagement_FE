import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../api/endpoints.js";
import { Gender } from "../../lib/enums.js";
import { fromDateInput } from "../../lib/format.js";
import Logo from "../../components/Logo.jsx";
import { AgreeToPolicies } from "../../components/Policies.jsx";
import { Button, Field, ErrorNotice, SlowHint } from "../../components/ui.jsx";

const GENDERS = Gender.options;

function validate(v) {
  const e = {};
  if (!v.username.trim()) e.username = "Vui lòng nhập tên đăng nhập.";
  if (!v.fullName.trim()) e.fullName = "Vui lòng nhập họ tên.";
  if (!/^\S+@\S+\.\S+$/.test(v.email))
    e.email = "Email chưa đúng định dạng, ví dụ ten@example.com.";
  if (!/^0\d{9}$/.test(v.phone.replace(/\s/g, "")))
    e.phone = "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0.";
  if (!v.dob) e.dob = "Vui lòng nhập ngày sinh.";
  if (v.password.length < 8) e.password = "Mật khẩu cần ít nhất 8 ký tự.";
  if (!v.confirmPassword) {
    e.confirmPassword = "Vui lòng nhập lại mật khẩu.";
  } else if (v.password !== v.confirmPassword) {
    e.confirmPassword = "Mật khẩu nhập lại không khớp.";
  }
  if (!v.terms) e.terms = "Bạn cần đồng ý với điều khoản để tạo tài khoản.";
  return e;
}

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    trainingGoal: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
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
        username: v.username.trim(),
        fullName: v.fullName.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        dob: fromDateInput(v.dob),
        gender: v.gender,
        trainingGoal: v.trainingGoal.trim(),
        password: v.password,
      });

      // 2. Nếu đăng ký thành công, tự động gọi API Login để lấy Token luôn
      const loginResult = await signIn(v.email.trim(), v.password);

      if (loginResult.success) {
        // 3. POST /api/auth/register only stores username, email, password (and full name), so the
        //    rest of the form is saved on the new member profile with PUT /api/members/me.
        let profileSaved = true;
        try {
          await api.members.me.update({
            fullName: v.fullName.trim(),
            email: v.email.trim(),
            phone: v.phone.replace(/\s/g, ""),
            dob: fromDateInput(v.dob),
            gender: v.gender,
            trainingGoal: v.trainingGoal.trim(),
            avatar: "",
          });
        } catch (profileError) {
          console.error("Could not save the member profile:", profileError);
          profileSaved = false;
        }
        // Đưa thẳng vào trang cá nhân của Member
        navigate(profileSaved ? "/account?welcome=1" : "/account?welcome=1&profile=incomplete");
      } else {
        // Nếu lỗi quá trình auto-login thì đẩy ra trang đăng nhập
        navigate("/login?registered=1");
      }
    } catch (err) {
      // Bắt lỗi từ Backend (VD: Trùng email, lỗi validation server...)
      setApiError(err.message || "Đăng ký không thành công. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth">
      {/* noValidate đã được thêm sẵn từ trước để React tự bắt lỗi thay trình duyệt */}
      <form
        className="auth__card auth__card--wide"
        onSubmit={submit}
        noValidate
      >
        <Logo compact />
        <h1 className="auth__title">Cùng trở thành thành viên nhé.</h1>

        {/* Khung báo lỗi từ Backend (nếu có) */}
        {apiError && <ErrorNotice error={{ message: apiError }} />}

        <div className="form-grid">
          <Field
            className="field--full"
            label="Họ và tên"
            name="fullName"
            required
            value={v.fullName}
            onChange={set}
            error={errors.fullName}
            autoComplete="name"
          />
          <Field
            className="field--full"
            label="Tên đăng nhập"
            name="username"
            required
            value={v.username}
            onChange={set}
            error={errors.username}
            autoComplete="username"
          />
          <Field
            label="Email"
            name="email"
            type="email"
            required
            value={v.email}
            onChange={set}
            error={errors.email}
            autoComplete="email"
          />
          <Field
            label="Số điện thoại"
            name="phone"
            type="tel"
            required
            value={v.phone}
            onChange={set}
            error={errors.phone}
            autoComplete="tel"
          />
          <Field
            label="Ngày sinh"
            name="dob"
            type="date"
            required
            value={v.dob}
            onChange={set}
            error={errors.dob}
          />
          <Field
            label="Giới tính"
            name="gender"
            type="select"
            options={GENDERS}
            value={v.gender}
            onChange={set}
          />
          <Field
            className="field--full"
            label="Bạn muốn cải thiện điều gì?"
            name="trainingGoal"
            type="textarea"
            value={v.trainingGoal}
            onChange={set}
            help="Không bắt buộc. Huấn luyện viên sẽ xem mục này khi lên kế hoạch tập cho bạn."
          />
          <Field
            label="Mật khẩu"
            name="password"
            type="password"
            required
            value={v.password}
            onChange={set}
            error={errors.password}
            help="Ít nhất 8 ký tự."
            autoComplete="new-password"
          />
          <Field
            label="Nhập lại mật khẩu"
            name="confirmPassword"
            type="password"
            required
            value={v.confirmPassword}
            onChange={set}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
        </div>

        <label
          className={`check check--terms ${errors.terms ? "check--error" : ""}`}
        >
          <input
            type="checkbox"
            checked={v.terms}
            onChange={(e) => set("terms", e.target.checked)}
          />
          <span>
            <AgreeToPolicies />
          </span>
        </label>
        {errors.terms && <p className="field__error">{errors.terms}</p>}

        <Button type="submit" size="lg" block disabled={isSubmitting}>
          {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        </Button>
        <SlowHint active={isSubmitting} />
        <p className="auth__foot muted">
          Đã là thành viên?{" "}
          <Link className="text-link" to="/login">
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
