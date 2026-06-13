// import { useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import Header from '../components/Header';
// import { isAdminRole } from '../api';
// import { useAuth } from '../contexts/AuthContext';

// export default function Login() {
//   const navigate = useNavigate();
//   const { login } = useAuth();
//   const [form, setForm] = useState({ emailOrPhone: '', password: '' });
//   const [loading, setLoading] = useState(false);

//   const submit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     try {
//       const user = await login({
//         emailOrPhone: form.emailOrPhone.trim(),
//         password: form.password,
//       });
//       navigate(isAdminRole(user.role) ? '/admin' : '/', { replace: true });
//     } catch (err) {
//       alert(err.message || 'Đăng nhập thất bại. Kiểm tra email/số điện thoại, mật khẩu và AuthService.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <>
//       <Header simple />
//       <div className="auth-wrap">
//         <div className="auth-card">
//           <div className="auth-title">
//             <h2><i className="fa-solid fa-bus" /> VéXeAZ</h2>
//             <p>Đăng nhập để tiếp tục</p>
//           </div>
//           <form onSubmit={submit}>
//             <div className="form-group">
//               <label>Email hoặc số điện thoại</label>
//               <input
//                 type="text"
//                 value={form.emailOrPhone}
//                 onChange={(e) => setForm({ ...form, emailOrPhone: e.target.value })}
//                 placeholder="admin@example.com"
//                 required
//               />
//             </div>
//             <div className="form-group">
//               <label>Mật khẩu</label>
//               <input
//                 type="password"
//                 value={form.password}
//                 onChange={(e) => setForm({ ...form, password: e.target.value })}
//                 required
//               />
//             </div>
//             <div className="auth-row">
//               <label><input type="checkbox" /> Nhớ mật khẩu</label>
//               <a href="#">Quên mật khẩu?</a>
//             </div>
//             <button disabled={loading} className="btn btn-primary auth-btn">
//               {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
//             </button>
//           </form>
//           <p className="auth-bottom">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p>
//         </div>
//       </div>
//     </>
//   );
// }
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/authApi';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ emailOrPhone: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Quên mật khẩu modal
  const [fpModal, setFpModal] = useState(false);
  const [fpStep, setFpStep] = useState(1); // 1=nhập email, 2=nhập OTP+mật khẩu mới
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpOtpHint, setFpOtpHint] = useState(''); // OTP trả về từ server (demo)
  const [fpNewPw, setFpNewPw] = useState('');
  const [fpConfirmPw, setFpConfirmPw] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg, setFpMsg] = useState(null); // { type: 'success'|'error', text }

  const openFp = () => { setFpModal(true); setFpStep(1); setFpEmail(''); setFpOtp(''); setFpOtpHint(''); setFpNewPw(''); setFpConfirmPw(''); setFpMsg(null); };
  const closeFp = () => setFpModal(false);

  const sendOtp = async (e) => {
    e.preventDefault();
    if (!fpEmail.trim()) return;
    setFpLoading(true); setFpMsg(null);
    try {
      const res = await authApi.forgotPassword(fpEmail.trim());
      setFpOtpHint(res.otp || '');
      setFpOtp(res.otp || '');
      setFpStep(2);
      setFpMsg({ type: 'success', text: 'Mã OTP đã được tạo. Nhập mã bên dưới để đặt lại mật khẩu.' });
    } catch (err) {
      setFpMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Không gửi được OTP.' });
    } finally {
      setFpLoading(false);
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    if (fpNewPw !== fpConfirmPw) { setFpMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' }); return; }
    if (fpNewPw.length < 6) { setFpMsg({ type: 'error', text: 'Mật khẩu mới phải ít nhất 6 ký tự.' }); return; }
    setFpLoading(true); setFpMsg(null);
    try {
      await authApi.resetPassword(fpEmail.trim(), fpOtp.trim(), fpNewPw);
      setFpMsg({ type: 'success', text: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.' });
      setTimeout(closeFp, 2000);
    } catch (err) {
      setFpMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Không đặt lại được mật khẩu.' });
    } finally {
      setFpLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login({
        emailOrPhone: form.emailOrPhone.trim(),
        password: form.password,
      });

      // const role = Number(user?.role ?? 0);
      // if (role === 2 || role === 1) {
      //   navigate('/admin', { replace: true }); // Admin và Operator đều vào /admin
      // } else {
      //   navigate('/', { replace: true });       // Customer về trang chủ
      // }
      const role = Number(user?.role ?? 0);
      if (role === 2) {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 1) {
        navigate('/operator/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }

    } catch (err) {
      alert(err.message || 'Đăng nhập thất bại. Kiểm tra email/số điện thoại, mật khẩu và AuthService.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header simple />
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-title">
            <h2><i className="fa-solid fa-bus" /> VéXeAZ</h2>
            <p>Đăng nhập để tiếp tục</p>
          </div>
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Email hoặc số điện thoại</label>
              <input
                type="text"
                value={form.emailOrPhone}
                onChange={(e) => setForm({ ...form, emailOrPhone: e.target.value })}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div className="auth-row">
              <label><input type="checkbox" /> Nhớ mật khẩu</label>
              <button type="button" className="auth-link-btn" onClick={openFp}>Quên mật khẩu?</button>
            </div>
            <button disabled={loading} className="btn btn-primary auth-btn">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
          <p className="auth-bottom">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p>
        </div>
      </div>

      {/* Modal quên mật khẩu */}
      {fpModal && (
        <div className="modal-overlay" onClick={closeFp}>
          <div className="auth-card fp-modal" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: 420 }}>
            <button onClick={closeFp} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            <div className="auth-title">
              <h2><i className="fa-solid fa-lock-open" /></h2>
              <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#1e293b' }}>
                {fpStep === 1 ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}
              </p>
            </div>

            {fpMsg && (
              <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12,
                background: fpMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color: fpMsg.type === 'success' ? '#16a34a' : '#dc2626',
                border: `1px solid ${fpMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                fontSize: '0.88rem' }}>
                {fpMsg.text}
              </div>
            )}

            {fpStep === 1 && (
              <form onSubmit={sendOtp}>
                <div className="form-group">
                  <label>Email tài khoản</label>
                  <input type="email" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} placeholder="email@example.com" required autoFocus />
                </div>
                <button className="btn btn-primary auth-btn" disabled={fpLoading}>
                  {fpLoading ? 'Đang gửi...' : 'Gửi mã OTP'}
                </button>
              </form>
            )}

            {fpStep === 2 && (
              <form onSubmit={doReset}>
                {fpOtpHint && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.88rem', color: '#1d4ed8' }}>
                    <i className="fa-solid fa-circle-info" /> Mã OTP của bạn: <strong style={{ fontSize: '1.1rem', letterSpacing: 2 }}>{fpOtpHint}</strong>
                  </div>
                )}
                <div className="form-group">
                  <label>Mã OTP</label>
                  <input type="text" value={fpOtp} onChange={(e) => setFpOtp(e.target.value)} placeholder="6 chữ số" maxLength={6} required />
                </div>
                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input type="password" value={fpNewPw} onChange={(e) => setFpNewPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" required />
                </div>
                <div className="form-group">
                  <label>Xác nhận mật khẩu</label>
                  <input type="password" value={fpConfirmPw} onChange={(e) => setFpConfirmPw(e.target.value)} placeholder="Nhập lại mật khẩu" required />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setFpStep(1); setFpMsg(null); }}>Quay lại</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={fpLoading}>
                    {fpLoading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}